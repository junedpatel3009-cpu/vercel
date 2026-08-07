import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../../core/api/api_client.dart';
import '../../core/auth/auth_service.dart';
import '../../core/theme/app_theme.dart';

class MessagesScreen extends StatefulWidget {
  final String? initialProfessionalId;
  final String? initialProfessionalName;
  final String? initialProfessionalAvatar;

  const MessagesScreen({
    super.key,
    this.initialProfessionalId,
    this.initialProfessionalName,
    this.initialProfessionalAvatar,
  });

  @override
  State<MessagesScreen> createState() => _MessagesScreenState();
}

class _MessagesScreenState extends State<MessagesScreen> {
  static const _configuredSocketUrl = String.fromEnvironment('SOCKET_URL', defaultValue: '');
  final _searchController = TextEditingController();
  final _messageController = TextEditingController();
  final List<Map<String, dynamic>> _conversations = [];
  List<Map<String, dynamic>> _professionals = [];
  final Map<String, int> _unreadCounts = {};
  final Set<String> _typingProfessionalIds = {};
  Map<String, dynamic>? _user;
  Map<String, dynamic>? _selectedConversation;
  io.Socket? _socket;
  bool _connecting = true;
  bool _otherTyping = false;
  bool _isProfessional = false;
  Timer? _typingTimer;

  String get _socketUrl => _configuredSocketUrl.isEmpty
      ? '${ApiClient.instance.baseUrl.replaceFirst(RegExp(r':5173$'), '')}:4001'
      : _configuredSocketUrl;

  @override
  void initState() {
    super.initState();
    _connect();
  }

  Future<void> _connect() async {
    final user = await AuthService().getUser();
    if (!mounted) return;
    if (user == null) {
      context.go('/login');
      return;
    }
    _user = user;
    _isProfessional = user['role'].toString().toLowerCase() == 'professional';
    if (!_isProfessional) _loadProfessionals();
    final socket = io.io(
      _socketUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({
            'userId': user['id'],
            'role': user['role'],
            'name': user['full_name'] ?? user['firstName'] ?? 'Servio user',
            'avatarUrl': user['profile_image'] ?? user['avatarUrl'],
          })
          .disableAutoConnect()
          .build(),
    );
    socket.onConnect((_) {
      socket.emit('notifications:subscribe', {'userId': user['id'], 'role': user['role']});
      _loadHistory();
      if (mounted) setState(() => _connecting = false);
    });
    socket.onConnectError((_) {
      if (mounted) setState(() => _connecting = false);
    });
    socket.on('conversation:upsert', _receiveConversationUpdate);
    socket.on('typing:start', _receiveTypingStart);
    socket.on('typing:stop', _receiveTypingStop);
    _socket = socket;
    if (widget.initialProfessionalId != null) {
      _openProfessional(widget.initialProfessionalId!, widget.initialProfessionalName ?? 'Professional', widget.initialProfessionalAvatar);
    }
    socket.connect();
  }

  Future<void> _loadProfessionals() async {
    try {
      final rows = await ApiClient.instance.getList('/api/v1/professionals?limit=50', authenticated: false);
      if (!mounted) return;
      setState(() {
        _professionals = rows.map((pro) => <String, dynamic>{
          'id': pro['id'].toString(),
          'name': '${pro['firstName'] ?? ''} ${pro['lastName'] ?? ''}'.trim(),
          'profession': pro['professionalCategory'] ?? 'Professional',
          'avatarUrl': pro['avatarUrl'],
        }).toList();
      });
    } catch (_) {}
  }

