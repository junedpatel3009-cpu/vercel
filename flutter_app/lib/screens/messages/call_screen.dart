import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../../core/theme/app_theme.dart';

/// A live voice/video call screen driven by the same socket.io signaling
/// protocol the website uses (call:invite/answer/ice-candidate/end), so a
/// call started on the website can be answered here and vice versa.
class CallScreen extends StatefulWidget {
  const CallScreen({
    super.key,
    required this.socket,
    required this.callId,
    required this.conversationId,
    required this.selfUserId,
    required this.peerUserId,
    required this.mode,
    required this.initialStatus,
    required this.peerName,
    required this.selfName,
    this.peerAvatarUrl,
    this.selfAvatarUrl,
    this.offer,
  });

  final io.Socket socket;
  final String callId;
  final String conversationId;
  final dynamic selfUserId;
  final dynamic peerUserId;
  final String mode; // 'voice' or 'video'
  final String initialStatus; // 'outgoing' or 'incoming'
  final String peerName;
  final String selfName;
  final String? peerAvatarUrl;
  final String? selfAvatarUrl;
  final Map<String, dynamic>? offer;

  @override
  State<CallScreen> createState() => _CallScreenState();
}

class _CallScreenState extends State<CallScreen> {
  late String _status;
  RTCPeerConnection? _pc;
  MediaStream? _localStream;
  MediaStream? _remoteStream;
  final _localRenderer = RTCVideoRenderer();
  final _remoteRenderer = RTCVideoRenderer();
  bool _renderersReady = false;
  bool _muted = false;
  bool _speakerOn = true;
  bool _cameraOff = false;
  bool _remoteDescriptionSet = false;
  bool _ended = false;
  final List<RTCIceCandidate> _pendingCandidates = [];
  Timer? _timer;
  int _seconds = 0;

  bool get _isVideo => widget.mode == 'video';

  @override
  void initState() {
    super.initState();
    _status = widget.initialStatus;
    _initRenderers();
    widget.socket.on('call:answered', _onAnswered);
    widget.socket.on('call:ice-candidate', _onRemoteIceCandidate);
    widget.socket.on('call:ended', _onRemoteEnded);
    if (widget.initialStatus == 'outgoing') {
      _startOutgoingCall();
    }
  }

  Future<void> _initRenderers() async {
    await _localRenderer.initialize();
    await _remoteRenderer.initialize();
    if (mounted) setState(() => _renderersReady = true);
  }

  Future<bool> _ensurePermissions() async {
    final statuses = await [
      Permission.microphone,
      if (_isVideo) Permission.camera,
    ].request();
    return statuses.values.every((status) => status.isGranted);
  }

  Future<MediaStream> _acquireLocalStream() async {
    final constraints = <String, dynamic>{
      'audio': true,
      'video': _isVideo ? {'facingMode': 'user', 'width': 1280, 'height': 720} : false,
    };
    final stream = await navigator.mediaDevices.getUserMedia(constraints);
    _localStream = stream;
    _localRenderer.srcObject = stream;
    return stream;
  }

  Future<RTCPeerConnection> _createPeerConnection() async {
    final pc = await createPeerConnection({
      'iceServers': [
        {'urls': 'stun:stun.l.google.com:19302'},
      ],
    });
    pc.onIceCandidate = (candidate) {
      if (candidate.candidate == null || candidate.candidate!.isEmpty) return;
      widget.socket.emit('call:ice-candidate', {
        'callId': widget.callId,
        'conversationId': widget.conversationId,
        'fromUserId': widget.selfUserId,
        'toUserId': widget.peerUserId,
        'candidate': {
          'candidate': candidate.candidate,
          'sdpMid': candidate.sdpMid,
          'sdpMLineIndex': candidate.sdpMLineIndex,
        },
      });
    };
    pc.onTrack = (event) {
      if (event.streams.isEmpty) return;
      _remoteStream = event.streams.first;
      _remoteRenderer.srcObject = _remoteStream;
      if (mounted) setState(() {});
    };
    pc.onConnectionState = (state) {
      if (state == RTCPeerConnectionState.RTCPeerConnectionStateFailed ||
          state == RTCPeerConnectionState.RTCPeerConnectionStateClosed ||
          state == RTCPeerConnectionState.RTCPeerConnectionStateDisconnected) {
        _finishCall(notifyPeer: false);
      }
    };
    _pc = pc;
    return pc;
  }

