class User {
  final int? id;
  final String role;
  final String fullName;
  final String email;
  final String? phone;
  final String? profilePhoto;
  final bool profileCompleted;
  final double walletBalance;
  final DateTime? createdAt;

  User({
    this.id,
    required this.role,
    required this.fullName,
    required this.email,
    this.phone,
    this.profilePhoto,
    this.profileCompleted = false,
    this.walletBalance = 0.0,
    this.createdAt,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'role': role,
      'full_name': fullName,
      'email': email,
      'phone': phone,
      'profile_photo': profilePhoto,
      'profile_completed': profileCompleted ? 1 : 0,
      'wallet_balance': walletBalance,
    };
  }

  factory User.fromMap(Map<String, dynamic> map) {
    return User(
      id: map['id'],
      role: map['role'] ?? '',
      fullName: map['full_name'] ?? '',
      email: map['email'] ?? '',
      phone: map['phone'],
      profilePhoto: map['profile_photo'],
      profileCompleted: map['profile_completed'] == 1,
      walletBalance: (map['wallet_balance'] as num?)?.toDouble() ?? 0.0,
      createdAt: map['created_at'] != null ? DateTime.parse(map['created_at']) : null,
    );
  }
}

class Category {
  final int id;
  final String name;
  final String? icon;

  Category({required this.id, required this.name, this.icon});

  factory Category.fromMap(Map<String, dynamic> map) {
    return Category(
      id: map['id'],
      name: map['name'],
      icon: map['icon'],
    );
  }
}

class Proposal {
  final int? id;
  final int jobId;
  final int professionalId;
  final String text;
  final double price;
  final String status;
  final DateTime? createdAt;
  
  // Extra fields for UI
  final String? professionalName;
  final String? professionalPhoto;
  final String? professionalTitle;

  Proposal({
    this.id,
    required this.jobId,
    required this.professionalId,
    required this.text,
    required this.price,
    this.status = 'pending',
    this.createdAt,
    this.professionalName,
    this.professionalPhoto,
    this.professionalTitle,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'job_id': jobId,
      'professional_id': professionalId,
      'text': text,
      'price': price,
      'status': status,
    };
  }

  factory Proposal.fromMap(Map<String, dynamic> map) {
    return Proposal(
      id: map['id'],
      jobId: map['job_id'],
      professionalId: map['professional_id'],
      text: map['text'] ?? '',
      price: (map['price'] as num?)?.toDouble() ?? 0.0,
      status: map['status'] ?? 'pending',
      createdAt: map['created_at'] != null ? DateTime.parse(map['created_at']) : null,
      professionalName: map['full_name'],
      professionalPhoto: map['profile_photo'],
      professionalTitle: map['profession'],
    );
  }
}

class Review {
  final int? id;
  final int jobId;
  final int fromUserId;
  final int toUserId;
  final double rating;
  final String comment;
  final String? reply;
  final DateTime? createdAt;
  final String? fromUserName;
  final String? fromUserPhoto;

  Review({
    this.id,
    required this.jobId,
    required this.fromUserId,
    required this.toUserId,
    required this.rating,
    required this.comment,
    this.reply,
    this.createdAt,
    this.fromUserName,
    this.fromUserPhoto,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'job_id': jobId,
      'from_user_id': fromUserId,
      'to_user_id': toUserId,
      'rating': rating,
      'comment': comment,
      'reply': reply,
    };
  }

  factory Review.fromMap(Map<String, dynamic> map) {
    return Review(
      id: map['id'],
      jobId: map['job_id'],
      fromUserId: map['from_user_id'],
      toUserId: map['to_user_id'],
      rating: (map['rating'] as num?)?.toDouble() ?? 0.0,
      comment: map['comment'] ?? '',
      reply: map['reply'],
      createdAt: map['created_at'] != null ? DateTime.parse(map['created_at']) : null,
      fromUserName: map['full_name'],
      fromUserPhoto: map['profile_photo'],
    );
  }
}

class AppNotification {
  final int id;
  final String title;
  final String message;
  final String type;
  final bool isRead;
  final DateTime createdAt;

  AppNotification({
    required this.id,
    required this.title,
    required this.message,
    required this.type,
    this.isRead = false,
    required this.createdAt,
  });

  factory AppNotification.fromMap(Map<String, dynamic> map) {
    return AppNotification(
      id: map['id'],
      title: map['title'] ?? '',
      message: map['message'] ?? '',
      type: map['type'] ?? 'system',
      isRead: map['is_read'] == 1,
      createdAt: DateTime.parse(map['created_at']),
    );
  }
}

class Transaction {
  final int id;
  final double amount;
  final String type;
  final String category;
  final String status;
  final String description;
  final DateTime createdAt;

  Transaction({
    required this.id,
    required this.amount,
    required this.type,
    required this.category,
    required this.status,
    required this.description,
    required this.createdAt,
  });

  factory Transaction.fromMap(Map<String, dynamic> map) {
    return Transaction(
      id: map['id'],
      amount: (map['amount'] as num?)?.toDouble() ?? 0.0,
      type: map['type'] ?? 'credit',
      category: map['category'] ?? 'payment',
      status: map['status'] ?? 'completed',
      description: map['description'] ?? '',
      createdAt: DateTime.parse(map['created_at']),
    );
  }
}