  /// Restores this user's saved conversations and messages from the
  /// database so a professional (who never browses a "find pros" style
  /// directory) sees the clients who already messaged them, and a client
  /// sees prior chats after reopening the app.
  void _loadHistory() {
    final user = _user;
    final socket = _socket;
    if (user == null || socket == null) return;
    socket.emitWithAck('history:load', {'userId': user['id']}, ack: (dynamic raw) {
      if (!mounted || raw is! Map) return;
      final conversationsRaw = raw['conversations'];
      final messagesRaw = raw['messagesByConversation'];
      if (conversationsRaw is! List) return;
      final messagesByConversation = messagesRaw is Map ? Map<String, dynamic>.from(messagesRaw) : <String, dynamic>{};
      setState(() {
        for (final item in conversationsRaw) {
          if (item is! Map) continue;
          final conversation = Map<String, dynamic>.from(item);
          final id = conversation['id']?.toString();
          if (id == null) continue;
          final rawMessages = messagesByConversation[id];
          final messages = rawMessages is List
              ? rawMessages.whereType<Map>().map((message) => Map<String, dynamic>.from(message)).toList()
              : <Map<String, dynamic>>[];
          final entry = <String, dynamic>{
            'id': id,
            'otherUserId': conversation['otherUserId']?.toString(),
            'name': conversation['otherUserName'] ?? 'Conversation',
            'avatarUrl': conversation['otherUserAvatarUrl'],
            'preview': conversation['preview'] ?? '',
            'messages': messages,
          };
          final index = _conversations.indexWhere((item) => item['id'] == id);
          if (index >= 0) {
            _conversations[index] = entry;
          } else {
            _conversations.add(entry);
          }
          socket.emit('conversation:join', {'conversationId': id});
        }
      });
    });
  }

  void _openProfessional(String professionalId, String name, String? avatarUrl) {
    final conversationId = _buildConversationId(_user?['id']?.toString() ?? '', professionalId);
    final existing = _conversations.indexWhere((item) => item['id'] == conversationId);
    final conversation = existing >= 0
        ? _conversations[existing]
        : <String, dynamic>{
            'id': conversationId,
            'otherUserId': professionalId,
            'name': name,
            'avatarUrl': avatarUrl,
            'preview': 'Start a conversation',
            'messages': <Map<String, dynamic>>[],
          };
    if (existing < 0) _conversations.insert(0, conversation);
    setState(() {
      _selectedConversation = conversation;
      _unreadCounts.remove(professionalId);
      _typingProfessionalIds.remove(professionalId);
    });
    _socket?.emit('conversation:join', {'conversationId': conversationId});
  }

  String _buildConversationId(String clientId, String professionalId) {
    return 'client-$clientId-pro-$professionalId';
  }

  void _receiveConversationUpdate(dynamic raw) {
    if (raw is! Map || !mounted) return;
    final payload = Map<String, dynamic>.from(raw);
    final message = payload['message'] is Map ? Map<String, dynamic>.from(payload['message']) : <String, dynamic>{};
    final from = payload['fromUser'] is Map ? Map<String, dynamic>.from(payload['fromUser']) : <String, dynamic>{};
    final id = (payload['conversationId'] ?? '').toString();
    if (id.isEmpty || message.isEmpty) return;
    setState(() {
      final index = _conversations.indexWhere((item) => item['id'] == id);
      final old = index >= 0 ? _conversations[index] : null;
      final entry = <String, dynamic>{
        'id': id,
        'otherUserId': old?['otherUserId'] ?? from['id']?.toString(),
        'name': old?['name'] ?? from['name'] ?? 'Conversation',
        'avatarUrl': old?['avatarUrl'] ?? from['avatarUrl'],
        'preview': message['body'] ?? 'New message',
        'messages': [...List<Map<String, dynamic>>.from(old?['messages'] ?? []), message],
      };
      if (index >= 0) {
        _conversations[index] = entry;
      } else {
        _conversations.insert(0, entry);
      }
      if (_selectedConversation?['id'] == id) {
        _selectedConversation = entry;
      } else if (entry['otherUserId'] != null) {
        final professionalId = entry['otherUserId'].toString();
        _unreadCounts[professionalId] = (_unreadCounts[professionalId] ?? 0) + 1;
      }
      _otherTyping = false;
    });
  }

  void _receiveTypingStart(dynamic raw) {
    if (raw is! Map) return;
    if (raw['userId']?.toString() == _user?['id']?.toString()) return;
    final professionalId = raw['userId'].toString();
    final isOpenConversation = raw['conversationId'] == _selectedConversation?['id'];
    _typingTimer?.cancel();
    if (mounted) {
      setState(() {
        if (isOpenConversation) {
          _otherTyping = true;
        }
        _typingProfessionalIds.add(professionalId);
      });
    }
    _typingTimer = Timer(const Duration(seconds: 2), () {
      if (mounted) {
        setState(() {
          if (isOpenConversation) {
            _otherTyping = false;
          }
          _typingProfessionalIds.remove(professionalId);
        });
      }
    });
  }

