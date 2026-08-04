import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../../core/api/api_client.dart';
import '../../core/auth/auth_service.dart';
import '../../core/theme/app_theme.dart';

class MessagesScreen extends StatefulWidget {
  const MessagesScreen({super.key});

  @override
  State<MessagesScreen> createState() => _MessagesScreenState();
}

class _MessagesScreenState extends State<MessagesScreen> {
  static const _configuredSocketUrl = String.fromEnvironment('SOCKET_URL', defaultValue: '');
  final _searchController = TextEditingController();
  final _messageController = TextEditingController();
  final List<Map<String, dynamic>> _conversations = [];
  io.Socket? _socket;
  Map<String, dynamic>? _selectedConversation;
  bool _connecting = true;

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
      if (mounted) setState(() => _connecting = false);
    });
    socket.onConnectError((_) {
      if (mounted) setState(() => _connecting = false);
    });
    socket.on('conversation:upsert', _receiveConversationUpdate);
    socket.connect();
    _socket = socket;
  }

  void _receiveConversationUpdate(dynamic raw) {
    if (raw is! Map) return;
    final payload = Map<String, dynamic>.from(raw);
    final message = payload['message'] is Map ? Map<String, dynamic>.from(payload['message']) : <String, dynamic>{};
    final fromUser = payload['fromUser'] is Map ? Map<String, dynamic>.from(payload['fromUser']) : <String, dynamic>{};
    final id = (payload['conversationId'] ?? '').toString();
    if (id.isEmpty || message.isEmpty || !mounted) return;

    setState(() {
      final index = _conversations.indexWhere((item) => item['id'] == id);
      final entry = <String, dynamic>{
        'id': id,
        'name': fromUser['name'] ?? 'Conversation',
        'avatarUrl': fromUser['avatarUrl'],
        'preview': message['body'] ?? 'New message',
        'time': message['createdAt'] ?? DateTime.now().toIso8601String(),
        'messages': [message],
      };
      if (index >= 0) {
        final messages = List<Map<String, dynamic>>.from(_conversations[index]['messages'] ?? [])..add(message);
        entry['messages'] = messages;
        _conversations[index] = entry;
      } else {
        _conversations.insert(0, entry);
      }
      _selectedConversation ??= entry;
    });
  }

  @override
  void dispose() {
    _socket?.disconnect();
    _searchController.dispose();
    _messageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final query = _searchController.text.trim().toLowerCase();
    final conversations = _conversations.where((item) => '${item['name']} ${item['preview']}'.toLowerCase().contains(query)).toList();
    return Scaffold(
      backgroundColor: AppTheme.bgLight,
      appBar: AppBar(
        title: const Text('Messages'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.of(context).canPop() ? Navigator.of(context).pop() : context.go('/'),
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Center(child: _statusChip()),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 10),
            child: TextField(
              controller: _searchController,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Search conversations'),
            ),
          ),
          Expanded(
            child: _selectedConversation == null
                ? _conversationList(conversations)
                : _conversationDetail(),
          ),
        ],
      ),
    );
  }

  Widget _statusChip() => Container(
    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
    decoration: BoxDecoration(color: (_connecting ? Colors.orange : Colors.green).withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
    child: Text(_connecting ? 'Connecting' : 'Live', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: _connecting ? Colors.orange.shade800 : Colors.green.shade800)),
  );

  Widget _conversationList(List<Map<String, dynamic>> conversations) {
    if (conversations.isEmpty) {
      return const Center(child: Padding(
        padding: EdgeInsets.all(32),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.forum_outlined, size: 56, color: AppTheme.textGray),
          SizedBox(height: 14),
          Text('No conversations yet', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
          SizedBox(height: 8),
          Text('Messages from professionals and clients will appear here.', textAlign: TextAlign.center, style: TextStyle(color: AppTheme.textGray)),
        ]),
      ));
    }
    return ListView.separated(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      itemCount: conversations.length,
      separatorBuilder: (_, __) => const Divider(height: 1),
      itemBuilder: (context, index) {
        final item = conversations[index];
        return ListTile(
          contentPadding: const EdgeInsets.symmetric(vertical: 8),
          leading: CircleAvatar(child: Text((item['name'] ?? '?').toString().substring(0, 1).toUpperCase())),
          title: Text(item['name'] ?? 'Conversation', style: const TextStyle(fontWeight: FontWeight.w800)),
          subtitle: Text(item['preview'] ?? '', maxLines: 1, overflow: TextOverflow.ellipsis),
          trailing: const Icon(Icons.chevron_right),
          onTap: () => setState(() => _selectedConversation = item),
        );
      },
    );
  }

  Widget _conversationDetail() {
    final conversation = _selectedConversation!;
    final messages = List<Map<String, dynamic>>.from(conversation['messages'] ?? []);
    return Column(children: [
      ListTile(
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => setState(() => _selectedConversation = null)),
        title: Text(conversation['name'] ?? 'Conversation', style: const TextStyle(fontWeight: FontWeight.w800)),
      ),
      Expanded(child: ListView.builder(
        padding: const EdgeInsets.all(20),
        itemCount: messages.length,
        itemBuilder: (_, index) => Align(
          alignment: Alignment.centerLeft,
          child: Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
            child: Text(messages[index]['body']?.toString() ?? ''),
          ),
        ),
      )),
      SafeArea(child: Padding(
        padding: const EdgeInsets.all(12),
        child: TextField(
          controller: _messageController,
          enabled: false,
          decoration: const InputDecoration(
            hintText: 'Sending will be enabled when the message API is connected',
            suffixIcon: Icon(Icons.send),
          ),
        ),
      )),
    ]);
  }
}
