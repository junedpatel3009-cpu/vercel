import { createServer } from "node:http";
import path from "node:path";
import Database from "better-sqlite3";
import { Server } from "socket.io";

const port = Number(process.env.SOCKET_PORT || 4001);
const clientOrigin = process.env.SOCKET_CLIENT_ORIGIN || "*";
const databasePath = path.resolve(process.cwd(), "prisma", "app.db");
const db = new Database(databasePath);

db.exec(`
  CREATE TABLE IF NOT EXISTS "SocketConversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userAId" INTEGER NOT NULL,
    "userBId" INTEGER NOT NULL,
    "userAName" TEXT NOT NULL,
    "userBName" TEXT NOT NULL,
    "userAAvatarUrl" TEXT,
    "userBAvatarUrl" TEXT,
    "job" TEXT NOT NULL DEFAULT 'Direct message',
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS "SocketMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "senderId" INTEGER NOT NULL,
    "receiverId" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'text',
    "createdAt" TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS "SocketConversationClear" (
    "conversationId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "clearedAt" TEXT NOT NULL,
    PRIMARY KEY ("conversationId", "userId")
  );

  CREATE TABLE IF NOT EXISTS "UserNotification" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "href" TEXT,
    "createdAt" TEXT NOT NULL,
    "readAt" TEXT,
    "clearedAt" TEXT
  );

  CREATE INDEX IF NOT EXISTS "SocketConversation_userAId_idx" ON "SocketConversation"("userAId");
  CREATE INDEX IF NOT EXISTS "SocketConversation_userBId_idx" ON "SocketConversation"("userBId");
  CREATE INDEX IF NOT EXISTS "SocketMessage_conversationId_idx" ON "SocketMessage"("conversationId");
  CREATE INDEX IF NOT EXISTS "SocketConversationClear_userId_idx" ON "SocketConversationClear"("userId");
  CREATE INDEX IF NOT EXISTS "UserNotification_userId_idx" ON "UserNotification"("userId");
`);

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: clientOrigin,
    methods: ["GET", "POST"],
  },
  maxHttpBufferSize: 5e6,
});
const activeCalls = new Map();

httpServer.on("request", (request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true, service: "socket.io" }));
  }
});