  void _receiveTypingStop(dynamic raw) {
    if (raw is! Map) return;
    if (mounted) {
      setState(() {
        if (raw['conversationId'] == _selectedConversation?['id']) {
          _otherTyping = false;
        }
        _typingProfessionalIds.remove(raw['userId'].toString());
      });
    }
  }

  void _sendTyping() {
    final conversation = _selectedConversation;
    final user = _user;
    if (conversation == null || user == null || conversation['otherUserId'] == null) return;
    _socket?.emit('typing:start', {
      'conversationId': conversation['id'],
      'userId': user['id'],
      'receiverId': conversation['otherUserId'],
      'name': user['full_name'] ?? user['firstName'] ?? 'Servio user',
    });
  }

  void _stopTyping() {
    final conversation = _selectedConversation;
    final user = _user;
    if (conversation == null || user == null) return;
    _socket?.emit('typing:stop', {
      'conversationId': conversation['id'],
      'userId': user['id'],
      'receiverId': conversation['otherUserId'],
    });
  }

  @override
  void dispose() {
    _socket?.disconnect();
    _typingTimer?.cancel();
    _searchController.dispose();
    _messageController.dispose();
    super.dispose();
  }

  /// Professionals never browse a "find professionals" directory here — they
  /// only see the clients who have already messaged them, sourced from the
  /// conversations loaded from the database.
  List<Map<String, dynamic>> get _directorySource => _isProfessional
      ? _conversations.map((conversation) => <String, dynamic>{
          'id': conversation['otherUserId'],
          'name': conversation['name'],
          'profession': 'Client',
          'avatarUrl': conversation['avatarUrl'],
        }).toList()
      : _professionals;

