import { createFileRoute, useLoaderData, useLocation } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
  MoreHorizontal,
  Paperclip,
  Phone,
  PhoneOff,
  Search,
  Send,
  Smile,
  Video,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCurrentUser } from "@/lib/current-user.server";
import type { PublicUser } from "@/lib/user-db.server";

export const Route = createFileRoute("/messages")({
  loader: () => getClientMessagesPage(),
  head: () => ({
    meta: [
      { title: "Messages - Servio" },
      { name: "description", content: "Chat with pros and clients in one place." },
    ],
  }),
  component: Messages,
});

const getClientMessagesPage = createServerFn({ method: "GET" }).handler(async () => ({
  viewer: getCurrentUser(),
}));

type Conversation = {
  id: string;
  otherUserId: number;
  otherUserName: string;
  otherUserAvatarUrl: string | null;
  job: string;
  preview: string;
  time: string;
  unread: number;
};

type LiveMessage = {
  id: string;
  conversationId: string;
  senderId: number;
  receiverId: number;
  body: string;
  kind?: "text" | "call" | "attachment";
  createdAt: string;
};

type ConversationUpsertPayload = {
  conversationId: string;
  message: LiveMessage;
  fromUser?: {
    id: number;
    name: string;
    avatarUrl?: string | null;
  };
  job?: string;
};

type CallMode = "voice" | "video";
type CallStatus = "outgoing" | "incoming" | "active";

type LiveCall = {
  callId: string;
  conversationId: string;
  mode: CallMode;
  status: CallStatus;
  fromUserId: number;
  toUserId: number;
  fromName: string;
  offer?: RTCSessionDescriptionInit;
  startedAt?: number;
};

type CallSignalPayload = {
  callId: string;
  conversationId: string;
  fromUserId: number;
  toUserId: number;
  mode?: CallMode;
  fromName?: string;
  fromAvatarUrl?: string | null;
  job?: string;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  startedAt?: string;
};