io.on("connection", (socket) => {
  const userId = String(socket.handshake.auth?.userId || "");
  let notificationInterval = null;
  console.log(`Socket connected: ${socket.id}${userId ? ` user:${userId}` : ""}`);

  if (userId) {
    socket.join(`user:${userId}`);
  }

  socket.on("admin:subscribe", () => {
    socket.join("admin");
    socket.emit("admin:refresh", { reason: "subscribed" });
  });

  socket.on("admin:activity", (payload = {}) => {
    io.to("admin").emit("admin:refresh", {
      reason: String(payload.reason || "platform activity"),
      createdAt: new Date().toISOString(),
    });
  });

  socket.on("disconnect", (reason) => {
    if (notificationInterval) {
      clearInterval(notificationInterval);
      notificationInterval = null;
    }
    console.log(`Socket disconnected: ${socket.id} ${reason}`);
  });

  socket.on("notifications:subscribe", ({ userId: requestedUserId }) => {
    const subscribedUserId = Number(requestedUserId || userId);

    if (!subscribedUserId) {
      return;
    }

    if (notificationInterval) {
      clearInterval(notificationInterval);
    }

    socket.emit("notifications:refresh", { reason: "subscribed" });
    notificationInterval = setInterval(() => {
      socket.emit("notifications:refresh", { reason: "heartbeat" });
    }, 5000);
  });

  socket.on("conversation:join", ({ conversationId }) => {
    if (conversationId) {
      socket.join(`conversation:${conversationId}`);
    }
  });

  socket.on("project:join", ({ trackingId }) => {
    const room = getProjectRoom(trackingId);

    if (room) {
      socket.join(room);
    }
  });

  socket.on("project:activity", (payload) => {
    const activity = normalizeProjectActivity(payload);

    if (!activity.trackingId || !activity.actorId || !activity.title) {
      return;
    }

    socket.to(getProjectRoom(activity.trackingId)).emit("project:activity", activity);

    if (activity.recipientId) {
      saveUserNotification({
        userId: activity.recipientId,
        type: "project",
        title: activity.title,
        description: activity.description,
        href: activity.href || "/notifications",
        createdAt: activity.createdAt,
      });
      io.to(`user:${activity.recipientId}`).emit("project:activity", activity);
      io.to(`user:${activity.recipientId}`).emit("notifications:refresh", {
        reason: "project-activity",
      });
    }

    io.to("admin").emit("admin:refresh", { reason: "project activity" });
  });

  socket.on("typing:start", ({ conversationId, userId, receiverId, name }) => {
    if (!conversationId || !userId) {
      return;
    }

    const payload = {
      conversationId,
      userId: Number(userId),
      name: String(name || "Someone"),
    };

    socket.to(`conversation:${conversationId}`).emit("typing:start", payload);
    if (receiverId) {
      io.to(`user:${Number(receiverId)}`).emit("typing:start", payload);
    }
  });

  socket.on("typing:stop", ({ conversationId, userId, receiverId }) => {
    if (!conversationId || !userId) {
      return;
    }

    const payload = {
      conversationId,
      userId: Number(userId),
    };

    socket.to(`conversation:${conversationId}`).emit("typing:stop", payload);
    if (receiverId) {
      io.to(`user:${Number(receiverId)}`).emit("typing:stop", payload);
    }
  });

  socket.on("call:invite", (payload) => {
    const call = normalizeCallPayload(payload);
    if (
      !call.conversationId ||
      !call.callId ||
      !call.fromUserId ||
      !call.toUserId ||
      !payload?.offer
    ) {
      return;
    }

    rememberCallSignal(call.callId, {
      ...call,
      mode: payload.mode === "video" ? "video" : "voice",
      fromName: String(payload.fromName || "Someone"),
      fromAvatarUrl: payload.fromAvatarUrl || null,
      job: String(payload.job || "Direct call"),
      offer: payload.offer,
    });
    emitCallSignal(call, "call:incoming", {
      ...call,
      mode: payload.mode === "video" ? "video" : "voice",
      fromName: String(payload.fromName || "Someone"),
      fromAvatarUrl: payload.fromAvatarUrl || null,
      job: String(payload.job || "Direct call"),
      offer: payload.offer,
    });
  });

  socket.on("call:answer", (payload) => {
    const call = normalizeCallPayload(payload);
    if (
      !call.conversationId ||
      !call.callId ||
      !call.fromUserId ||
      !call.toUserId ||
      !payload?.answer
    ) {
      return;
    }

    emitCallSignal(call, "call:answered", {
      ...call,
      answer: payload.answer,
      startedAt: payload.startedAt || new Date().toISOString(),
    });
    flushBufferedCandidates(call.callId, call.toUserId, call.fromUserId);
    flushBufferedCandidates(call.callId, call.fromUserId, call.toUserId);
  });

  socket.on("call:ice-candidate", (payload) => {
    const call = normalizeCallPayload(payload);
    if (
      !call.conversationId ||
      !call.callId ||
      !call.fromUserId ||
      !call.toUserId ||
      !payload?.candidate
    ) {
      return;
    }

    rememberCallCandidate(call.callId, call.toUserId, {
      ...call,
      candidate: payload.candidate,
    });
    emitCallSignal(call, "call:ice-candidate", {
      ...call,
      candidate: payload.candidate,
    });
  });

  socket.on("call:end", (payload) => {
    const call = normalizeCallPayload(payload);
    if (!call.conversationId || !call.callId || !call.fromUserId || !call.toUserId) {
      return;
    }

    emitCallSignal(call, "call:ended", {
      ...call,
      reason: String(payload.reason || "ended"),
    });
    activeCalls.delete(call.callId);
  });

  socket.on("history:load", ({ userId }, ack) => {
    const numericUserId = Number(userId);

    if (!numericUserId) {
      ack?.({ conversations: [], messagesByConversation: {} });
      return;
    }

    ack?.(loadHistory(numericUserId));
  });

  socket.on("message:send", (payload, ack) => {
    const message = {
      id: crypto.randomUUID(),
      conversationId: String(payload.conversationId || ""),
      senderId: Number(payload.senderId),
      receiverId: Number(payload.receiverId),
      body: String(payload.body || "").trim(),
      kind: payload.kind || "text",
      createdAt: new Date().toISOString(),
    };

    if (!message.conversationId || !message.senderId || !message.receiverId || !message.body) {
      ack?.({ ok: false, formError: "Message is missing required details." });
      return;
    }

    saveConversation(payload, message);
    saveMessage(message);

    io.to(`conversation:${message.conversationId}`).emit("message:new", message);
    io.to(`user:${message.receiverId}`).emit("conversation:upsert", {
      conversationId: message.conversationId,
      message,
      fromUser: payload.fromUser,
      job: payload.job || "Direct message",
    });
    io.to(`user:${message.receiverId}`).emit("notifications:refresh", { reason: "message" });
    io.to("admin").emit("admin:refresh", { reason: "message activity" });

    ack?.({ ok: true, message });
  });

  socket.on("conversation:clear", ({ conversationId, userId }, ack) => {
    const conversation = String(conversationId || "");
    const numericUserId = Number(userId);

    if (!conversation || !numericUserId || !canAccessConversation(numericUserId, conversation)) {
      ack?.({ ok: false, formError: "Could not clear this chat." });
      return;
    }

    const clearedAt = new Date().toISOString();
    db.prepare(
      `
        INSERT INTO "SocketConversationClear" (conversationId, userId, clearedAt)
        VALUES (?, ?, ?)
        ON CONFLICT(conversationId, userId) DO UPDATE SET clearedAt = excluded.clearedAt
      `,
    ).run(conversation, numericUserId, clearedAt);

    io.to(`user:${numericUserId}`).emit("conversation:cleared", {
      conversationId: conversation,
      userId: numericUserId,
    });
    ack?.({ ok: true });
  });
});