  @override
  Widget build(BuildContext context) {
    final query = _searchController.text.trim().toLowerCase();
    final pros = _directorySource.where((pro) => '${pro['name']} ${pro['profession']}'.toLowerCase().contains(query)).toList();
    return Scaffold(
      backgroundColor: AppTheme.bgLight,
      appBar: AppBar(
        title: const Text('Messages'),
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => Navigator.of(context).canPop() ? Navigator.pop(context) : context.go('/')),
        actions: [Padding(padding: const EdgeInsets.only(right: 16), child: Center(child: _statusChip()))],
      ),
      body: _selectedConversation == null ? _directory(pros) : _chat(),
    );
  }

  Widget _statusChip() => Container(
    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
    decoration: BoxDecoration(color: (_connecting ? Colors.orange : Colors.green).withValues(alpha: .12), borderRadius: BorderRadius.circular(20)),
    child: Text(_connecting ? 'Connecting' : 'Live', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: _connecting ? Colors.orange.shade800 : Colors.green.shade800)),
  );

  Widget _directory(List<Map<String, dynamic>> pros) => Container(
    decoration: const BoxDecoration(
      gradient: LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [Color(0xFFF7FAFF), Color(0xFFE9F1FF)],
      ),
    ),
    child: Column(children: [
    Padding(
      padding: const EdgeInsets.fromLTRB(20, 14, 20, 10),
      child: TextField(
        controller: _searchController,
        onChanged: (_) => setState(() {}),
        decoration: InputDecoration(prefixIcon: const Icon(Icons.search), hintText: _isProfessional ? 'Search client chats' : 'Search professionals or chats', filled: true, fillColor: Colors.white, border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none)),
      ),
    ),
    Expanded(child: ListView(children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 4),
        child: Text(_isProfessional ? 'Client messages' : 'Start a conversation', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 20, color: Color(0xFF102A5C))),
      ),
      Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 10),
        child: Text(_isProfessional ? 'Clients who message you will appear here.' : 'Choose a professional and start chatting instantly.', style: const TextStyle(color: AppTheme.textGray, fontSize: 13)),
      ),
      if (pros.isEmpty) Padding(padding: const EdgeInsets.all(20), child: Text(_isProfessional ? 'No client messages yet.' : 'No professionals found.', style: const TextStyle(color: AppTheme.textGray))),
      ...pros.map(_professionalTile),
    ])),
  ]),
  );

  Widget _professionalTile(Map<String, dynamic> pro) {
    final professionalId = pro['id'].toString();
    final conversation = _conversations.cast<Map<String, dynamic>?>().firstWhere(
      (item) => item?['otherUserId']?.toString() == professionalId,
      orElse: () => null,
    );
    final unread = _unreadCounts[professionalId] ?? 0;
    final isTyping = _typingProfessionalIds.contains(professionalId);
    return Padding(
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
    child: Material(
      color: Colors.white.withValues(alpha: .96),
      borderRadius: BorderRadius.circular(18),
      elevation: 1.5,
      shadowColor: const Color(0x1A1649A3),
      child: ListTile(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        leading: Stack(children: [
          CircleAvatar(radius: 25, backgroundColor: const Color(0xFFE3ECFF), backgroundImage: _avatar(pro['avatarUrl']), child: _avatar(pro['avatarUrl']) == null ? const Icon(Icons.person_outline, color: AppTheme.brandBlue) : null),
          Positioned(
            right: 0,
            bottom: 0,
            child: Container(
              width: 11,
              height: 11,
              decoration: BoxDecoration(
                color: isTyping ? const Color(0xFFF59E0B) : const Color(0xFF22C55E),
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 2),
              ),
            ),
          ),
        ]),
        title: Text(pro['name'] ?? 'Professional', style: const TextStyle(fontWeight: FontWeight.w800)),
        subtitle: Text(
          isTyping ? 'Typing...' : (conversation?['preview'] ?? pro['profession'] ?? 'Professional'),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(color: isTyping ? AppTheme.brandBlue : AppTheme.textGray, fontWeight: isTyping ? FontWeight.w700 : FontWeight.normal),
        ),
        trailing: unread > 0
            ? SizedBox(
                width: 24,
                height: 24,
                child: DecoratedBox(
                  decoration: const BoxDecoration(color: AppTheme.brandBlue, shape: BoxShape.circle),
                  child: Center(child: Text(unread > 99 ? '99+' : '$unread', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 10))),
                ),
              )
            : const Icon(Icons.chat_bubble_outline, color: AppTheme.brandBlue),
        onTap: () => _openProfessional(pro['id'].toString(), pro['name'].toString(), pro['avatarUrl']?.toString()),
      ),
    ),
    );
  }

  Widget _chat() {
    final conversation = _selectedConversation!;
    final messages = List<Map<String, dynamic>>.from(conversation['messages'] ?? []);
    return Column(children: [
      _chatHeader(conversation),
      Expanded(child: DecoratedBox(
        decoration: const BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFFF8FBFF), Color(0xFFEAF2FF)])),
        child: messages.isEmpty ? _emptyChat(conversation) : ListView.builder(padding: const EdgeInsets.all(18), itemCount: messages.length, itemBuilder: (_, index) => _bubble(messages[index])),
      )),
      if (_otherTyping) const Padding(padding: EdgeInsets.symmetric(vertical: 5), child: Text('Typing...', style: TextStyle(fontSize: 12, color: AppTheme.textGray))),
      if (messages.isEmpty) _quickReplies(),
      _composer(),
    ]);
  }

  Widget _chatHeader(Map<String, dynamic> conversation) => Container(
    padding: const EdgeInsets.fromLTRB(10, 8, 14, 10),
    color: Colors.white,
    child: Row(children: [
      IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => setState(() => _selectedConversation = null)),
      CircleAvatar(backgroundImage: _avatar(conversation['avatarUrl']), child: _avatar(conversation['avatarUrl']) == null ? const Icon(Icons.person_outline) : null),
      const SizedBox(width: 10),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(conversation['name'] ?? 'Conversation', style: const TextStyle(fontWeight: FontWeight.w800)), Text(_otherTyping ? 'Typing...' : 'Active now', style: TextStyle(fontSize: 12, color: _otherTyping ? AppTheme.brandBlue : const Color(0xFF16A34A)))])),
      IconButton(onPressed: () => _comingSoon('Voice calls'), icon: const Icon(Icons.call_outlined)),
      IconButton(onPressed: () => _comingSoon('Video calls'), icon: const Icon(Icons.videocam_outlined)),
    ]),
  );

  Widget _emptyChat(Map<String, dynamic> conversation) => Center(child: Padding(
    padding: const EdgeInsets.all(30),
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      CircleAvatar(radius: 38, backgroundImage: _avatar(conversation['avatarUrl']), child: _avatar(conversation['avatarUrl']) == null ? const Icon(Icons.forum_outlined, size: 34) : null),
      const SizedBox(height: 16),
      Text('What would you like to ask ${conversation['name'] ?? ''}?', textAlign: TextAlign.center, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
      const SizedBox(height: 8),
      const Text('Ask about availability, budget, or how they can help with your project.', textAlign: TextAlign.center, style: TextStyle(color: AppTheme.textGray)),
    ]),
  ));

  Widget _quickReplies() => Container(
    color: const Color(0xFFEAF2FF),
    height: 48,
    child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6), children: [
      _quickReply('Hi, I am interested in your service'),
      _quickReply('Are you available this week?'),
      _quickReply('Can we discuss my project?'),
    ]),
  );

  Widget _quickReply(String text) => Padding(padding: const EdgeInsets.only(right: 8), child: ActionChip(label: Text(text, style: const TextStyle(fontSize: 12)), onPressed: () { _messageController.text = text; _sendMessage(); }));

  Widget _bubble(Map<String, dynamic> message) {
    final mine = message['senderId']?.toString() == _user?['id']?.toString();
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 280),
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(color: mine ? AppTheme.brandBlue : Colors.white, borderRadius: BorderRadius.circular(18), boxShadow: const [BoxShadow(color: Color(0x120F172A), blurRadius: 8)]),
        child: Text(message['body']?.toString() ?? '', style: TextStyle(color: mine ? Colors.white : const Color(0xFF1F2937))),
      ),
    );
  }

  Widget _composer() => SafeArea(top: false, child: Container(
    color: Colors.white,
    padding: const EdgeInsets.fromLTRB(12, 9, 12, 12),
    child: Row(children: [
      IconButton(onPressed: () => _comingSoon('Attachments'), icon: const Icon(Icons.add_circle_outline, color: AppTheme.brandBlue)),
      Expanded(child: TextField(controller: _messageController, enabled: _socket?.connected == true, onChanged: (_) => _sendTyping(), onSubmitted: (_) => _sendMessage(), decoration: InputDecoration(hintText: _socket?.connected == true ? 'Write a message...' : 'Connecting...', filled: true, fillColor: const Color(0xFFF2F5FA), border: OutlineInputBorder(borderRadius: BorderRadius.circular(24), borderSide: BorderSide.none)))),
      IconButton(onPressed: () => _comingSoon('Voice messages'), icon: const Icon(Icons.mic_none, color: AppTheme.brandBlue)),
      CircleAvatar(backgroundColor: AppTheme.brandBlue, child: IconButton(icon: const Icon(Icons.send_rounded, color: Colors.white, size: 18), onPressed: _socket?.connected == true ? _sendMessage : null)),
    ]),
  ));

  ImageProvider? _avatar(dynamic value) {
    final url = value?.toString() ?? '';
    return url.startsWith('http://') || url.startsWith('https://') ? NetworkImage(url) : null;
  }

  void _sendMessage() {
    final conversation = _selectedConversation;
    final user = _user;
    final body = _messageController.text.trim();
    final receiverId = conversation?['otherUserId']?.toString();
    if (conversation == null || user == null || receiverId == null || receiverId.isEmpty || body.isEmpty) return;
    final message = <String, dynamic>{'body': body, 'createdAt': DateTime.now().toIso8601String(), 'senderId': user['id']};
    _socket?.emit('message:send', {
      'conversationId': conversation['id'], 'senderId': user['id'], 'receiverId': receiverId, 'body': body, 'kind': 'text',
      'toUser': {'id': receiverId, 'name': conversation['name'], 'avatarUrl': conversation['avatarUrl']},
      'fromUser': {'id': user['id'], 'name': user['full_name'] ?? user['firstName'] ?? 'Servio user', 'avatarUrl': user['profile_image'] ?? user['avatarUrl']},
    });
    _stopTyping();
    setState(() {
      conversation['messages'] = [...List<Map<String, dynamic>>.from(conversation['messages'] ?? []), message];
      conversation['preview'] = body;
    });
    _messageController.clear();
  }

  void _comingSoon(String feature) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$feature will be available soon.')));
}