  Future<void> _startOutgoingCall() async {
    try {
      final granted = await _ensurePermissions();
      if (!granted) {
        _showError('Camera/microphone permission is required to start a call.');
        _finishCall(notifyPeer: false);
        return;
      }
      final stream = await _acquireLocalStream();
      final pc = await _createPeerConnection();
      for (final track in stream.getTracks()) {
        await pc.addTrack(track, stream);
      }
      final offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      widget.socket.emit('call:invite', {
        'callId': widget.callId,
        'conversationId': widget.conversationId,
        'fromUserId': widget.selfUserId,
        'toUserId': widget.peerUserId,
        'fromName': widget.selfName,
        'fromAvatarUrl': widget.selfAvatarUrl,
        'job': 'Direct call',
        'mode': widget.mode,
        'offer': {'sdp': offer.sdp, 'type': offer.type},
      });
    } catch (_) {
      _showError('Could not start the call.');
      _finishCall(notifyPeer: false);
    }
  }

  Future<void> _acceptIncomingCall() async {
    final offer = widget.offer;
    if (offer == null) return;
    try {
      final granted = await _ensurePermissions();
      if (!granted) {
        _showError('Camera/microphone permission is required to answer.');
        _finishCall(notifyPeer: true);
        return;
      }
      final stream = await _acquireLocalStream();
      final pc = await _createPeerConnection();
      for (final track in stream.getTracks()) {
        await pc.addTrack(track, stream);
      }
      await pc.setRemoteDescription(
        RTCSessionDescription(offer['sdp'] as String, offer['type'] as String),
      );
      _remoteDescriptionSet = true;
      await _flushPendingCandidates();
      final answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      widget.socket.emit('call:answer', {
        'callId': widget.callId,
        'conversationId': widget.conversationId,
        'fromUserId': widget.selfUserId,
        'toUserId': widget.peerUserId,
        'answer': {'sdp': answer.sdp, 'type': answer.type},
        'startedAt': DateTime.now().toIso8601String(),
      });
      if (mounted) setState(() => _status = 'active');
      _startTimer();
    } catch (_) {
      _showError('Could not answer the call.');
      _finishCall(notifyPeer: true);
    }
  }

  void _declineIncomingCall() {
    widget.socket.emit('call:end', {
      'callId': widget.callId,
      'conversationId': widget.conversationId,
      'fromUserId': widget.selfUserId,
      'toUserId': widget.peerUserId,
      'reason': 'declined',
    });
    _finishCall(notifyPeer: false);
  }

  Future<void> _onAnswered(dynamic raw) async {
    if (raw is! Map || raw['callId']?.toString() != widget.callId || _pc == null) return;
    final answer = raw['answer'];
    if (answer is! Map) return;
    try {
      await _pc!.setRemoteDescription(
        RTCSessionDescription(answer['sdp'] as String, answer['type'] as String),
      );
      _remoteDescriptionSet = true;
      await _flushPendingCandidates();
      if (mounted) setState(() => _status = 'active');
      _startTimer();
    } catch (_) {}
  }

  Future<void> _onRemoteIceCandidate(dynamic raw) async {
    if (raw is! Map || raw['callId']?.toString() != widget.callId) return;
    final candidateMap = raw['candidate'];
    if (candidateMap is! Map) return;
    final sdpMLineIndex = candidateMap['sdpMLineIndex'];
    final candidate = RTCIceCandidate(
      candidateMap['candidate'] as String?,
      candidateMap['sdpMid'] as String?,
      sdpMLineIndex is int ? sdpMLineIndex : int.tryParse('$sdpMLineIndex'),
    );
    if (_pc == null || !_remoteDescriptionSet) {
      _pendingCandidates.add(candidate);
      return;
    }
    try {
      await _pc!.addCandidate(candidate);
    } catch (_) {}
  }

