import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';

class DatabaseHelper {
  static final DatabaseHelper _instance = DatabaseHelper._internal();
  static Database? _database;

  factory DatabaseHelper() => _instance;

  DatabaseHelper._internal();

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDatabase();
    return _database!;
  }

  Future<Database> _initDatabase() async {
    String path = join(await getDatabasesPath(), 'servio_v1.db');
    
    // Keep the on-device database between app launches. Deleting it here
    // recreated the schema and seed data every time a screen accessed SQLite,
    // so locally stored jobs, notifications, and favourites never persisted.

    return await openDatabase(
      path,
      version: 1, 
      onCreate: _onCreate,
      onConfigure: (db) async {
        await db.execute('PRAGMA foreign_keys = ON');
      },
    );
  }

  Future _onCreate(Database db, int version) async {
    // 1. users
    await db.execute('''
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT, -- 'client' or 'professional'
        full_name TEXT,
        email TEXT UNIQUE,
        phone TEXT,
        password_hash TEXT,
        profile_photo TEXT,
        profile_completed INTEGER DEFAULT 0,
        account_status TEXT DEFAULT 'active',
        biometric_enabled INTEGER DEFAULT 0,
        biometric_type TEXT, -- 'fingerprint' or 'face'
        wallet_balance REAL DEFAULT 0.0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    ''');

    // 2. clients
    await db.execute('''
      CREATE TABLE clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        client_id TEXT UNIQUE,
        address TEXT,
        city TEXT,
        state TEXT,
        country TEXT,
        pincode TEXT,
        latitude REAL,
        longitude REAL,
        language TEXT,
        email_verified INTEGER DEFAULT 0,
        phone_verified INTEGER DEFAULT 0,
        notification_settings TEXT,
        privacy_settings TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    ''');

    // 3. professionals
    await db.execute('''
      CREATE TABLE professionals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        professional_id TEXT UNIQUE,
        profession TEXT,
        service_category_id INTEGER,
        subcategory_id INTEGER,
        experience INTEGER,
        skills TEXT, -- Comma separated
        about TEXT,
        languages TEXT,
        hourly_rate REAL,
        daily_rate REAL,
        service_radius REAL,
        availability INTEGER DEFAULT 1,
        working_days TEXT,
        working_hours TEXT,
        address TEXT,
        city TEXT,
        state TEXT,
        country TEXT,
        pincode TEXT,
        latitude REAL,
        longitude REAL,
        certificates TEXT,
        government_id TEXT,
        professional_license TEXT,
        insurance TEXT,
        email_verified INTEGER DEFAULT 0,
        phone_verified INTEGER DEFAULT 0,
        verification_status TEXT DEFAULT 'pending',
        average_rating REAL DEFAULT 0.0,
        total_reviews INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    ''');

    // 4. Categories & Subcategories
    await db.execute('''
      CREATE TABLE categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        icon TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    ''');

    await db.execute('''
      CREATE TABLE subcategories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER,
        name TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE
      )
    ''');

    // 5. Jobs
    await db.execute('''
      CREATE TABLE jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER,
        title TEXT,
        category_id INTEGER,
        subcategory_id INTEGER,
        description TEXT,
        service_type TEXT,
        priority TEXT,
        address TEXT,
        city TEXT,
        state TEXT,
        country TEXT,
        pincode TEXT,
        latitude REAL,
        longitude REAL,
        is_remote INTEGER DEFAULT 0,
        start_date TEXT,
        start_time TEXT,
        duration TEXT,
        deadline TEXT,
        flexible_schedule INTEGER DEFAULT 0,
        budget_type TEXT,
        min_budget REAL,
        max_budget REAL,
        currency TEXT DEFAULT 'USD',
        special_instructions TEXT,
        required_skills TEXT,
        professionals_required INTEGER DEFAULT 1,
        status TEXT DEFAULT 'draft', -- 'draft', 'active', 'assigned', 'completed', 'cancelled'
        assigned_to_id INTEGER, -- user_id of professional
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_to_id) REFERENCES users (id) ON DELETE SET NULL,
        FOREIGN KEY (category_id) REFERENCES categories (id),
        FOREIGN KEY (subcategory_id) REFERENCES subcategories (id)
      )
    ''');

    await db.execute('''
      CREATE TABLE job_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id INTEGER,
        image_url TEXT,
        FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE
      )
    ''');

    await db.execute('''
      CREATE TABLE job_documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id INTEGER,
        file_name TEXT,
        file_url TEXT,
        FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE
      )
    ''');

    // 6. Proposals
    await db.execute('''
      CREATE TABLE proposals (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        job_id INTEGER, 
        professional_id INTEGER, -- user_id
        text TEXT, 
        price REAL, 
        status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'rejected', 'withdrawn'
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE,
        FOREIGN KEY (professional_id) REFERENCES users (id) ON DELETE CASCADE
      )
    ''');

    // 7. Reviews
    await db.execute('''
      CREATE TABLE reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id INTEGER,
        from_user_id INTEGER,
        to_user_id INTEGER,
        rating REAL,
        comment TEXT,
        reply TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE,
        FOREIGN KEY (from_user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (to_user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    ''');

    // 8. Transactions
    await db.execute('''
      CREATE TABLE transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        amount REAL,
        type TEXT, -- 'credit', 'debit'
        category TEXT, -- 'earnings', 'withdrawal', 'payment', 'refund'
        status TEXT DEFAULT 'completed', -- 'pending', 'completed', 'failed'
        description TEXT,
        reference_id TEXT, -- e.g. job_id or external tx id
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    ''');

    // 9. Notifications
    await db.execute('''
      CREATE TABLE notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        title TEXT,
        message TEXT,
        type TEXT, -- 'job_alert', 'proposal', 'payment', 'system'
        is_read INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    ''');

    // 10. Portfolio
    await db.execute('''
      CREATE TABLE portfolios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        professional_id INTEGER, -- user_id
        title TEXT,
        description TEXT,
        image_url TEXT,
        link TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (professional_id) REFERENCES users (id) ON DELETE CASCADE
      )
    ''');

    // 11. Saved / Favourites
    await db.execute('''
      CREATE TABLE saved_jobs (
        user_id INTEGER,
        job_id INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, job_id),
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE
      )
    ''');

    await db.execute('''
      CREATE TABLE favourite_professionals (
        user_id INTEGER,
        professional_id INTEGER, -- user_id of professional
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, professional_id),
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (professional_id) REFERENCES users (id) ON DELETE CASCADE
      )
    ''');

    await db.execute('CREATE TABLE otp_verifications (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, otp TEXT, expires_at TEXT)');

    // Seed Data
    await _seedData(db);
  }

  Future<void> _seedData(Database db) async {
    final categories = [
      {'name': 'Home Services', 'icon': 'home'},
      {'name': 'Tech & IT', 'icon': 'computer'},
      {'name': 'Design', 'icon': 'brush'},
      {'name': 'Writing & Marketing', 'icon': 'edit'},
      {'name': 'Personal Care', 'icon': 'person'},
    ];

    for (var cat in categories) {
      int catId = await db.insert('categories', cat);
      List<String> subs = [];
      if (cat['name'] == 'Home Services') {
        subs = ['Plumbing', 'Electrical', 'Cleaning', 'Carpentry'];
      } else if (cat['name'] == 'Tech & IT') {
        subs = ['Web Development', 'Mobile Development', 'Data Science', 'DevOps'];
      } else if (cat['name'] == 'Design') {
        subs = ['Graphic Design', 'UI/UX Design', 'Logo Design', 'Illustration'];
      } else if (cat['name'] == 'Writing & Marketing') {
        subs = ['Content Writing', 'SEO', 'Social Media Marketing', 'Copywriting'];
      } else if (cat['name'] == 'Personal Care') {
        subs = ['Personal Trainer', 'Yoga Instructor', 'Nutritionist', 'Massage Therapy'];
      }

      for (var sub in subs) {
        await db.insert('subcategories', {'category_id': catId, 'name': sub});
      }
    }
  }

  // --- Auth Methods ---
  Future<int> registerUser(Map<String, dynamic> user) async {
    Database db = await database;
    user['created_at'] = DateTime.now().toIso8601String();
    user['updated_at'] = DateTime.now().toIso8601String();
    return await db.insert('users', user);
  }

  Future<Map<String, dynamic>?> loginUser(String identifier, String password) async {
    Database db = await database;
    List<Map<String, dynamic>> maps = await db.query('users', where: '(email = ? OR phone = ?) AND password_hash = ?', whereArgs: [identifier, identifier, password]);
    if (maps.isNotEmpty) {
      Map<String, dynamic> user = Map.from(maps.first);
      // Fetch role profile
      if (user['role'] == 'client') {
        final profile = await getClientProfile(user['id']);
        if (profile != null) user.addAll(profile);
      } else {
        final profile = await getProfessionalProfile(user['id']);
        if (profile != null) user.addAll(profile);
      }
      return user;
    }
    return null;
  }

  // --- Category Methods ---
  Future<List<Map<String, dynamic>>> getCategories() async {
    Database db = await database;
    return await db.query('categories');
  }

  Future<List<Map<String, dynamic>>> getSubcategories(int categoryId) async {
    Database db = await database;
    return await db.query('subcategories', where: 'category_id = ?', whereArgs: [categoryId]);
  }

  // --- Profile Methods ---
  Future<int> createClientProfile(Map<String, dynamic> profile) async {
    Database db = await database;
    if (profile['client_id'] == null) profile['client_id'] = 'CL-${DateTime.now().millisecondsSinceEpoch}';
    return await db.insert('clients', profile);
  }

  Future<int> createProfessionalProfile(Map<String, dynamic> profile) async {
    Database db = await database;
    if (profile['professional_id'] == null) profile['professional_id'] = 'PR-${DateTime.now().millisecondsSinceEpoch}';
    return await db.insert('professionals', profile);
  }

  Future<Map<String, dynamic>?> getClientProfile(int userId) async {
    Database db = await database;
    List<Map<String, dynamic>> maps = await db.query('clients', where: 'user_id = ?', whereArgs: [userId]);
    return maps.isNotEmpty ? maps.first : null;
  }

  Future<Map<String, dynamic>?> getProfessionalProfile(int userId) async {
    Database db = await database;
    List<Map<String, dynamic>> maps = await db.query('professionals', where: 'user_id = ?', whereArgs: [userId]);
    return maps.isNotEmpty ? maps.first : null;
  }

  Future<List<Map<String, dynamic>>> searchProfessionals({String? query, int? categoryId}) async {
    Database db = await database;
    String where = "users.role = 'professional'";
    List<dynamic> args = [];
    if (query != null && query.isNotEmpty) {
      where += " AND (users.full_name LIKE ? OR professionals.profession LIKE ? OR professionals.skills LIKE ?)";
      args.addAll(['%$query%', '%$query%', '%$query%']);
    }
    if (categoryId != null) {
      where += " AND professionals.service_category_id = ?";
      args.add(categoryId);
    }
    
    return await db.rawQuery('''
      SELECT users.*, professionals.* 
      FROM users 
      JOIN professionals ON users.id = professionals.user_id 
      WHERE $where
    ''', args);
  }

  // --- Job Methods ---
  Future<int> saveJob(Map<String, dynamic> job) async {
    Database db = await database;
    if (job.containsKey('id') && job['id'] != null) {
      int id = job['id'];
      Map<String, dynamic> data = Map.from(job);
      data.remove('id');
      data['updated_at'] = DateTime.now().toIso8601String();
      await db.update('jobs', data, where: 'id = ?', whereArgs: [id]);
      return id;
    } else {
      job['created_at'] = DateTime.now().toIso8601String();
      job['updated_at'] = DateTime.now().toIso8601String();
      return await db.insert('jobs', job);
    }
  }

  Future<Map<String, dynamic>?> getJob(int jobId) async {
    Database db = await database;
    List<Map<String, dynamic>> maps = await db.query('jobs', where: 'id = ?', whereArgs: [jobId]);
    return maps.isNotEmpty ? maps.first : null;
  }

  Future<List<Map<String, dynamic>>> getJobs({int? clientId, String? status, int? categoryId, String? query}) async {
    Database db = await database;
    String where = "1=1";
    List<dynamic> args = [];
    if (clientId != null) {
      where += " AND client_id = ?";
      args.add(clientId);
    }
    if (status != null) {
      where += " AND status = ?";
      args.add(status);
    }
    if (categoryId != null) {
      where += " AND category_id = ?";
      args.add(categoryId);
    }
    if (query != null && query.isNotEmpty) {
      where += " AND (title LIKE ? OR description LIKE ?)";
      args.addAll(['%$query%', '%$query%']);
    }
    return await db.query('jobs', where: where, whereArgs: args, orderBy: 'created_at DESC');
  }

  // --- Proposal Methods ---
  Future<int> submitProposal(Map<String, dynamic> proposal) async {
    Database db = await database;
    proposal['created_at'] = DateTime.now().toIso8601String();
    return await db.insert('proposals', proposal);
  }

  Future<List<Map<String, dynamic>>> getProposals({int? jobId, int? professionalId}) async {
    Database db = await database;
    String where = "1=1";
    List<dynamic> args = [];
    if (jobId != null) {
      where += " AND job_id = ?";
      args.add(jobId);
    }
    if (professionalId != null) {
      where += " AND professional_id = ?";
      args.add(professionalId);
    }
    return await db.rawQuery('''
      SELECT proposals.*, users.full_name, users.profile_photo, professionals.profession
      FROM proposals
      JOIN users ON proposals.professional_id = users.id
      JOIN professionals ON users.id = professionals.user_id
      WHERE $where
      ORDER BY proposals.created_at DESC
    ''', args);
  }

  // --- Wallet & Transaction Methods ---
  Future<void> addTransaction(Map<String, dynamic> tx) async {
    Database db = await database;
    await db.transaction((txn) async {
      await txn.insert('transactions', tx);
      // Update user wallet balance
      double amount = tx['amount'];
      if (tx['type'] == 'debit') amount = -amount;
      await txn.execute('UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?', [amount, tx['user_id']]);
    });
  }

  Future<List<Map<String, dynamic>>> getTransactions(int userId) async {
    Database db = await database;
    return await db.query('transactions', where: 'user_id = ?', whereArgs: [userId], orderBy: 'created_at DESC');
  }

  // --- Notification Methods ---
  Future<void> addNotification(Map<String, dynamic> notification) async {
    Database db = await database;
    await db.insert('notifications', notification);
  }

  Future<List<Map<String, dynamic>>> getNotifications(int userId) async {
    Database db = await database;
    return await db.query('notifications', where: 'user_id = ?', whereArgs: [userId], orderBy: 'created_at DESC');
  }

  Future<void> markNotificationRead(int id) async {
    Database db = await database;
    await db.update('notifications', {'is_read': 1}, where: 'id = ?', whereArgs: [id]);
  }

  // --- Review Methods ---
  Future<void> addReview(Map<String, dynamic> review) async {
    Database db = await database;
    await db.transaction((txn) async {
      await txn.insert('reviews', review);
      // Update professional rating
      await txn.execute('''
        UPDATE professionals 
        SET average_rating = (SELECT AVG(rating) FROM reviews WHERE to_user_id = ?),
            total_reviews = (SELECT COUNT(*) FROM reviews WHERE to_user_id = ?)
        WHERE user_id = ?
      ''', [review['to_user_id'], review['to_user_id'], review['to_user_id']]);
    });
  }

  Future<List<Map<String, dynamic>>> getReviews(int userId) async {
    Database db = await database;
    return await db.rawQuery('''
      SELECT reviews.*, users.full_name, users.profile_photo
      FROM reviews
      JOIN users ON reviews.from_user_id = users.id
      WHERE reviews.to_user_id = ?
      ORDER BY reviews.created_at DESC
    ''', [userId]);
  }

  // --- Portfolio Methods ---
  Future<void> addPortfolioItem(Map<String, dynamic> item) async {
    Database db = await database;
    await db.insert('portfolios', item);
  }

  Future<List<Map<String, dynamic>>> getPortfolio(int professionalId) async {
    Database db = await database;
    return await db.query('portfolios', where: 'professional_id = ?', whereArgs: [professionalId]);
  }

  // --- Favourites/Saved Methods ---
  Future<void> toggleSavedJob(int userId, int jobId) async {
    Database db = await database;
    final existing = await db.query('saved_jobs', where: 'user_id = ? AND job_id = ?', whereArgs: [userId, jobId]);
    if (existing.isNotEmpty) {
      await db.delete('saved_jobs', where: 'user_id = ? AND job_id = ?', whereArgs: [userId, jobId]);
    } else {
      await db.insert('saved_jobs', {'user_id': userId, 'job_id': jobId});
    }
  }

  Future<bool> isJobSaved(int userId, int jobId) async {
    Database db = await database;
    final existing = await db.query('saved_jobs', where: 'user_id = ? AND job_id = ?', whereArgs: [userId, jobId]);
    return existing.isNotEmpty;
  }

  Future<List<Map<String, dynamic>>> getSavedJobs(int userId) async {
    final db = await database;
    return db.rawQuery('''
      SELECT jobs.*
      FROM saved_jobs
      INNER JOIN jobs ON jobs.id = saved_jobs.job_id
      WHERE saved_jobs.user_id = ?
      ORDER BY saved_jobs.id DESC
    ''', [userId]);
  }

  Future<void> toggleFavouriteProfessional(int userId, int professionalId) async {
    Database db = await database;
    final existing = await db.query('favourite_professionals', where: 'user_id = ? AND professional_id = ?', whereArgs: [userId, professionalId]);
    if (existing.isNotEmpty) {
      await db.delete('favourite_professionals', where: 'user_id = ? AND professional_id = ?', whereArgs: [userId, professionalId]);
    } else {
      await db.insert('favourite_professionals', {'user_id': userId, 'professional_id': professionalId});
    }
  }

  Future<bool> isProfessionalFavourite(int userId, int professionalId) async {
    Database db = await database;
    final existing = await db.query('favourite_professionals', where: 'user_id = ? AND professional_id = ?', whereArgs: [userId, professionalId]);
    return existing.isNotEmpty;
  }

  // --- Compatibility / Legacy support ---
  Future<Map<String, dynamic>> getClientStats(int userId) async {
    Database db = await database;
    int posted = Sqflite.firstIntValue(await db.rawQuery('SELECT COUNT(*) FROM jobs WHERE client_id = ?', [userId])) ?? 0;
    int active = Sqflite.firstIntValue(await db.rawQuery("SELECT COUNT(*) FROM jobs WHERE client_id = ? AND status = 'active'", [userId])) ?? 0;
    int completed = Sqflite.firstIntValue(await db.rawQuery("SELECT COUNT(*) FROM jobs WHERE client_id = ? AND status = 'completed'", [userId])) ?? 0;
    int cancelled = Sqflite.firstIntValue(await db.rawQuery("SELECT COUNT(*) FROM jobs WHERE client_id = ? AND status = 'cancelled'", [userId])) ?? 0;
    int favs = Sqflite.firstIntValue(await db.rawQuery('SELECT COUNT(*) FROM favourite_professionals WHERE user_id = ?', [userId])) ?? 0;
    int reviews = Sqflite.firstIntValue(await db.rawQuery('SELECT COUNT(*) FROM reviews WHERE from_user_id = ?', [userId])) ?? 0;
    
    return {
      'total_jobs_posted': posted,
      'active_jobs': active,
      'completed_jobs': completed,
      'cancelled_jobs': cancelled,
      'favourite_professionals': favs,
      'reviews_given': reviews
    };
  }

  Future<Map<String, dynamic>> getProfessionalStats(int userId) async {
    Database db = await database;
    int applied = Sqflite.firstIntValue(await db.rawQuery('SELECT COUNT(*) FROM proposals WHERE professional_id = ?', [userId])) ?? 0;
    int active = Sqflite.firstIntValue(await db.rawQuery("SELECT COUNT(*) FROM jobs WHERE assigned_to_id = ? AND status = 'assigned'", [userId])) ?? 0;
    int completed = Sqflite.firstIntValue(await db.rawQuery("SELECT COUNT(*) FROM jobs WHERE assigned_to_id = ? AND status = 'completed'", [userId])) ?? 0;
    int cancelled = Sqflite.firstIntValue(await db.rawQuery("SELECT COUNT(*) FROM jobs WHERE assigned_to_id = ? AND status = 'cancelled'", [userId])) ?? 0;
    
    final user = await db.query('users', columns: ['wallet_balance'], where: 'id = ?', whereArgs: [userId]);
    double earnings = user.isNotEmpty ? (user.first['wallet_balance'] as double) : 0.0;
    
    final pro = await getProfessionalProfile(userId);
    double rating = pro?['average_rating'] ?? 0.0;
    int totalReviews = pro?['total_reviews'] ?? 0;

    return {
      'jobs_applied': applied,
      'active_jobs': active,
      'completed_jobs': completed,
      'cancelled_jobs': cancelled,
      'total_earnings': earnings,
      'average_rating': rating,
      'total_reviews': totalReviews
    };
  }

  Future<void> saveJobImages(int jobId, List<String> images) async {
    Database db = await database;
    await db.delete('job_images', where: 'job_id = ?', whereArgs: [jobId]);
    for (var url in images) {
      await db.insert('job_images', {'job_id': jobId, 'image_url': url});
    }
  }

  Future<void> saveJobDocuments(int jobId, List<Map<String, String>> docs) async {
    Database db = await database;
    await db.delete('job_documents', where: 'job_id = ?', whereArgs: [jobId]);
    for (var doc in docs) {
      await db.insert('job_documents', {
        'job_id': jobId, 
        'file_name': doc['name'], 
        'file_url': doc['url']
      });
    }
  }

  Future<List<Map<String, dynamic>>> getJobImages(int jobId) async {
    Database db = await database;
    return await db.query('job_images', where: 'job_id = ?', whereArgs: [jobId]);
  }

  Future<List<Map<String, dynamic>>> getJobDocuments(int jobId) async {
    Database db = await database;
    return await db.query('job_documents', where: 'job_id = ?', whereArgs: [jobId]);
  }

  // --- New Methods for Compilation Fix ---
  Future<bool> checkUserExists(String email, String phone) async {
    Database db = await database;
    String where = "email = ?";
    List<dynamic> args = [email];
    if (phone.isNotEmpty) {
      where += " OR phone = ?";
      args.add(phone);
    }
    final maps = await db.query('users', where: where, whereArgs: args);
    return maps.isNotEmpty;
  }

  Future<Map<String, dynamic>?> getJobDraft(int clientId) async {
    Database db = await database;
    final maps = await db.query('jobs', 
      where: 'client_id = ? AND status = ?', 
      whereArgs: [clientId, 'draft'],
      orderBy: 'updated_at DESC',
      limit: 1
    );
    return maps.isNotEmpty ? maps.first : null;
  }

  Future<void> updateClientProfile(int userId, Map<String, dynamic> data) async {
    Database db = await database;
    await db.update('clients', data, where: 'user_id = ?', whereArgs: [userId]);
  }

  Future<void> updateProfessionalProfile(int userId, Map<String, dynamic> data) async {
    Database db = await database;
    await db.update('professionals', data, where: 'user_id = ?', whereArgs: [userId]);
  }

  Future<void> updateProfileCompletion(int userId, bool isComplete) async {
    Database db = await database;
    await db.update('users', 
      {'profile_completed': isComplete ? 1 : 0, 'updated_at': DateTime.now().toIso8601String()}, 
      where: 'id = ?', 
      whereArgs: [userId]
    );
  }
}