function Messages() {
  const { viewer } = useLoaderData({ from: "/messages" }) as { viewer: PublicUser | null };
  const location = useLocation();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messagesByConversation, setMessagesByConversation] = useState<
    Record<string, LiveMessage[]>
  >({});
  const [active, setActive] = useState<Conversation | null>(null);
  const [draft, setDraft] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [activeCall, setActiveCall] = useState<LiveCall | null>(null);
  const [callSeconds, setCallSeconds] = useState(0);
  const [typingByConversation, setTypingByConversation] = useState<Record<string, string>>({});
  const socketRef = useRef<Socket | null>(null);
  const conversationsRef = useRef<Conversation[]>([]);
  const localCallVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteCallVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteCallAudioRef = useRef<HTMLAudioElement | null>(null);
  const callStreamRef = useRef<MediaStream | null>(null);
  const remoteCallStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const typingStopTimerRef = useRef<number | null>(null);
  const incomingTypingTimersRef = useRef<Record<string, number>>({});

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    if (!viewer) {
      return;
    }

    const urlConversation =
      peekPendingConversation() || getConversationFromSearch(getSearchFromHref(location.href));

    if (!urlConversation) {
      return;
    }

    setActive(urlConversation);
    setConversations((current) =>
      persistConversations(viewer.id, upsertConversationList(current, urlConversation)),
    );
    socketRef.current?.emit("conversation:join", { conversationId: urlConversation.id });

    if (socketRef.current) {
      maybeSendFirstMessage(socketRef.current, viewer, urlConversation);
    }

    schedulePendingConversationClear(urlConversation.id);
  }, [location.href, viewer?.id]);

  useEffect(() => {
    if (!viewer) {
      return;
    }

    const storedConversations = readJson<Conversation[]>(
      storageKey(viewer.id, "conversations"),
      [],
    );
    const storedMessages = readJson<Record<string, LiveMessage[]>>(
      storageKey(viewer.id, "messages"),
      {},
    );
    const urlConversation =
      peekPendingConversation() || getConversationFromSearch(window.location.search);
    const pendingIncomingCall = readPendingIncomingCall(viewer.id);
    const pendingCallConversation = pendingIncomingCall
      ? buildConversationFromCall(pendingIncomingCall)
      : null;
    const nextConversations = urlConversation
      ? upsertConversationList(storedConversations, urlConversation)
      : pendingCallConversation
        ? upsertConversationList(storedConversations, pendingCallConversation)
        : storedConversations;

    setConversations(nextConversations);
    setMessagesByConversation(storedMessages);
    setActive(urlConversation || pendingCallConversation || nextConversations[0] || null);

    const socket = io(getSocketUrl(), {
      auth: {
        userId: viewer.id,
        role: viewer.role,
        name: `${viewer.firstName} ${viewer.lastName}`.trim() || viewer.email,
        avatarUrl: viewer.avatarUrl,
      },
    });
    socketRef.current = socket;

    nextConversations.forEach((conversation) => {
      socket.emit("conversation:join", { conversationId: conversation.id });
    });

    if (pendingIncomingCall) {
      socket.emit("conversation:join", { conversationId: pendingIncomingCall.conversationId });
      setActiveCall({
        callId: pendingIncomingCall.callId,
        conversationId: pendingIncomingCall.conversationId,
        mode: pendingIncomingCall.mode || "voice",
        status: "incoming",
        fromUserId: pendingIncomingCall.fromUserId,
        toUserId: viewer.id,
        fromName: pendingIncomingCall.fromName || "Someone",
        offer: pendingIncomingCall.offer,
      });
      setCallSeconds(0);
    }

    socket.on("connect", () => setSubmitError(null));
    socket.emit(
      "history:load",
      { userId: viewer.id },
      (history?: {
        conversations?: Conversation[];
        messagesByConversation?: Record<string, LiveMessage[]>;
      }) => {
        const historyConversations = urlConversation
          ? upsertConversationList(history?.conversations || [], urlConversation)
          : history?.conversations || [];
        const historyMessages = history?.messagesByConversation || {};
        const mergedConversations = mergeConversationLists(historyConversations, nextConversations);
        const mergedMessages = mergeMessagesByConversation(storedMessages, historyMessages);

        setConversations(persistConversations(viewer.id, mergedConversations));
        setMessagesByConversation(persistMessages(viewer.id, mergedMessages));
        setActive((current) => urlConversation || current || mergedConversations[0] || null);

        mergedConversations.forEach((conversation) => {
          socket.emit("conversation:join", { conversationId: conversation.id });
        });
      },
    );
    socket.on("connect_error", () => {
      setSubmitError("Socket server is not connected. Run npm run socket in another terminal.");
    });
    socket.on("message:new", (message: LiveMessage) => {
      if (message.senderId === viewer.id) {
        return;
      }

      appendMessage(viewer.id, message);
    });
    socket.on("conversation:upsert", (payload: ConversationUpsertPayload) => {
      if (!payload?.message || !payload.conversationId) {
        return;
      }

      const conversation = {
        id: payload.conversationId,
        otherUserId: payload.fromUser?.id || payload.message.senderId,
        otherUserName: payload.fromUser?.name || "Client",
        otherUserAvatarUrl: payload.fromUser?.avatarUrl || null,
        job: payload.job || "Direct message",
        preview: getMessagePreview(payload.message),
        time: formatTime(payload.message.createdAt),
        unread: active?.id === payload.conversationId ? 0 : 1,
      } satisfies Conversation;

      socket.emit("conversation:join", { conversationId: conversation.id });
      setConversations((current) =>
        persistConversations(viewer.id, upsertConversationList(current, conversation)),
      );
      appendMessage(viewer.id, payload.message);
    });
    socket.on(
      "conversation:cleared",
      ({ conversationId, userId }: { conversationId: string; userId?: number }) => {
        if (userId && userId !== viewer.id) {
          return;
        }

        clearConversationLocally(viewer.id, conversationId);
      },
    );
    socket.on(
      "typing:start",
      ({
        conversationId,
        userId,
        name,
      }: {
        conversationId: string;
        userId: number;
        name: string;
      }) => {
        if (userId === viewer.id) {
          return;
        }

        setTypingByConversation((current) => ({ ...current, [conversationId]: name || "Someone" }));
        if (incomingTypingTimersRef.current[conversationId]) {
          window.clearTimeout(incomingTypingTimersRef.current[conversationId]);
        }
        incomingTypingTimersRef.current[conversationId] = window.setTimeout(() => {
          setTypingByConversation((current) => {
            const next = { ...current };
            delete next[conversationId];
            return next;
          });
        }, 2500);
      },
    );
    socket.on(
      "typing:stop",
      ({ conversationId, userId }: { conversationId: string; userId: number }) => {
        if (userId === viewer.id) {
          return;
        }

        if (incomingTypingTimersRef.current[conversationId]) {
          window.clearTimeout(incomingTypingTimersRef.current[conversationId]);
          delete incomingTypingTimersRef.current[conversationId];
        }
        setTypingByConversation((current) => {
          const next = { ...current };
          delete next[conversationId];
          return next;
        });
      },
    );
    socket.on("call:incoming", (payload: CallSignalPayload) => {
      if (
        !payload?.callId ||
        !payload.conversationId ||
        !payload.fromUserId ||
        payload.fromUserId === viewer.id ||
        !payload.offer
      ) {
        return;
      }

      setActiveCall({
        callId: payload.callId,
        conversationId: payload.conversationId,
        mode: payload.mode || "voice",
        status: "incoming",
        fromUserId: payload.fromUserId,
        toUserId: viewer.id,
        fromName: payload.fromName || "Someone",
        offer: payload.offer,
      });
      setActive((current) => {
        if (current?.id === payload.conversationId) {
          return current;
        }

        const existing = conversationsRef.current.find(
          (conversation) => conversation.id === payload.conversationId,
        );
        if (existing) {
          return existing;
        }

        const incomingConversation = buildConversationFromCall(payload);
        socket.emit("conversation:join", { conversationId: incomingConversation.id });
        setConversations((items) =>
          persistConversations(viewer.id, upsertConversationList(items, incomingConversation)),
        );
        return incomingConversation;
      });
      setCallSeconds(0);
    });
    socket.on("call:answered", async (payload: CallSignalPayload) => {
      if (
        !payload?.callId ||
        payload.toUserId !== viewer.id ||
        !payload.answer ||
        !peerConnectionRef.current
      ) {
        return;
      }

      await peerConnectionRef.current.setRemoteDescription(
        new RTCSessionDescription(payload.answer),
      );
      await flushPendingIceCandidates();
      const startedAt = payload.startedAt ? new Date(payload.startedAt).getTime() : Date.now();
      setActiveCall((current) =>
        current?.callId === payload.callId ? { ...current, status: "active", startedAt } : current,
      );
    });
    socket.on("call:ice-candidate", async (payload: CallSignalPayload) => {
      if (!payload?.callId || payload.toUserId !== viewer.id || !payload.candidate) {
        return;
      }

      if (!peerConnectionRef.current?.remoteDescription) {
        pendingIceCandidatesRef.current.push(payload.candidate);
        return;
      }

      await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
    });
    socket.on("call:ended", (payload: CallSignalPayload) => {
      if (!payload?.callId || payload.toUserId !== viewer.id) {
        return;
      }

      cleanupCall(false);
    });

    if (urlConversation) {
      socket.emit("conversation:join", { conversationId: urlConversation.id });
      maybeSendFirstMessage(socket, viewer, urlConversation);
      schedulePendingConversationClear(urlConversation.id);
    }

    return () => {
      if (typingStopTimerRef.current) {
        window.clearTimeout(typingStopTimerRef.current);
      }
      Object.values(incomingTypingTimersRef.current).forEach((timer) => window.clearTimeout(timer));
      cleanupCall(false);
      socket.disconnect();
    };
  }, [viewer?.id]);

  useEffect(() => {
    if (activeCall?.status !== "active" || !activeCall.startedAt) {
      setCallSeconds(0);
      return;
    }

    const updateSeconds = () => {
      setCallSeconds(Math.max(0, Math.floor((Date.now() - activeCall.startedAt!) / 1000)));
    };
    updateSeconds();
    const timer = window.setInterval(updateSeconds, 1000);
    return () => window.clearInterval(timer);
  }, [activeCall?.status, activeCall?.startedAt]);

  useEffect(() => {
    if (!activeCall) {
      return;
    }

    if (localCallVideoRef.current && callStreamRef.current) {
      localCallVideoRef.current.srcObject = callStreamRef.current;
    }
    if (remoteCallAudioRef.current && remoteCallStreamRef.current) {
      remoteCallAudioRef.current.srcObject = remoteCallStreamRef.current;
    }
    if (remoteCallVideoRef.current && remoteCallStreamRef.current) {
      remoteCallVideoRef.current.srcObject = remoteCallStreamRef.current;
    }
  }, [activeCall?.callId, activeCall?.mode, activeCall?.status]);

  const appendMessage = (userId: number, message: LiveMessage) => {
    setMessagesByConversation((current) => {
      const currentMessages = current[message.conversationId] || [];
      if (currentMessages.some((item) => item.id === message.id)) {
        return current;
      }

      const next = {
        ...current,
        [message.conversationId]: [...currentMessages, message],
      };
      localStorage.setItem(storageKey(userId, "messages"), JSON.stringify(next));
      return next;
    });
    setConversations((current) =>
      persistConversations(
        userId,
        current.map((conversation) =>
          conversation.id === message.conversationId
            ? {
                ...conversation,
                preview: getMessagePreview(message),
                time: formatTime(message.createdAt),
              }
            : conversation,
        ),
      ),
    );
  };

  const selectConversation = (conversation: Conversation) => {
    setActive(conversation);
    setSubmitError(null);
    socketRef.current?.emit("conversation:join", { conversationId: conversation.id });
    setConversations((current) =>
      persistConversations(
        viewer?.id || 0,
        current.map((item) => (item.id === conversation.id ? { ...item, unread: 0 } : item)),
      ),
    );
  };

  const sendMessage = async (body = draft, kind: "text" | "call" | "attachment" = "text") => {
    if (!viewer || !active || !body.trim() || !socketRef.current) {
      return;
    }

    stopTyping();
    setIsSending(true);
    setSubmitError(null);

    socketRef.current.emit(
      "message:send",
      {
        conversationId: active.id,
        senderId: viewer.id,
        receiverId: active.otherUserId,
        body,
        kind,
        job: active.job,
        toUser: {
          id: active.otherUserId,
          name: active.otherUserName,
          avatarUrl: active.otherUserAvatarUrl,
        },
        fromUser: {
          id: viewer.id,
          name: `${viewer.firstName} ${viewer.lastName}`.trim() || viewer.email,
          avatarUrl: viewer.avatarUrl,
        },
      },
      (response: { ok: boolean; formError?: string; message?: LiveMessage }) => {
        setIsSending(false);

        if (!response.ok || !response.message) {
          setSubmitError(response.formError || "Could not send message.");
          return;
        }

        appendMessage(viewer.id, response.message);
        if (kind === "text") {
          setDraft("");
        }
      },
    );
  };

  const sendCallHistoryMessage = (call: LiveCall, body: string) => {
    if (!viewer || !socketRef.current) {
      return;
    }

    const conversation =
      conversationsRef.current.find((item) => item.id === call.conversationId) ||
      (active?.id === call.conversationId ? active : null);

    if (!conversation) {
      return;
    }

    const receiverId = call.fromUserId === viewer.id ? call.toUserId : call.fromUserId;

    socketRef.current.emit(
      "message:send",
      {
        conversationId: conversation.id,
        senderId: viewer.id,
        receiverId,
        body,
        kind: "call",
        job: conversation.job,
        toUser: {
          id: conversation.otherUserId,
          name: conversation.otherUserName,
          avatarUrl: conversation.otherUserAvatarUrl,
        },
        fromUser: {
          id: viewer.id,
          name: `${viewer.firstName} ${viewer.lastName}`.trim() || viewer.email,
          avatarUrl: viewer.avatarUrl,
        },
      },
      (response: { ok: boolean; message?: LiveMessage }) => {
        if (response.ok && response.message) {
          appendMessage(viewer.id, response.message);
        }
      },
    );
  };

  const openCall = async (mode: CallMode) => {
    if (!viewer || !active || !socketRef.current || activeCall) {
      return;
    }

    setSubmitError(null);

    try {
      const stream = await openLocalCallStream(mode);
      const callId = crypto.randomUUID();
      const peerConnection = createPeerConnection(callId, active.id, viewer.id, active.otherUserId);
      stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      setActiveCall({
        callId,
        conversationId: active.id,
        mode,
        status: "outgoing",
        fromUserId: viewer.id,
        toUserId: active.otherUserId,
        fromName: `${viewer.firstName} ${viewer.lastName}`.trim() || viewer.email,
      });
      socketRef.current.emit("call:invite", {
        callId,
        conversationId: active.id,
        fromUserId: viewer.id,
        toUserId: active.otherUserId,
        fromName: `${viewer.firstName} ${viewer.lastName}`.trim() || viewer.email,
        fromAvatarUrl: viewer.avatarUrl,
        job: active.job,
        mode,
        offer,
      });
      sendCallHistoryMessage(
        {
          callId,
          conversationId: active.id,
          mode,
          status: "outgoing",
          fromUserId: viewer.id,
          toUserId: active.otherUserId,
          fromName: `${viewer.firstName} ${viewer.lastName}`.trim() || viewer.email,
        },
        `${getCallModeLabel(mode)} call started.`,
      );
    } catch (error) {
      cleanupCall(false);
      setSubmitError(error instanceof Error ? error.message : "Could not start the call.");
    }
  };

  const answerCall = async () => {
    if (!viewer || !activeCall?.offer || activeCall.status !== "incoming" || !socketRef.current) {
      return;
    }

    setSubmitError(null);

    try {
      socketRef.current.emit("conversation:join", { conversationId: activeCall.conversationId });
      const stream = await openLocalCallStream(activeCall.mode);
      const peerConnection = createPeerConnection(
        activeCall.callId,
        activeCall.conversationId,
        viewer.id,
        activeCall.fromUserId,
      );
      stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));
      await peerConnection.setRemoteDescription(new RTCSessionDescription(activeCall.offer));
      await flushPendingIceCandidates();
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      const startedAt = new Date().toISOString();

      setActiveCall((current) =>
        current ? { ...current, status: "active", startedAt: Date.now() } : current,
      );
      socketRef.current.emit("call:answer", {
        callId: activeCall.callId,
        conversationId: activeCall.conversationId,
        fromUserId: viewer.id,
        toUserId: activeCall.fromUserId,
        answer,
        startedAt,
      });
      clearPendingIncomingCall(activeCall.callId);
      sendCallHistoryMessage(activeCall, `${getCallModeLabel(activeCall.mode)} call answered.`);
    } catch (error) {
      cleanupCall(false);
      setSubmitError(error instanceof Error ? error.message : "Could not answer the call.");
    }
  };

  const endInlineCall = () => {
    cleanupCall(true);
  };

  const openLocalCallStream = async (mode: CallMode) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Camera and microphone are not available in this browser.");
    }

    const stream =
      mode === "video"
        ? await openVideoOrAudioFallback()
        : await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    callStreamRef.current = stream;

    window.setTimeout(() => {
      if (localCallVideoRef.current) {
        localCallVideoRef.current.srcObject = stream;
      }
    }, 0);

    return stream;
  };

  const openVideoOrAudioFallback = async () => {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      });
    } catch (error) {
      if (!isVideoSourceError(error)) {
        throw error;
      }

      try {
        const audioOnlyStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
        setSubmitError("Camera is busy or unavailable, so you joined with microphone only.");
        return audioOnlyStream;
      } catch {
        throw error;
      }
    }
  };

  const createPeerConnection = (
    callId: string,
    conversationId: string,
    fromUserId: number,
    toUserId: number,
  ) => {
    const peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    peerConnectionRef.current = peerConnection;
    remoteCallStreamRef.current = new MediaStream();

    peerConnection.onicecandidate = (event) => {
      if (!event.candidate) {
        return;
      }

      socketRef.current?.emit("call:ice-candidate", {
        callId,
        conversationId,
        fromUserId,
        toUserId,
        candidate: event.candidate.toJSON(),
      });
    };

    peerConnection.ontrack = (event) => {
      const [stream] = event.streams;
      const remoteStream = stream || remoteCallStreamRef.current;
      if (!remoteStream) {
        return;
      }

      if (event.track && !remoteStream.getTracks().includes(event.track)) {
        remoteStream.addTrack(event.track);
      }
      remoteCallStreamRef.current = remoteStream;
      if (remoteCallAudioRef.current) {
        remoteCallAudioRef.current.srcObject = remoteStream;
      }
      if (remoteCallVideoRef.current) {
        remoteCallVideoRef.current.srcObject = remoteStream;
      }
    };

    peerConnection.onconnectionstatechange = () => {
      if (["closed", "disconnected", "failed"].includes(peerConnection.connectionState)) {
        cleanupCall(false);
      }
    };

    return peerConnection;
  };

  const flushPendingIceCandidates = async () => {
    if (!peerConnectionRef.current?.remoteDescription) {
      return;
    }

    for (const candidate of pendingIceCandidatesRef.current) {
      await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
    }
    pendingIceCandidatesRef.current = [];
  };

  const cleanupCall = (notifyPeer = true) => {
    const callToClose = activeCall;
    if (callToClose) {
      clearPendingIncomingCall(callToClose.callId);
    }
    if (notifyPeer && callToClose) {
      sendCallHistoryMessage(callToClose, getCallCloseHistoryBody(callToClose));
    }

    if (notifyPeer && viewer && callToClose && socketRef.current) {
      const peerUserId =
        callToClose.fromUserId === viewer.id ? callToClose.toUserId : callToClose.fromUserId;
      socketRef.current.emit("call:end", {
        callId: callToClose.callId,
        conversationId: callToClose.conversationId,
        fromUserId: viewer.id,
        toUserId: peerUserId,
      });
    }

    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    callStreamRef.current?.getTracks().forEach((track) => track.stop());
    callStreamRef.current = null;
    remoteCallStreamRef.current?.getTracks().forEach((track) => track.stop());
    remoteCallStreamRef.current = null;
    pendingIceCandidatesRef.current = [];
    if (localCallVideoRef.current) {
      localCallVideoRef.current.srcObject = null;
    }
    if (remoteCallVideoRef.current) {
      remoteCallVideoRef.current.srcObject = null;
    }
    if (remoteCallAudioRef.current) {
      remoteCallAudioRef.current.srcObject = null;
    }
    setActiveCall(null);
    setCallSeconds(0);
  };

  const sendAttachment = async (file: File) => {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setSubmitError("Attachment must be 2 MB or smaller.");
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      await sendMessage(
        JSON.stringify({
          fileName: file.name,
          fileType: file.type || "application/octet-stream",
          fileSize: file.size,
          dataUrl,
        }),
        "attachment",
      );
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Could not attach this file.");
    }
  };

  const updateDraft = (value: string) => {
    setDraft(value);
    emitTyping(value);
  };

  const emitTyping = (value: string) => {
    if (!viewer || !active || !socketRef.current) {
      return;
    }

    if (!value.trim()) {
      stopTyping();
      return;
    }

    socketRef.current.emit("typing:start", {
      conversationId: active.id,
      userId: viewer.id,
      receiverId: active.otherUserId,
      name: `${viewer.firstName} ${viewer.lastName}`.trim() || viewer.email,
    });

    if (typingStopTimerRef.current) {
      window.clearTimeout(typingStopTimerRef.current);
    }
    typingStopTimerRef.current = window.setTimeout(stopTyping, 1200);
  };

  const stopTyping = () => {
    if (typingStopTimerRef.current) {
      window.clearTimeout(typingStopTimerRef.current);
      typingStopTimerRef.current = null;
    }

    if (!viewer || !active || !socketRef.current) {
      return;
    }

    socketRef.current.emit("typing:stop", {
      conversationId: active.id,
      userId: viewer.id,
      receiverId: active.otherUserId,
    });
  };

  const clearConversationLocally = (userId: number, conversationId: string) => {
    setMessagesByConversation((current) => {
      const next = {
        ...current,
        [conversationId]: [],
      };
      localStorage.setItem(storageKey(userId, "messages"), JSON.stringify(next));
      return next;
    });
    setConversations((current) =>
      persistConversations(
        userId,
        current.map((conversation) =>
          conversation.id === conversationId
            ? { ...conversation, preview: "Chat cleared", time: "", unread: 0 }
            : conversation,
        ),
      ),
    );
  };

  const clearChat = () => {
    if (!viewer || !active) {
      return;
    }

    const conversationId = active.id;
    clearConversationLocally(viewer.id, conversationId);
    setTypingByConversation((current) => {
      const next = { ...current };
      delete next[conversationId];
      return next;
    });
    setSubmitError(null);

    if (!socketRef.current) {
      return;
    }

    socketRef.current.emit(
      "conversation:clear",
      {
        conversationId,
        userId: viewer.id,
      },
      (response: { ok: boolean; formError?: string }) => {
        if (!response.ok) {
          console.warn(response.formError || "Could not clear this chat on the server.");
          return;
        }
      },
    );
  };

  const activeMessages = active ? messagesByConversation[active.id] || [] : [];
  const typingName = active ? typingByConversation[active.id] : "";

  return (
    <AppShell
      title="Messages"
      userName={viewer ? `${viewer.firstName} ${viewer.lastName}`.trim() : "Client"}
      userRole="Client"
      userAvatarUrl={viewer?.avatarUrl}
    >
      <div className="grid h-[calc(100vh-12rem)] overflow-hidden rounded-2xl border border-border bg-card shadow-soft md:grid-cols-[320px_1fr]">
        <MessageSidebar
          conversations={conversations}
          active={active}
          emptyText="No professional messages yet."
          onSelect={selectConversation}
        />

        <section className="flex min-h-0 flex-col">
          {active ? (
            <>
              <MessageHeader
                active={active}
                activeCall={activeCall?.conversationId === active.id ? activeCall : null}
                callSeconds={callSeconds}
                typingName={typingName}
                openCall={openCall}
                endCall={endInlineCall}
                clearChat={clearChat}
              />
              <InlineCallPanel
                activeCall={activeCall?.conversationId === active.id ? activeCall : null}
                callSeconds={callSeconds}
                otherUserName={active.otherUserName}
                localVideoRef={localCallVideoRef}
                remoteVideoRef={remoteCallVideoRef}
                remoteAudioRef={remoteCallAudioRef}
                answerCall={answerCall}
                endCall={endInlineCall}
              />
              <div className="flex-1 space-y-3 overflow-y-auto bg-surface p-6">
                {activeMessages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    mine={message.senderId === viewer?.id}
                  />
                ))}
                {typingName ? <TypingIndicator name={typingName} /> : null}
              </div>
              <MessageComposer
                draft={draft}
                setDraft={updateDraft}
                submitError={submitError}
                isSending={isSending}
                sendMessage={() => void sendMessage()}
                sendAttachment={(file) => void sendAttachment(file)}
              />
            </>
          ) : (
            <EmptyConversation text="Professional messages will appear here when a conversation starts." />
          )}
        </section>
      </div>
    </AppShell>
  );
}