  Future<void> _flushPendingCandidates() async {
    final pc = _pc;
    if (pc == null) return;
    for (final candidate in _pendingCandidates) {
      try {
        await pc.addCandidate(candidate);
      } catch (_) {}
    }
    _pendingCandidates.clear();
  }

  void _onRemoteEnded(dynamic raw) {
    if (raw is! Map || raw['callId']?.toString() != widget.callId) return;
    _finishCall(notifyPeer: false);
  }

  void _startTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() => _seconds++);
    });
  }

  void _finishCall({required bool notifyPeer}) {
    if (_ended) return;
    _ended = true;
    _timer?.cancel();
    if (notifyPeer) {
      widget.socket.emit('call:end', {
        'callId': widget.callId,
        'conversationId': widget.conversationId,
        'fromUserId': widget.selfUserId,
        'toUserId': widget.peerUserId,
      });
    }
    widget.socket.off('call:answered', _onAnswered);
    widget.socket.off('call:ice-candidate', _onRemoteIceCandidate);
    widget.socket.off('call:ended', _onRemoteEnded);
    _pc?.close();
    _pc = null;
    _localStream?.getTracks().forEach((track) => track.stop());
    _localStream = null;
    _remoteStream?.getTracks().forEach((track) => track.stop());
    _remoteStream = null;
    if (mounted && Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
    }
  }

  void _showError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  void _toggleMute() {
    final tracks = _localStream?.getAudioTracks() ?? [];
    if (tracks.isEmpty) return;
    setState(() {
      _muted = !_muted;
      for (final track in tracks) {
        track.enabled = !_muted;
      }
    });
  }

  void _toggleCamera() {
    final tracks = _localStream?.getVideoTracks() ?? [];
    if (tracks.isEmpty) return;
    setState(() {
      _cameraOff = !_cameraOff;
      for (final track in tracks) {
        track.enabled = !_cameraOff;
      }
    });
  }

  void _toggleSpeaker() {
    setState(() => _speakerOn = !_speakerOn);
    Helper.setSpeakerphoneOn(_speakerOn);
  }

  void _switchCamera() {
    final tracks = _localStream?.getVideoTracks() ?? [];
    if (tracks.isEmpty) return;
    Helper.switchCamera(tracks.first);
  }

  @override
  void dispose() {
    _timer?.cancel();
    widget.socket.off('call:answered', _onAnswered);
    widget.socket.off('call:ice-candidate', _onRemoteIceCandidate);
    widget.socket.off('call:ended', _onRemoteEnded);
    _pc?.close();
    _localStream?.getTracks().forEach((track) => track.stop());
    _remoteStream?.getTracks().forEach((track) => track.stop());
    _localRenderer.dispose();
    _remoteRenderer.dispose();
    super.dispose();
  }

  String _formatDuration(int seconds) {
    final m = (seconds ~/ 60).toString().padLeft(2, '0');
    final s = (seconds % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  ImageProvider? _networkAvatar(String? value) {
    final url = value ?? '';
    return url.startsWith('http://') || url.startsWith('https://') ? NetworkImage(url) : null;
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        _finishCall(notifyPeer: true);
      },
      child: Scaffold(
        backgroundColor: AppTheme.brandNavy,
        body: SafeArea(
          child: _status == 'active' && _isVideo ? _videoActiveLayout() : _voiceOrRingingLayout(),
        ),
      ),
    );
  }

  Widget _voiceOrRingingLayout() {
    final subtitle = switch (_status) {
      'incoming' => 'Incoming ${_isVideo ? 'video' : 'voice'} call',
      'outgoing' => 'Calling...',
      _ => _formatDuration(_seconds),
    };
    return Column(
      children: [
        const Spacer(),
        CircleAvatar(
          radius: 64,
          backgroundColor: Colors.white24,
          backgroundImage: _networkAvatar(widget.peerAvatarUrl),
          child: _networkAvatar(widget.peerAvatarUrl) == null
              ? const Icon(Icons.person, size: 60, color: Colors.white)
              : null,
        ),
        const SizedBox(height: 20),
        Text(widget.peerName, style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w800)),
        const SizedBox(height: 8),
        Text(subtitle, style: const TextStyle(color: Colors.white70, fontSize: 15)),
        const Spacer(),
        _controls(),
        const SizedBox(height: 40),
      ],
    );
  }

  Widget _videoActiveLayout() {
    return Stack(
      children: [
        Positioned.fill(
          child: _renderersReady && _remoteRenderer.srcObject != null
              ? RTCVideoView(_remoteRenderer, objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitCover)
              : Container(
                  color: AppTheme.brandNavy,
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        CircleAvatar(
                          radius: 56,
                          backgroundColor: Colors.white24,
                          backgroundImage: _networkAvatar(widget.peerAvatarUrl),
                          child: _networkAvatar(widget.peerAvatarUrl) == null
                              ? const Icon(Icons.person, size: 50, color: Colors.white)
                              : null,
                        ),
                        const SizedBox(height: 16),
                        Text(widget.peerName, style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800)),
                        const SizedBox(height: 6),
                        const Text('Connecting video...', style: TextStyle(color: Colors.white70)),
                      ],
                    ),
                  ),
                ),
        ),
        Positioned(
          top: 16,
          right: 16,
          width: 110,
          height: 150,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(14),
            child: _renderersReady && _localStream != null && !_cameraOff
                ? RTCVideoView(_localRenderer, mirror: true, objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitCover)
                : Container(color: Colors.black45, child: const Icon(Icons.videocam_off, color: Colors.white54)),
          ),
        ),
        Positioned(
          top: 16,
          left: 16,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(color: Colors.black45, borderRadius: BorderRadius.circular(20)),
            child: Text(_formatDuration(_seconds), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
          ),
        ),
        Positioned(
          left: 0,
          right: 0,
          bottom: 24,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              _circleButton(icon: _muted ? Icons.mic_off : Icons.mic, color: Colors.white24, onTap: _toggleMute, label: _muted ? 'Unmute' : 'Mute'),
              _circleButton(icon: _cameraOff ? Icons.videocam_off : Icons.videocam, color: Colors.white24, onTap: _toggleCamera, label: 'Camera'),
              _circleButton(icon: Icons.call_end, color: Colors.red, onTap: () => _finishCall(notifyPeer: true), label: 'End'),
              _circleButton(icon: Icons.cameraswitch, color: Colors.white24, onTap: _switchCamera, label: 'Flip'),
              _circleButton(icon: _speakerOn ? Icons.volume_up : Icons.hearing, color: Colors.white24, onTap: _toggleSpeaker, label: 'Speaker'),
            ],
          ),
        ),
      ],
    );
  }

  Widget _controls() {
    if (_status == 'incoming') {
      return Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          _circleButton(icon: Icons.call_end, color: Colors.red, onTap: _declineIncomingCall, label: 'Decline'),
          _circleButton(icon: Icons.call, color: Colors.green, onTap: _acceptIncomingCall, label: 'Accept'),
        ],
      );
    }
    if (_status == 'outgoing') {
      return _circleButton(icon: Icons.call_end, color: Colors.red, onTap: () => _finishCall(notifyPeer: true), label: 'Cancel');
    }
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: [
        _circleButton(icon: _muted ? Icons.mic_off : Icons.mic, color: Colors.white24, onTap: _toggleMute, label: _muted ? 'Unmute' : 'Mute'),
        _circleButton(icon: Icons.call_end, color: Colors.red, onTap: () => _finishCall(notifyPeer: true), label: 'End'),
        _circleButton(icon: _speakerOn ? Icons.volume_up : Icons.hearing, color: Colors.white24, onTap: _toggleSpeaker, label: 'Speaker'),
      ],
    );
  }

  Widget _circleButton({required IconData icon, required Color color, required VoidCallback onTap, required String label}) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        InkWell(
          borderRadius: BorderRadius.circular(36),
          onTap: onTap,
          child: CircleAvatar(radius: 30, backgroundColor: color, child: Icon(icon, color: Colors.white, size: 26)),
        ),
        const SizedBox(height: 6),
        Text(label, style: const TextStyle(color: Colors.white70, fontSize: 12)),
      ],
    );
  }
}