httpServer.listen(port, () => {
  console.log(`Socket.io server running on http://localhost:${port}`);
});

function saveConversation(payload, message) {
  const fromUser = payload.fromUser || {};
  const toUser = payload.toUser || {};
  const timestamp = message.createdAt;
  const senderId = Number(message.senderId);
  const receiverId = Number(message.receiverId);
  const userAId = Math.min(senderId, receiverId);
  const userBId = Math.max(senderId, receiverId);
  const senderName = String(fromUser.name || `User ${senderId}`);
  const receiverName = String(toUser.name || `User ${receiverId}`);
  const senderAvatar = fromUser.avatarUrl || null;
  const receiverAvatar = toUser.avatarUrl || null;
  const userAIsSender = userAId === senderId;

  db.prepare(
    `
      INSERT INTO "SocketConversation" (
        id,
        userAId,
        userBId,
        userAName,
        userBName,
        userAAvatarUrl,
        userBAvatarUrl,
        job,
        createdAt,
        updatedAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        userAName = COALESCE(NULLIF(excluded.userAName, ''), "SocketConversation".userAName),
        userBName = COALESCE(NULLIF(excluded.userBName, ''), "SocketConversation".userBName),
        userAAvatarUrl = COALESCE(excluded.userAAvatarUrl, "SocketConversation".userAAvatarUrl),
        userBAvatarUrl = COALESCE(excluded.userBAvatarUrl, "SocketConversation".userBAvatarUrl),
        job = COALESCE(NULLIF(excluded.job, ''), "SocketConversation".job),
        updatedAt = excluded.updatedAt
    `,
  ).run(
    message.conversationId,
    userAId,
    userBId,
    userAIsSender ? senderName : receiverName,
    userAIsSender ? receiverName : senderName,
    userAIsSender ? senderAvatar : receiverAvatar,
    userAIsSender ? receiverAvatar : senderAvatar,
    payload.job || "Direct message",
    timestamp,
    timestamp,
  );
}