function MessageSidebar({
  conversations,
  active,
  emptyText,
  onSelect,
}: {
  conversations: Conversation[];
  active: Conversation | null;
  emptyText: string;
  onSelect: (conversation: Conversation) => void;
}) {
  return (
    <aside className="border-r border-border">
      <div className="border-b border-border p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search conversations" className="pl-9" />
        </div>
      </div>
      <div className="overflow-y-auto">
        {conversations.length ? (
          conversations.map((conversation: Conversation) => (
            <button
              key={conversation.id}
              type="button"
              onClick={() => onSelect(conversation)}
              className={`flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition-colors ${
                active?.id === conversation.id ? "bg-primary/5" : "hover:bg-muted"
              }`}
            >
              <img
                src={conversation.otherUserAvatarUrl || "https://i.pravatar.cc/100?u=message-user"}
                className="h-10 w-10 rounded-full object-cover"
                alt=""
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold">{conversation.otherUserName}</p>
                  <span className="text-[10px] text-muted-foreground">{conversation.time}</span>
                </div>
                <p className="truncate text-xs text-muted-foreground">{conversation.preview}</p>
                <p className="mt-1 truncate text-[10px] uppercase tracking-wider text-primary">
                  re: {conversation.job}
                </p>
              </div>
              {conversation.unread > 0 ? (
                <span className="grid h-5 w-5 place-items-center rounded-full bg-cta text-[10px] font-bold text-cta-foreground">
                  {conversation.unread}
                </span>
              ) : null}
            </button>
          ))
        ) : (
          <div className="p-6 text-sm text-muted-foreground">{emptyText}</div>
        )}
      </div>
    </aside>
  );
}