function saveMessage(message) {
  db.prepare(
    `
      INSERT OR IGNORE INTO "SocketMessage" (
        id,
        conversationId,
        senderId,
        receiverId,
        body,
        kind,
        createdAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
  ).run(
    message.id,
    message.conversationId,
    message.senderId,
    message.receiverId,
    message.body,
    message.kind || "text",
    message.createdAt,
  );
}

function saveUserNotification(notification) {
  db.prepare(
    `
      INSERT INTO "UserNotification" (
        userId,
        type,
        title,
        description,
        href,
        createdAt,
        readAt,
        clearedAt
      )
      SELECT ?, ?, ?, ?, ?, ?, NULL, NULL
      WHERE NOT EXISTS (
        SELECT 1
        FROM "UserNotification"
        WHERE userId = ?
          AND title = ?
          AND description = ?
          AND COALESCE(href, '') = COALESCE(?, '')
          AND createdAt = ?
      )
    `,
  ).run(
    notification.userId,
    notification.type,
    notification.title,
    notification.description || "",
    notification.href || "/notifications",
    notification.createdAt,
    notification.userId,
    notification.title,
    notification.description || "",
    notification.href || "/notifications",
    notification.createdAt,
  );
}

function loadHistory(userId) {
  const conversations = db
    .prepare(
      `
        SELECT
          conversation.*,
          CASE
            WHEN lastMessage.kind = 'attachment' THEN 'Attachment'
            ELSE COALESCE(lastMessage.body, '')
          END AS preview,
          COALESCE(lastMessage.createdAt, conversation.updatedAt) AS lastMessageAt
        FROM "SocketConversation" conversation
        LEFT JOIN "SocketConversationClear" cleared
          ON cleared.conversationId = conversation.id AND cleared.userId = ?
        LEFT JOIN "SocketMessage" lastMessage
          ON lastMessage.id = (
            SELECT message.id
            FROM "SocketMessage" message
            WHERE message.conversationId = conversation.id
              AND (cleared.clearedAt IS NULL OR datetime(message.createdAt) > datetime(cleared.clearedAt))
            ORDER BY datetime(message.createdAt) DESC
            LIMIT 1
          )
        WHERE conversation.userAId = ? OR conversation.userBId = ?
        ORDER BY datetime(COALESCE(lastMessage.createdAt, conversation.updatedAt)) DESC
      `,
    )
    .all(userId, userId, userId)
    .map((conversation) => {
      const otherIsA = Number(conversation.userBId) === userId;

      return {
        id: conversation.id,
        otherUserId: otherIsA ? Number(conversation.userAId) : Number(conversation.userBId),
        otherUserName: otherIsA ? conversation.userAName : conversation.userBName,
        otherUserAvatarUrl: otherIsA ? conversation.userAAvatarUrl : conversation.userBAvatarUrl,
        job: conversation.job || "Direct message",
        preview: conversation.preview || "",
        time: formatTime(conversation.lastMessageAt),
        unread: 0,
      };
    });

  const messages = conversations.length
    ? db
        .prepare(
          `
            SELECT id, conversationId, senderId, receiverId, body, kind, createdAt
            FROM "SocketMessage"
            WHERE conversationId IN (${conversations.map(() => "?").join(",")})
              AND NOT EXISTS (
                SELECT 1
                FROM "SocketConversationClear" cleared
                WHERE cleared.conversationId = "SocketMessage".conversationId
                  AND cleared.userId = ?
                  AND datetime("SocketMessage".createdAt) <= datetime(cleared.clearedAt)
              )
            ORDER BY datetime(createdAt) ASC
          `,
        )
        .all(...conversations.map((conversation) => conversation.id), userId)
    : [];

  const messagesByConversation = {};

  for (const message of messages) {
    messagesByConversation[message.conversationId] ||= [];
    messagesByConversation[message.conversationId].push(message);
  }

  return {
    conversations,
    messagesByConversation,
  };
}

function canAccessConversation(userId, conversationId) {
  const conversation = db
    .prepare(
      `
        SELECT id
        FROM "SocketConversation"
        WHERE id = ? AND (userAId = ? OR userBId = ?)
        LIMIT 1
      `,
    )
    .get(conversationId, userId, userId);

  return Boolean(conversation);
}

function normalizeCallPayload(payload) {
  return {
    callId: String(payload?.callId || ""),
    conversationId: String(payload?.conversationId || ""),
    fromUserId: Number(payload?.fromUserId),
    toUserId: Number(payload?.toUserId),
  };
}

function normalizeProjectActivity(payload) {
  return {
    trackingId: Number(payload?.trackingId),
    actorId: Number(payload?.actorId),
    recipientId: Number(payload?.recipientId) || null,
    title: String(payload?.title || "").trim(),
    description: String(payload?.description || "").trim(),
    href: String(payload?.href || ""),
    createdAt: String(payload?.createdAt || new Date().toISOString()),
  };
}

function getProjectRoom(trackingId) {
  const numericTrackingId = Number(trackingId);

  return numericTrackingId ? `project:${numericTrackingId}` : "";
}

function emitCallSignal(call, eventName, payload) {
  io.to(`user:${call.toUserId}`).emit(eventName, payload);
}

function rememberCallSignal(callId, payload) {
  activeCalls.set(callId, {
    payload,
    candidatesByUserId: new Map(),
    createdAt: Date.now(),
  });
  cleanupOldCalls();
}

function rememberCallCandidate(callId, toUserId, payload) {
  const callState = activeCalls.get(callId) || {
    payload: null,
    candidatesByUserId: new Map(),
    createdAt: Date.now(),
  };
  const key = Number(toUserId);
  const candidates = callState.candidatesByUserId.get(key) || [];
  candidates.push(payload);
  callState.candidatesByUserId.set(key, candidates.slice(-25));
  activeCalls.set(callId, callState);
  cleanupOldCalls();
}

function flushBufferedCandidates(callId, toUserId, fromUserId) {
  const callState = activeCalls.get(callId);
  const candidates = callState?.candidatesByUserId.get(Number(toUserId)) || [];

  for (const candidate of candidates) {
    io.to(`user:${Number(toUserId)}`).emit("call:ice-candidate", {
      ...candidate,
      toUserId: Number(toUserId),
      fromUserId: Number(fromUserId),
    });
  }
}

function cleanupOldCalls() {
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const [callId, call] of activeCalls.entries()) {
    if (call.createdAt < cutoff) {
      activeCalls.delete(callId);
    }
  }
}

function formatTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