function MessageHeader({
  active,
  activeCall,
  callSeconds,
  typingName,
  openCall,
  endCall,
  clearChat,
}: {
  active: Conversation;
  activeCall: LiveCall | null;
  callSeconds: number;
  typingName: string;
  openCall: (mode: CallMode) => void;
  endCall: () => void;
  clearChat: () => void;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="flex items-center gap-3 border-b border-border p-4">
      <img
        src={active.otherUserAvatarUrl || "https://i.pravatar.cc/100?u=message-user"}
        className="h-10 w-10 rounded-full object-cover"
        alt=""
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold">{active.otherUserName}</p>
          {typingName ? <HeaderTypingDots /> : null}
          {activeCall ? (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
              {activeCall.status === "active" ? formatCallDuration(callSeconds) : activeCall.status}
            </span>
          ) : null}
        </div>
        <p className="truncate text-xs text-muted-foreground">re: {active.job}</p>
      </div>
      <div className="flex gap-1 text-muted-foreground">
        {activeCall ? (
          <button
            type="button"
            onClick={endCall}
            className="grid h-9 w-9 place-items-center rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90"
            aria-label="Hang up call"
          >
            <PhoneOff className="h-4 w-4" />
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => openCall("voice")}
              className="grid h-9 w-9 place-items-center rounded-lg hover:bg-muted hover:text-foreground"
              aria-label="Start voice call"
            >
              <Phone className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => openCall("video")}
              className="grid h-9 w-9 place-items-center rounded-lg hover:bg-muted hover:text-foreground"
              aria-label="Start video call"
            >
              <Video className="h-4 w-4" />
            </button>
          </>
        )}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsMenuOpen((current) => !current)}
            className="grid h-9 w-9 place-items-center rounded-lg hover:bg-muted hover:text-foreground"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {isMenuOpen ? (
            <div className="absolute right-0 top-10 z-30 w-40 rounded-lg border border-border bg-card p-1 shadow-elevated">
              <button
                type="button"
                onClick={() => {
                  clearChat();
                  setIsMenuOpen(false);
                }}
                className="w-full rounded-md px-3 py-2 text-left text-sm text-destructive hover:bg-muted"
              >
                Clear chat
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function InlineCallPanel({
  activeCall,
  callSeconds,
  otherUserName,
  localVideoRef,
  remoteVideoRef,
  remoteAudioRef,
  answerCall,
  endCall,
}: {
  activeCall: LiveCall | null;
  callSeconds: number;
  otherUserName: string;
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
  remoteAudioRef: React.RefObject<HTMLAudioElement | null>;
  answerCall: () => void;
  endCall: () => void;
}) {
  if (!activeCall) {
    return null;
  }

  return (
    <div className="border-b border-border bg-primary/5 p-4">
      <div className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-card p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground">
            {activeCall.mode === "video" ? (
              <Video className="h-5 w-5" />
            ) : (
              <Phone className="h-5 w-5" />
            )}
          </div>
          <div>
            <p className="font-semibold">
              {activeCall.status === "incoming"
                ? "Incoming call"
                : activeCall.status === "outgoing"
                  ? "Calling..."
                  : formatCallDuration(callSeconds)}
            </p>
            <p className="text-sm text-muted-foreground">
              {activeCall.mode === "video" ? "Video call" : "Voice call"} with{" "}
              {activeCall.status === "incoming" ? activeCall.fromName : otherUserName}
            </p>
          </div>
        </div>
        <audio ref={remoteAudioRef} autoPlay playsInline />
        {activeCall.mode === "video" ? (
          <div className="flex gap-2">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="h-24 w-36 rounded-lg bg-foreground object-cover"
            />
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="h-24 w-36 rounded-lg bg-foreground object-cover"
            />
          </div>
        ) : null}
        <div className="flex gap-2">
          {activeCall.status === "incoming" ? <Button onClick={answerCall}>Answer</Button> : null}
          <Button variant="destructive" onClick={endCall}>
            {activeCall.status === "incoming" ? "Decline" : "Hang up"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function MessageComposer({
  draft,
  setDraft,
  submitError,
  isSending,
  sendMessage,
  sendAttachment,
}: {
  draft: string;
  setDraft: (value: string) => void;
  submitError: string | null;
  isSending: boolean;
  sendMessage: () => void;
  sendAttachment: (file: File) => void;
}) {
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <footer className="border-t border-border p-3">
      {submitError ? <p className="mb-2 text-sm text-destructive">{submitError}</p> : null}
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              sendAttachment(file);
            }
            event.currentTarget.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Attach file"
        >
          <Paperclip className="h-4 w-4" />
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsEmojiOpen((current) => !current)}
            className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Add emoji"
          >
            <Smile className="h-4 w-4" />
          </button>
          {isEmojiOpen ? (
            <div className="absolute bottom-11 left-0 z-30 grid w-56 grid-cols-8 gap-1 rounded-xl border border-border bg-card p-2 shadow-elevated">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    setDraft(`${draft}${emoji}`);
                    setIsEmojiOpen(false);
                  }}
                  className="grid h-7 w-7 place-items-center rounded-md text-lg hover:bg-muted"
                >
                  {emoji}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <Input
          placeholder="Type a message..."
          className="flex-1"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              sendMessage();
            }
          }}
        />
        <Button
          className="bg-cta text-cta-foreground hover:bg-cta/90"
          onClick={sendMessage}
          disabled={isSending}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </footer>
  );
}

function MessageBubble({ message, mine }: { message: LiveMessage; mine: boolean }) {
  const isCallMessage =
    message.kind === "call" ||
    message.body.startsWith("Call started:") ||
    message.body === "Call ended.";

  if (message.kind === "attachment") {
    const attachment = parseAttachment(message.body);

    return (
      <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
        <div
          className={`max-w-md rounded-2xl px-4 py-3 text-sm shadow-soft ${
            mine ? "bg-primary text-primary-foreground" : "bg-card text-foreground"
          }`}
        >
          {attachment?.fileType.startsWith("image/") ? (
            <img
              src={attachment.dataUrl}
              alt=""
              className="mb-3 max-h-56 rounded-xl object-cover"
            />
          ) : null}
          <a
            href={attachment?.dataUrl || "#"}
            download={attachment?.fileName}
            className={`flex items-center gap-2 font-medium ${mine ? "text-primary-foreground" : "text-primary"}`}
          >
            <Paperclip className="h-4 w-4" />
            <span className="truncate">{attachment?.fileName || "Attachment"}</span>
          </a>
          {attachment ? (
            <p
              className={`mt-1 text-xs ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}
            >
              {formatFileSize(attachment.fileSize)}
            </p>
          ) : null}
          <p
            className={`mt-1 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}
          >
            {new Date(message.createdAt).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>
    );
  }

  if (isCallMessage) {
    const isEnded =
      message.body === "Call ended." ||
      message.body.includes("ended") ||
      message.body.includes("canceled") ||
      message.body.includes("declined");

    return (
      <div className="flex justify-center">
        <div className="flex max-w-sm items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm shadow-soft">
          <div
            className={`grid h-9 w-9 place-items-center rounded-full ${isEnded ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"}`}
          >
            {message.body.includes("Video") ? (
              <Video className="h-4 w-4" />
            ) : (
              <Phone className="h-4 w-4" />
            )}
          </div>
          <div>
            <p className="font-medium">{getCallHistoryTitle(message.body)}</p>
            <p className="text-xs text-muted-foreground">
              {message.body.replace("Call started: ", "")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-md whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm shadow-soft ${
          mine ? "bg-primary text-primary-foreground" : "bg-card text-foreground"
        }`}
      >
        <p>{message.body}</p>
        <p
          className={`mt-1 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}
        >
          {new Date(message.createdAt).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}

function TypingIndicator({ name }: { name: string }) {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl bg-card px-4 py-2.5 text-sm shadow-soft">
        <div className="mb-1 text-xs text-muted-foreground">{name} is typing</div>
        <div className="flex items-center gap-1">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function HeaderTypingDots() {
  return (
    <span
      className="flex h-5 items-center gap-1 rounded-full bg-primary/10 px-2"
      aria-label="Typing"
    >
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}

function EmptyConversation({ text }: { text: string }) {
  return (
    <div className="grid flex-1 place-items-center bg-surface p-6 text-center">
      <div>
        <p className="text-lg font-semibold">No conversation selected</p>
        <p className="mt-2 text-sm text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

function getConversationFromSearch(searchString: string): Conversation | null {
  const search = new URLSearchParams(searchString);
  const conversationId = search.get("conversationId");
  const otherUserId = Number(search.get("toUserId"));

  if (!conversationId || !Number.isFinite(otherUserId)) {
    return null;
  }

  return {
    id: conversationId,
    otherUserId,
    otherUserName: search.get("name") || "Professional",
    otherUserAvatarUrl: search.get("avatar") || null,
    job: search.get("job") || "Direct message",
    preview: "Start conversation",
    time: "",
    unread: 0,
  };
}

function consumePendingConversation(): Conversation | null {
  const conversation = readPendingConversation();

  if (conversation) {
    sessionStorage.removeItem("servio:pending-professional-message");
  }

  return conversation;
}

function peekPendingConversation(): Conversation | null {
  return readPendingConversation();
}

function readPendingConversation(): Conversation | null {
  try {
    const raw = sessionStorage.getItem("servio:pending-professional-message");

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as {
      createdAt?: number;
      conversation?: Conversation;
      firstMessage?: string;
    };

    if (!parsed.conversation?.id || !parsed.conversation.otherUserId) {
      return null;
    }

    if (parsed.createdAt && Date.now() - parsed.createdAt > 30_000) {
      sessionStorage.removeItem("servio:pending-professional-message");
      return null;
    }

    if (parsed.firstMessage) {
      sessionStorage.setItem(
        `servio:pending-first-message:${parsed.conversation.id}`,
        parsed.firstMessage,
      );
    }

    return parsed.conversation;
  } catch {
    return null;
  }
}

function schedulePendingConversationClear(conversationId: string) {
  window.setTimeout(() => {
    try {
      const raw = sessionStorage.getItem("servio:pending-professional-message");

      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as { conversation?: Conversation };

      if (parsed.conversation?.id === conversationId) {
        sessionStorage.removeItem("servio:pending-professional-message");
      }
    } catch {
      sessionStorage.removeItem("servio:pending-professional-message");
    }
  }, 1500);
}

function getSearchFromHref(href: string) {
  const queryStart = href.indexOf("?");

  if (queryStart === -1) {
    return "";
  }

  const hashStart = href.indexOf("#", queryStart);
  return hashStart === -1 ? href.slice(queryStart) : href.slice(queryStart, hashStart);
}

function readPendingIncomingCall(viewerId: number): CallSignalPayload | null {
  try {
    const raw = sessionStorage.getItem("servio:pending-incoming-call");

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as { createdAt?: number; call?: CallSignalPayload };
    const call = parsed.call;

    if (!call?.callId || !call.conversationId || call.toUserId !== viewerId || !call.offer) {
      return null;
    }

    if (parsed.createdAt && Date.now() - parsed.createdAt > 60_000) {
      sessionStorage.removeItem("servio:pending-incoming-call");
      return null;
    }

    return call;
  } catch {
    return null;
  }
}

function clearPendingIncomingCall(callId: string) {
  try {
    const raw = sessionStorage.getItem("servio:pending-incoming-call");
    if (!raw) return;
    const parsed = JSON.parse(raw) as { call?: { callId?: string } };
    if (parsed.call?.callId === callId) {
      sessionStorage.removeItem("servio:pending-incoming-call");
    }
  } catch {
    sessionStorage.removeItem("servio:pending-incoming-call");
  }
}

function buildConversationFromCall(payload: CallSignalPayload): Conversation {
  return {
    id: payload.conversationId,
    otherUserId: payload.fromUserId,
    otherUserName: payload.fromName || "Caller",
    otherUserAvatarUrl: payload.fromAvatarUrl || null,
    job: payload.job || "Direct call",
    preview: `${getCallModeLabel(payload.mode || "voice")} call incoming`,
    time: formatTime(new Date().toISOString()),
    unread: 0,
  };
}

function maybeSendFirstMessage(socket: Socket, viewer: PublicUser, conversation: Conversation) {
  const search = new URLSearchParams(window.location.search);
  const pendingFirstMessageKey = `servio:pending-first-message:${conversation.id}`;
  const firstMessage = search.get("firstMessage") || sessionStorage.getItem(pendingFirstMessageKey);
  const firstKey = `socket-first-message:${conversation.id}:${viewer.id}`;

  if (!firstMessage || sessionStorage.getItem(firstKey)) {
    return;
  }

  sessionStorage.setItem(firstKey, "sent");
  sessionStorage.removeItem(pendingFirstMessageKey);
  socket.emit("message:send", {
    conversationId: conversation.id,
    senderId: viewer.id,
    receiverId: conversation.otherUserId,
    body: firstMessage,
    kind: "text",
    job: conversation.job,
    toUser: {
      id: conversation.otherUserId,
      name: conversation.otherUserName,
      avatarUrl: conversation.otherUserAvatarUrl,
    },
    fromUser: {
      id: viewer.id,
      name: `${viewer.firstName} ${viewer.lastName}`.trim() || viewer.email,
      avatarUrl: viewer.avatarUrl,
    },
  });
}

function storageKey(userId: number, suffix: string) {
  return `servio:socket:${userId}:${suffix}`;
}

function readJson<T>(key: string, fallback: T) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : fallback;
  } catch {
    return fallback;
  }
}

function persistConversations(userId: number, conversations: Conversation[]) {
  if (userId) {
    localStorage.setItem(storageKey(userId, "conversations"), JSON.stringify(conversations));
  }

  return conversations;
}

function persistMessages(userId: number, messagesByConversation: Record<string, LiveMessage[]>) {
  if (userId) {
    localStorage.setItem(storageKey(userId, "messages"), JSON.stringify(messagesByConversation));
  }

  return messagesByConversation;
}

function upsertConversationList(conversations: Conversation[], conversation: Conversation) {
  const withoutCurrent = conversations.filter((item) => item.id !== conversation.id);
  return [conversation, ...withoutCurrent];
}

function mergeConversationLists(primary: Conversation[], fallback: Conversation[]) {
  const seen = new Set<string>();
  const merged: Conversation[] = [];

  for (const conversation of [...primary, ...fallback]) {
    if (seen.has(conversation.id)) {
      continue;
    }

    seen.add(conversation.id);
    merged.push(conversation);
  }

  return merged;
}

function mergeMessagesByConversation(
  fallback: Record<string, LiveMessage[]>,
  primary: Record<string, LiveMessage[]>,
) {
  const conversationIds = new Set([...Object.keys(fallback), ...Object.keys(primary)]);
  const merged: Record<string, LiveMessage[]> = {};

  for (const conversationId of conversationIds) {
    const byId = new Map<string, LiveMessage>();
    for (const message of [
      ...(fallback[conversationId] || []),
      ...(primary[conversationId] || []),
    ]) {
      byId.set(message.id, message);
    }
    merged[conversationId] = Array.from(byId.values()).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }

  return merged;
}

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatCallDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function getCallModeLabel(mode: CallMode) {
  return mode === "video" ? "Video" : "Voice";
}

function getCallCloseHistoryBody(call: LiveCall) {
  const mode = getCallModeLabel(call.mode);

  if (call.status === "incoming") {
    return `${mode} call declined.`;
  }

  if (call.status === "outgoing") {
    return `${mode} call canceled.`;
  }

  const durationSeconds = call.startedAt
    ? Math.max(0, Math.floor((Date.now() - call.startedAt) / 1000))
    : 0;
  return `${mode} call ended (${formatCallDuration(durationSeconds)}).`;
}

function isVideoSourceError(error: unknown) {
  if (!(error instanceof DOMException)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    ["NotReadableError", "AbortError", "NotFoundError", "OverconstrainedError"].includes(
      error.name,
    ) ||
    message.includes("video source") ||
    message.includes("camera")
  );
}

function getCallHistoryTitle(body: string) {
  if (body.includes("declined")) {
    return "Call declined";
  }

  if (body.includes("canceled")) {
    return "Call canceled";
  }

  if (body.includes("answered")) {
    return "Call answered";
  }

  if (body.includes("ended") || body === "Call ended.") {
    return "Call ended";
  }

  return "Call started";
}

function getSocketUrl() {
  return (
    import.meta.env.VITE_SOCKET_URL ||
    `${window.location.protocol}//${window.location.hostname}:4001`
  );
}

const EMOJIS = [
  "😀",
  "😁",
  "😂",
  "😊",
  "😍",
  "👍",
  "🙏",
  "🎉",
  "🔥",
  "✅",
  "❤️",
  "👌",
  "😎",
  "🤝",
  "💡",
  "⭐",
];
const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;

type AttachmentPayload = {
  fileName: string;
  fileType: string;
  fileSize: number;
  dataUrl: string;
};

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read this file."));
    reader.readAsDataURL(file);
  });
}

function parseAttachment(body: string): AttachmentPayload | null {
  try {
    return JSON.parse(body) as AttachmentPayload;
  } catch {
    return null;
  }
}

function getMessagePreview(message: LiveMessage) {
  if (message.kind === "attachment") {
    const attachment = parseAttachment(message.body);
    return attachment ? `Attachment: ${attachment.fileName}` : "Attachment";
  }

  return message.body;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
