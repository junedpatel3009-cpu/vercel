import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:io';
import '../../core/theme/app_theme.dart';
// Read-only: category/subcategory lookups and legacy draft-loading still use
// the on-device database. Actual job creation below goes through the
// backend API instead — the backend is now the source of truth for jobs.
import '../../core/database/database_helper.dart';
import '../../core/auth/auth_service.dart';
import '../../core/api/api_client.dart';
import 'package:intl/intl.dart';
import 'package:path/path.dart' as p;
import 'location_picker_screen.dart';

class PostJobScreen extends StatefulWidget {
  const PostJobScreen({super.key});

  @override
  State<PostJobScreen> createState() => _PostJobScreenState();
}

class _PostJobScreenState extends State<PostJobScreen> {
  final _formKey = GlobalKey<FormState>();
  int _currentStep = 1;
  bool _isSaving = false;
  int? _currentJobId;
  Map<String, dynamic>? _currentUser;
  final ImagePicker _picker = ImagePicker();

  // Step 1: Info
  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();
  String _serviceType = 'One-time';
  String _priority = 'Medium';

  // Step 2: Location
  final _addressController = TextEditingController();
  final _cityController = TextEditingController();
  final _stateController = TextEditingController();
  final _countryController = TextEditingController();
  final _pincodeController = TextEditingController();
  final _latitudeController = TextEditingController();
  final _longitudeController = TextEditingController();
  bool _isRemote = false;

  // Step 3: Schedule
  final _startDateController = TextEditingController();
  final _startTimeController = TextEditingController();
  final _durationController = TextEditingController();
  final _deadlineController = TextEditingController();
  bool _isFlexible = false;

  // Step 4: Budget
  String _budgetType = 'Fixed Price';
  final _minBudgetController = TextEditingController();
  final _maxBudgetController = TextEditingController();
  String _currency = 'USD';

  // Step 5: Media & Requirements
  final _specialInstructionsController = TextEditingController();
  final _skillsController = TextEditingController();
  final _prosRequiredController = TextEditingController(text: '1');
  final List<File> _images = [];
  final List<File> _documents = [];
  double _uploadProgress = 0.0;
  bool _isUploading = false;
  List<String> _existingImageUrls = [];
  List<Map<String, dynamic>> _existingDocuments = [];
  List<Map<String, dynamic>> _categories = [];
  List<Map<String, dynamic>> _subcategories = [];
  int? _selectedCategoryId;
  int? _selectedSubcategoryId;

  @override
  void initState() {
    super.initState();
    _loadInitialData();
  }

  Future<void> _loadInitialData() async {
    final user = await AuthService().getUser();
    final db = DatabaseHelper();
    final cats = await db.getCategories();
    
    if (mounted) {
      setState(() {
        _currentUser = user;
        _categories = cats;
      });
    }
    
    if (user != null) {
      final draft = await db.getJobDraft(user['id']);
      if (draft != null) {
        _currentJobId = draft['id'];
        _titleController.text = draft['title'] ?? '';
        _selectedCategoryId = draft['category_id'];
        _selectedSubcategoryId = draft['subcategory_id'];
        
        if (_selectedCategoryId != null) {
          final subs = await db.getSubcategories(_selectedCategoryId!);
          if (mounted) setState(() => _subcategories = subs);
        }

        _descriptionController.text = draft['description'] ?? '';
        _serviceType = draft['service_type'] ?? 'One-time';
        _priority = draft['priority'] ?? 'Medium';
        
        _addressController.text = draft['address'] ?? '';
        _cityController.text = draft['city'] ?? '';
        _stateController.text = draft['state'] ?? '';
        _countryController.text = draft['country'] ?? '';
        _pincodeController.text = draft['pincode'] ?? '';
        _latitudeController.text = draft['latitude']?.toString() ?? '';
        _longitudeController.text = draft['longitude']?.toString() ?? '';
        _isRemote = draft['is_remote'] == 1;

        _startDateController.text = draft['start_date'] ?? '';
        _startTimeController.text = draft['start_time'] ?? '';
        _durationController.text = draft['duration'] ?? '';
        _deadlineController.text = draft['deadline'] ?? '';
        _isFlexible = draft['flexible_schedule'] == 1;

        _budgetType = draft['budget_type'] ?? 'Fixed Price';
        _minBudgetController.text = draft['min_budget']?.toString() ?? '';
        _maxBudgetController.text = draft['max_budget']?.toString() ?? '';
        _currency = draft['currency'] ?? 'USD';

        _specialInstructionsController.text = draft['special_instructions'] ?? '';
        _skillsController.text = draft['required_skills'] ?? '';
        _prosRequiredController.text = draft['professionals_required']?.toString() ?? '1';

        final imgs = await db.database.then((d) => d.query('job_images', where: 'job_id = ?', whereArgs: [_currentJobId!]));
        _existingImageUrls = imgs.map((e) => e['image_url'] as String).toList();
        
        final docs = await db.database.then((d) => d.query('job_documents', where: 'job_id = ?', whereArgs: [_currentJobId!]));
        _existingDocuments = docs;
      }
    }
    if (mounted) {
      setState(() {});
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    _addressController.dispose();
    _cityController.dispose();
    _stateController.dispose();
    _countryController.dispose();
    _pincodeController.dispose();
    _latitudeController.dispose();
    _longitudeController.dispose();
    _startDateController.dispose();
    _startTimeController.dispose();
    _durationController.dispose();
    _deadlineController.dispose();
    _minBudgetController.dispose();
    _maxBudgetController.dispose();
    _specialInstructionsController.dispose();
    _skillsController.dispose();
    _prosRequiredController.dispose();
    super.dispose();
  }

  // Wizard steps 1-5 used to persist a partial row to the on-device
  // "jobs" table on every "Continue" tap (DatabaseHelper.saveJob /
  // saveJobImages / saveJobDocuments). The backend has no draft endpoint
  // wired up yet (POST /api/v1/client/jobs only accepts the fully-valid
  // clientJobSchema), so there is nothing to sync partial state to. Form
  // state simply lives in the controllers/fields above across steps, and
  // the job is created on the backend exactly once, on final submit.
  void _nextStep() {
    if (_formKey.currentState!.validate()) {
      if (_currentStep == 3) {
        // The website's Timing step validates the date range before continuing.
        if (_startDateController.text.isNotEmpty && _deadlineController.text.isNotEmpty) {
          DateTime start = DateFormat('yyyy-MM-dd').parse(_startDateController.text);
          DateTime deadline = DateFormat('yyyy-MM-dd').parse(_deadlineController.text);
          if (deadline.isBefore(start)) {
            ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Deadline cannot be earlier than start date')));
            return;
          }
        }
      }
      if (_currentStep == 2) {
        // The website's Budget & files step validates the budget range.
        double min = double.tryParse(_minBudgetController.text) ?? 0;
        double max = double.tryParse(_maxBudgetController.text) ?? 0;
        if (min <= 0) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Budget must be greater than zero')));
          return;
        }
        if (max < min) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Maximum budget cannot be less than minimum budget')));
          return;
        }
      }

      if (_currentStep < 4) {
        setState(() => _currentStep++);
      }
    }
  }

  /// Uploads every picked image/document through the backend's generic file
  /// endpoint (`POST /api/v1/files`), then resolves each stored file to a
  /// signed preview link (`GET /api/v1/files/:id/access`). The resulting
  /// list matches the shape `clientJobSchema.attachments` expects.
  Future<List<Map<String, dynamic>>> _uploadAttachments() async {
    final uploaded = <Map<String, dynamic>>[];
    for (final file in [..._images, ..._documents]) {
      final purpose = _images.contains(file) ? 'client_job_image' : 'client_job_document';
      final stored = await ApiClient.instance.uploadFile(file, purpose: purpose);
      final previewUrl = await ApiClient.instance.getFileAccessUrl(stored['id'] as int);
      uploaded.add({
        'fileName': stored['fileName'],
        'fileType': stored['mimeType'],
        'fileSize': stored['sizeBytes'],
        'previewUrl': previewUrl,
      });
    }
    return uploaded;
  }

  /// Maps this screen's wizard fields onto the backend's `clientJobSchema`
  /// (src/lib/validation/client-job.ts). Fields with no equivalent Prisma
  /// column (job type, start time, duration, flexible flag, skills,
  /// professionals required, currency, special instructions) are folded
  /// into the description instead of being silently dropped.
  Map<String, dynamic> _buildJobPayload(List<Map<String, dynamic>> attachments) {
    final categoryName = (_categories.firstWhere(
      (c) => c['id'] == _selectedCategoryId,
      orElse: () => const {'name': ''},
    )['name'] as String?) ?? '';
    final subcategoryName = (_subcategories.firstWhere(
      (s) => s['id'] == _selectedSubcategoryId,
      orElse: () => const {'name': ''},
    )['name'] as String?) ?? '';
    final category = subcategoryName.isEmpty ? categoryName : '$categoryName - $subcategoryName';

    final urgency = switch (_priority) {
      'Low' => 'LOW',
      'High' => 'HIGH',
      'Urgent' => 'HIGH', // backend has no URGENT level; Urgent is treated as HIGH.
      _ => 'MEDIUM',
    };
    final timingType = _budgetType == 'Hourly' ? 'HOURLY' : 'FIXED';
    final budgetMin = double.tryParse(_minBudgetController.text)?.round();
    final budgetMax = double.tryParse(_maxBudgetController.text)?.round();

    final fullAddress = [
      _addressController.text,
      _cityController.text,
      _stateController.text,
      _countryController.text,
      _pincodeController.text,
    ].where((part) => part.trim().isNotEmpty).join(', ');

    final extraDetails = <String, String>{
      if (_serviceType.isNotEmpty) 'Job type': _serviceType,
      if (_startTimeController.text.isNotEmpty) 'Preferred start time': _startTimeController.text,
      if (_durationController.text.isNotEmpty) 'Estimated duration': _durationController.text,
      if (_isFlexible) 'Flexible schedule': 'Yes',
      if (_skillsController.text.isNotEmpty) 'Required skills': _skillsController.text,
      'Professionals required': _prosRequiredController.text,
      'Currency': _currency,
      if (_specialInstructionsController.text.isNotEmpty)
        'Special instructions': _specialInstructionsController.text,
    };
    final extraDetailsText = extraDetails.entries.map((e) => '${e.key}: ${e.value}').join('\n');
    final description = extraDetailsText.isEmpty
        ? _descriptionController.text.trim()
        : '${_descriptionController.text.trim()}\n\n---\n$extraDetailsText';

    return {
      'category': category,
      'title': _titleController.text.trim(),
      'description': description,
      'attachments': attachments,
      if (budgetMin != null) 'budgetMin': budgetMin,
      if (budgetMax != null) 'budgetMax': budgetMax,
      'urgency': urgency,
      'timingType': timingType,
      if (timingType == 'HOURLY' && budgetMin != null) 'hourlyRate': budgetMin,
      if (_startDateController.text.isNotEmpty) 'jobDate': _startDateController.text,
      'deadline': _deadlineController.text,
      'workMode': _isRemote ? 'REMOTE' : 'ON_SITE',
      if (!_isRemote && _cityController.text.isNotEmpty)
        'locationLabel': '${_cityController.text}, ${_stateController.text}',
      if (!_isRemote) 'locationAddress': fullAddress,
      if (!_isRemote) 'locationLat': double.tryParse(_latitudeController.text),
      if (!_isRemote) 'locationLng': double.tryParse(_longitudeController.text),
      'status': 'OPEN',
    };
  }

  /// Best-effort refresh of the client's job list from the backend
  /// (GET /api/v1/client/jobs) so the newly created job is reflected from
  /// the same source of truth the website reads from. The result isn't
  /// rendered on this screen; job-listing screens will read from this same
  /// endpoint directly in a later phase. Failure here must not undo the
  /// fact that the job was already created successfully.
  Future<void> _refreshJobList() async {
    try {
      await ApiClient.instance.getList('/api/v1/client/jobs');
    } catch (e) {
      debugPrint('Job list refresh failed: $e');
    }
  }

  String _validationMessage(ApiException e) {
    final details = e.details;
    if (details is Map) {
      final fieldErrors = details['fieldErrors'];
      if (fieldErrors is Map && fieldErrors.isNotEmpty) {
        final first = fieldErrors.entries.first;
        final messages = (first.value as List).join(', ');
        return '${first.key}: $messages';
      }
      final formErrors = details['formErrors'];
      if (formErrors is List && formErrors.isNotEmpty) {
        return formErrors.join(', ');
      }
    }
    return e.message;
  }

  Future<void> _handlePostJob() async {
    if (!_formKey.currentState!.validate()) return;
    if (_currentUser == null) return;

    setState(() => _isSaving = true);
    try {
      final attachments = await _uploadAttachments();
      final payload = _buildJobPayload(attachments);
      // The backend is the source of truth for jobs: this call is what
      // makes the job visible on the website for the same logged-in user.
      final localDraftId = _currentJobId;
      final created = await ApiClient.instance.post('/api/v1/client/jobs', data: payload);
      _currentJobId = created['id'] as int?;
      if (localDraftId != null) {
        await DatabaseHelper().saveJob({'id': localDraftId, 'status': 'active'});
      }
      await _refreshJobList();
      if (mounted) {
        _showSuccessDialog();
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.statusCode == 401) {
        await AuthService().logout();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Please log in again.')),
          );
          context.go('/login');
        }
      } else if (e.statusCode == 422) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_validationMessage(e))),
        );
      } else if (e.statusCode == null) {
        // ApiClient already produces a friendly "unable to reach server"
        // message for network/connection failures.
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      } else {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Unable to post job. Please try again later.')),
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  void _showSuccessDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.check_circle, color: Colors.green, size: 64),
            const SizedBox(height: 24),
            const Text('Job Posted!', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            const Text('Your job has been successfully posted and is now visible to professionals.', textAlign: TextAlign.center),
            const SizedBox(height: 32),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.pop(context);
                  context.go('/job/$_currentJobId');
                },
                child: const Text('View Job Details'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _pickMapLocation() async {
    final latitude = double.tryParse(_latitudeController.text);
    final longitude = double.tryParse(_longitudeController.text);
    final picked = await Navigator.of(context).push<PickedLocation>(
      MaterialPageRoute(
        builder: (_) => LocationPickerScreen(
          initialLatitude: latitude,
          initialLongitude: longitude,
        ),
      ),
    );
    if (picked == null || !mounted) return;
    setState(() {
      _latitudeController.text = picked.latitude.toStringAsFixed(6);
      _longitudeController.text = picked.longitude.toStringAsFixed(6);
      if (picked.address.isNotEmpty) _addressController.text = picked.address;
      if (picked.city.isNotEmpty) _cityController.text = picked.city;
      if (picked.state.isNotEmpty) _stateController.text = picked.state;
      if (picked.country.isNotEmpty) _countryController.text = picked.country;
      if (picked.pincode.isNotEmpty) _pincodeController.text = picked.pincode;
    });
  }

  Future<void> _saveDraft() async {
    final userValue = _currentUser?['id'];
    final userId = userValue is int ? userValue : int.tryParse('$userValue');
    if (userId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please log in to save a draft.')),
      );
      return;
    }

    setState(() => _isSaving = true);
    try {
      _currentJobId = await DatabaseHelper().saveJob({
        if (_currentJobId != null) 'id': _currentJobId,
        'client_id': userId,
        'title': _titleController.text.trim(),
        'category_id': _selectedCategoryId,
        'subcategory_id': _selectedSubcategoryId,
        'description': _descriptionController.text.trim(),
        'service_type': _serviceType,
        'priority': _priority,
        'address': _addressController.text.trim(),
        'city': _cityController.text.trim(),
        'state': _stateController.text.trim(),
        'country': _countryController.text.trim(),
        'pincode': _pincodeController.text.trim(),
        'latitude': double.tryParse(_latitudeController.text),
        'longitude': double.tryParse(_longitudeController.text),
        'is_remote': _isRemote ? 1 : 0,
        'start_date': _startDateController.text,
        'start_time': _startTimeController.text,
        'duration': _durationController.text,
        'deadline': _deadlineController.text,
        'flexible_schedule': _isFlexible ? 1 : 0,
        'budget_type': _budgetType,
        'min_budget': double.tryParse(_minBudgetController.text),
        'max_budget': double.tryParse(_maxBudgetController.text),
        'currency': _currency,
        'special_instructions': _specialInstructionsController.text.trim(),
        'required_skills': _skillsController.text.trim(),
        'professionals_required': int.tryParse(_prosRequiredController.text) ?? 1,
        'status': 'draft',
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Draft saved. You can continue editing it anytime.')),
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bgLight,
      appBar: _buildHeader(context),
      body: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            children: [
              _buildStepIndicator(),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
                child: _buildCurrentStepView(),
              ),
              const SizedBox(height: 40),
              _buildBottomActions(context),
              const SizedBox(height: 40),
              _buildFooter(context),
              const SizedBox(height: 40),
            ],
          ),
        ),
      ),
    );
  }

  PreferredSizeWidget _buildHeader(BuildContext context) {
    return AppBar(
      backgroundColor: Colors.white,
      elevation: 0,
      leading: context.canPop() 
        ? IconButton(
            icon: const Icon(Icons.arrow_back, color: AppTheme.brandNavy),
            onPressed: () => context.pop(),
          )
        : null,
      title: Text('SERVIO', style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w900, color: AppTheme.brandNavy)),
      actions: [
        TextButton(
          onPressed: _isSaving ? null : _saveDraft,
          child: const Text('Save Draft', style: TextStyle(color: AppTheme.brandBlue)),
        ),
        TextButton(
          onPressed: () => context.pop(),
          child: const Text('Cancel Post', style: TextStyle(color: Colors.black87)),
        ),
        const SizedBox(width: 8),
        const CircleAvatar(radius: 16, backgroundImage: NetworkImage('https://i.pravatar.cc/100?u=jane')),
        const SizedBox(width: 24),
      ],
    );
  }

  Widget _buildStepIndicator() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(color: AppTheme.brandBlue.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(20)),
                child: Text('Step $_currentStep of 6', style: const TextStyle(color: AppTheme.brandBlue, fontWeight: FontWeight.bold, fontSize: 12)),
              ),
              Text(_stepTitle(), style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.brandNavy)),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: List.generate(4, (index) {
              final active = index < _currentStep;
              return Expanded(
                child: Container(
                  height: 6,
                  margin: EdgeInsets.only(right: index == 3 ? 0 : 8),
                  decoration: BoxDecoration(
                    color: active ? AppTheme.brandBlue : const Color(0xFFE2E8F0),
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              );
            }),
          )
        ],
      ),
    );
  }

  String _stepTitle() {
    switch (_currentStep) {
      case 1: return 'Basics';
      case 2: return 'Budget & Files';
      case 3: return 'Timing';
      case 4: return 'Location & Review';
      default: return '';
    }
  }

  Widget _buildCurrentStepView() {
    switch (_currentStep) {
      case 1: return _buildStep1BasicInfo();
      case 2:
        return Column(
          children: [
            _buildStep4Budget(),
            const SizedBox(height: 24),
            _buildStep5Media(),
          ],
        );
      case 3: return _buildStep3Schedule();
      case 4:
        return Column(
          children: [
            _buildStep2Location(),
            const SizedBox(height: 24),
            _buildStep6Review(),
          ],
        );
      default: return _buildStep1BasicInfo();
    }
  }

  Widget _buildStep1BasicInfo() {
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(32),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(32),
            border: Border.all(color: const Color(0xFFF1F5F9)),
            boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.02), blurRadius: 20, offset: const Offset(0, 10))],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Job Information', style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 12),
              const Text('Let\'s start with the basics. Tell us about the professional service you need.', style: TextStyle(color: AppTheme.textGray)),
              const SizedBox(height: 40),
              
              _inputLabel('Job Title *'),
              TextFormField(
                controller: _titleController,
                decoration: const InputDecoration(hintText: 'e.g. Build a modern landing page'),
                validator: (v) => v == null || v.trim().isEmpty ? 'Please enter a job title' : null,
              ),
              const SizedBox(height: 24),

              _inputLabel('Category *'),
              DropdownButtonFormField<int>(
                initialValue: _selectedCategoryId,
                decoration: const InputDecoration(hintText: 'Select category'),
                items: _categories.map((e) => DropdownMenuItem<int>(value: e['id'], child: Text(e['name']))).toList(),
                onChanged: (v) async {
                  setState(() {
                    _selectedCategoryId = v;
                    _selectedSubcategoryId = null;
                    _subcategories = [];
                  });
                  if (v != null) {
                    final subs = await DatabaseHelper().getSubcategories(v);
                    setState(() => _subcategories = subs);
                  }
                },
                validator: (v) => v == null ? 'Please select a category' : null,
              ),
              const SizedBox(height: 24),

              _inputLabel('Sub-category *'),
              DropdownButtonFormField<int>(
                initialValue: _selectedSubcategoryId,
                decoration: const InputDecoration(hintText: 'Select sub-category'),
                items: _subcategories.map((e) => DropdownMenuItem<int>(value: e['id'], child: Text(e['name']))).toList(),
                onChanged: (v) => setState(() => _selectedSubcategoryId = v),
                validator: (v) => v == null ? 'Please select a sub-category' : null,
              ),
              const SizedBox(height: 24),

              _inputLabel('Job Description *'),
              TextFormField(
                controller: _descriptionController,
                maxLines: 5, 
                decoration: const InputDecoration(hintText: 'Describe the project scope...'),
                validator: (v) => v == null || v.trim().length < 40 ? 'Description must be at least 40 characters' : null,
              ),
              const SizedBox(height: 24),

              _inputLabel('Job Type *'),
              _buildJobTypeSelector(),
              const SizedBox(height: 24),

              _inputLabel('Job Priority'),
              DropdownButtonFormField<String>(
                initialValue: _priority,
                decoration: const InputDecoration(contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 4)),
                items: ['Low', 'Medium', 'High', 'Urgent'].map((e) => DropdownMenuItem(value: e, child: Text(e))).toList(),
                onChanged: (v) => setState(() => _priority = v!),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildJobTypeSelector() {
    final types = [
      {'title': 'One-time', 'subtitle': 'Single task or project', 'icon': Icons.looks_one},
      {'title': 'Recurring', 'subtitle': 'Ongoing or regular work', 'icon': Icons.repeat},
      {'title': 'Emergency', 'subtitle': 'Immediate attention needed', 'icon': Icons.flash_on},
    ];

    return Column(
      children: types.map((type) {
        final isSelected = _serviceType == type['title'];
        return GestureDetector(
          onTap: () {
            setState(() {
              _serviceType = type['title'] as String;
              // Brain Logic: If Emergency, set priority to Urgent automatically
              if (_serviceType == 'Emergency') {
                _priority = 'Urgent';
              }
            });
          },
          child: Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: isSelected ? AppTheme.brandBlue.withValues(alpha: 0.05) : Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: isSelected ? AppTheme.brandBlue : const Color(0xFFE2E8F0),
                width: isSelected ? 2 : 1,
              ),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: isSelected ? AppTheme.brandBlue : const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    type['icon'] as IconData,
                    color: isSelected ? Colors.white : AppTheme.brandNavy,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        type['title'] as String,
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: isSelected ? AppTheme.brandBlue : AppTheme.brandNavy,
                        ),
                      ),
                      Text(
                        type['subtitle'] as String,
                        style: const TextStyle(fontSize: 12, color: AppTheme.textGray),
                      ),
                    ],
                  ),
                ),
                if (isSelected)
                  const Icon(Icons.check_circle, color: AppTheme.brandBlue, size: 20),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildStep2Location() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Where is the job?', style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 12),
        const Text('Set the specific location or mark as remote.', style: TextStyle(color: AppTheme.textGray)),
        const SizedBox(height: 32),
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24), border: Border.all(color: const Color(0xFFF1F5F9))),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Text('Remote Job', style: TextStyle(fontWeight: FontWeight.bold)),
                  const Spacer(),
                  Switch(value: _isRemote, onChanged: (v) => setState(() => _isRemote = v)),
                ],
              ),
              if (!_isRemote) ...[
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: _pickMapLocation,
                    icon: const Icon(Icons.location_on),
                    label: const Text('Pick on Map'),
                    style: ElevatedButton.styleFrom(backgroundColor: AppTheme.brandNavy),
                  ),
                ),
                const SizedBox(height: 24),
                _inputLabel('Full Address *'),
                TextFormField(
                  controller: _addressController,
                  decoration: const InputDecoration(hintText: 'Enter street address'),
                  validator: (v) => !_isRemote && (v == null || v.isEmpty) ? 'Please enter address' : null,
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(child: _buildSmallField('City *', _cityController, !_isRemote)),
                    const SizedBox(width: 16),
                    Expanded(child: _buildSmallField('State *', _stateController, !_isRemote)),
                  ],
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(child: _buildSmallField('Country *', _countryController, !_isRemote)),
                    const SizedBox(width: 16),
                    Expanded(child: _buildSmallField('PIN Code *', _pincodeController, !_isRemote)),
                  ],
                ),
                const SizedBox(height: 24),
                _inputLabel('Coordinates (Optional)'),
                Row(
                  children: [
                    Expanded(child: _buildSmallField('Latitude', _latitudeController, true)),
                    const SizedBox(width: 16),
                    Expanded(child: _buildSmallField('Longitude', _longitudeController, true)),
                  ],
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildStep3Schedule() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Schedule', style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 32),
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24), border: Border.all(color: const Color(0xFFF1F5F9))),
          child: Column(
            children: [
              _buildDatePickerField('Preferred Start Date', _startDateController),
              const SizedBox(height: 16),
              _buildTimePickerField('Preferred Start Time', _startTimeController),
              const SizedBox(height: 16),
              _buildSmallField(
                'Estimated Duration (e.g. 3 days)',
                _durationController,
                true,
                onChanged: (_) => _updateAutomaticDeadline(),
              ),
              const SizedBox(height: 16),
              _buildDatePickerField(
                'Deadline', 
                _deadlineController, 
                firstDate: _startDateController.text.isNotEmpty 
                  ? DateFormat('yyyy-MM-dd').parse(_startDateController.text) 
                  : DateTime.now()
              ),
              const SizedBox(height: 24),
              Row(
                children: [
                  const Text('Flexible Schedule', style: TextStyle(fontWeight: FontWeight.bold)),
                  const Spacer(),
                  Switch(value: _isFlexible, onChanged: (v) => setState(() => _isFlexible = v)),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildStep4Budget() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Budget', style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 32),
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24), border: Border.all(color: const Color(0xFFF1F5F9))),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _inputLabel('Budget Type'),
              DropdownButtonFormField<String>(
                initialValue: _budgetType,
                items: ['Fixed Price', 'Hourly'].map((e) => DropdownMenuItem(value: e, child: Text(e))).toList(),
                onChanged: (v) => setState(() => _budgetType = v!),
              ),
              const SizedBox(height: 24),
              Row(
                children: [
                  Expanded(
                    child: _buildSmallField(
                      'Min Budget', 
                      _minBudgetController, 
                      true, 
                      type: const TextInputType.numberWithOptions(decimal: true),
                      suffix: _budgetType == 'Hourly' ? '/ hr' : null
                    )
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: _buildSmallField(
                      'Max Budget', 
                      _maxBudgetController, 
                      true, 
                      type: const TextInputType.numberWithOptions(decimal: true),
                      suffix: _budgetType == 'Hourly' ? '/ hr' : null
                    )
                  ),
                ],
              ),
              const SizedBox(height: 16),
              _inputLabel('Currency'),
              DropdownButtonFormField<String>(
                initialValue: _currency,
                items: ['USD', 'EUR', 'GBP', 'INR'].map((e) => DropdownMenuItem(value: e, child: Text(e))).toList(),
                onChanged: (v) => setState(() => _currency = v!),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildStep5Media() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Media & Requirements', style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 32),
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24), border: Border.all(color: const Color(0xFFF1F5F9))),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _inputLabel('Job Images'),
              const SizedBox(height: 12),
              _buildImagePicker(),
              const SizedBox(height: 24),
              _inputLabel('Job Documents'),
              const SizedBox(height: 12),
              _buildDocumentPicker(),
              const SizedBox(height: 24),
              _inputLabel('Special Instructions'),
              TextFormField(controller: _specialInstructionsController, maxLines: 3, decoration: const InputDecoration(hintText: 'Any specific details professionals should know?')),
              const SizedBox(height: 16),
              _inputLabel('Required Skills'),
              TextFormField(controller: _skillsController, decoration: const InputDecoration(hintText: 'e.g. Flutter, Dart, UI Design')),
              const SizedBox(height: 16),
              _inputLabel('Professionals Required'),
              TextFormField(controller: _prosRequiredController, keyboardType: TextInputType.number, decoration: const InputDecoration(hintText: '1')),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildStep6Review() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Review & Submit', style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 24),
        _buildReviewSection('Job Details', {
          'Title': _titleController.text,
          'Category': _categories.firstWhere((c) => c['id'] == _selectedCategoryId, orElse: () => {'name': ''})['name'],
          'Subcategory': _subcategories.firstWhere((s) => s['id'] == _selectedSubcategoryId, orElse: () => {'name': ''})['name'],
          'Description': _descriptionController.text,
          'Type': _serviceType,
          'Priority': _priority,
        }, step: 1),
        _buildReviewSection('Location', {
          'Remote': _isRemote ? 'Yes' : 'No',
          if (!_isRemote) 'Address': _addressController.text,
          if (!_isRemote) 'City': _cityController.text,
          if (!_isRemote) 'State': _stateController.text,
          if (!_isRemote) 'Country': _countryController.text,
          if (!_isRemote) 'PIN Code': _pincodeController.text,
          'Latitude': _latitudeController.text,
          'Longitude': _longitudeController.text,
        }, step: 4),
        _buildReviewSection('Schedule', {
          'Start Date': _startDateController.text,
          'Start Time': _startTimeController.text,
          'Duration': _durationController.text,
          'Deadline': _deadlineController.text,
          'Flexible': _isFlexible ? 'Yes' : 'No',
        }, step: 3),
        _buildReviewSection('Budget', {
          'Type': _budgetType,
          'Min Budget': '${_minBudgetController.text} $_currency',
          'Max Budget': '${_maxBudgetController.text} $_currency',
        }, step: 2),
        _buildReviewSection('Requirements & Media', {
          'Skills': _skillsController.text,
          'Pros Required': _prosRequiredController.text,
          'Images': '${_images.length + _existingImageUrls.length} uploaded',
          'Documents': '${_documents.length + _existingDocuments.length} uploaded',
        }, step: 2),
        const SizedBox(height: 12),
        const Text('By submitting, you agree to our Terms of Service.', style: TextStyle(color: Colors.grey, fontSize: 12)),
      ],
    );
  }

  Widget _buildReviewSection(String title, Map<String, String> data, {required int step}) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFF1F5F9))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              TextButton(
                onPressed: () => setState(() => _currentStep = step),
                child: const Text('Edit'),
              ),
            ],
          ),
          const Divider(),
          ...data.entries.map((e) => Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(width: 120, child: Text('${e.key}: ', style: const TextStyle(color: Colors.grey, fontSize: 13))),
                Expanded(child: Text(e.value, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13))),
              ],
            ),
          )),
        ],
      ),
    );
  }

  Widget _buildSmallField(
    String label,
    TextEditingController controller,
    bool required, {
    TextInputType type = TextInputType.text,
    String? suffix,
    ValueChanged<String>? onChanged,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _inputLabel(label),
        TextFormField(
          controller: controller,
          keyboardType: type,
          onChanged: onChanged,
          decoration: InputDecoration(
            suffixText: suffix,
            suffixStyle: const TextStyle(color: AppTheme.textGray, fontWeight: FontWeight.bold),
          ),
          validator: (v) {
            if (required && (v == null || v.isEmpty)) return 'Required';
            if (type.index == TextInputType.number.index || type == const TextInputType.numberWithOptions(decimal: true)) {
              if (v != null && v.isNotEmpty && double.tryParse(v) == null) return 'Invalid number';
            }
            return null;
          },
        ),
      ],
    );
  }

  Widget _buildDatePickerField(String label, TextEditingController controller, {DateTime? firstDate}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _inputLabel(label),
        TextFormField(
          controller: controller,
          readOnly: true,
          decoration: const InputDecoration(
            suffixIcon: Icon(Icons.calendar_today, size: 18),
            hintText: 'YYYY-MM-DD'
          ),
          onTap: () async {
            // Brain Logic: Use the provided firstDate (e.g., Start Date) to restrict the Deadline picker
            final initial = controller.text.isNotEmpty 
              ? DateFormat('yyyy-MM-dd').parse(controller.text) 
              : (firstDate ?? DateTime.now());
              
            final date = await showDatePicker(
              context: context, 
              initialDate: initial.isBefore(firstDate ?? DateTime.now()) ? (firstDate ?? DateTime.now()) : initial, 
              firstDate: firstDate ?? DateTime.now(), 
              lastDate: DateTime.now().add(const Duration(days: 365))
            );
            if (date != null) {
              setState(() {
                controller.text = DateFormat('yyyy-MM-dd').format(date);
                if (label == 'Preferred Start Date') _updateAutomaticDeadline();
              });
            }
          },
          validator: (v) => v == null || v.isEmpty ? 'Please select a date' : null,
        ),
      ],
    );
  }

  void _updateAutomaticDeadline() {
    final startText = _startDateController.text;
    final durationMatch = RegExp(r'(\d+)\s*day', caseSensitive: false).firstMatch(_durationController.text);
    if (startText.isEmpty || durationMatch == null) return;

    final startDate = DateTime.tryParse(startText);
    final days = int.tryParse(durationMatch.group(1) ?? '');
    if (startDate == null || days == null) return;
    _deadlineController.text = DateFormat('yyyy-MM-dd').format(startDate.add(Duration(days: days)));
  }

  Widget _buildTimePickerField(String label, TextEditingController controller) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _inputLabel(label),
        TextFormField(
          controller: controller,
          readOnly: true,
          decoration: const InputDecoration(suffixIcon: Icon(Icons.access_time, size: 18)),
          onTap: () async {
            final time = await showTimePicker(context: context, initialTime: TimeOfDay.now());
            if (time != null && mounted) {
              controller.text = time.format(context);
            }
          },
        ),
      ],
    );
  }

  Widget _buildImagePicker() {
    return Column(
      children: [
        if (_isUploading) ...[
          const Text('Uploading...', style: TextStyle(fontSize: 12, color: AppTheme.brandBlue)),
          const SizedBox(height: 4),
          LinearProgressIndicator(value: _uploadProgress, minHeight: 2, color: AppTheme.brandBlue),
          const SizedBox(height: 12),
        ],
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            ..._existingImageUrls.map((url) => Stack(
              children: [
                ClipRRect(borderRadius: BorderRadius.circular(8), child: Image.network(url, width: 80, height: 80, fit: BoxFit.cover)),
                Positioned(right: 0, child: GestureDetector(onTap: () => setState(() => _existingImageUrls.remove(url)), child: const Icon(Icons.cancel, color: Colors.red, size: 20))),
              ],
            )),
            ..._images.map((f) => Stack(
              children: [
                ClipRRect(borderRadius: BorderRadius.circular(8), child: Image.file(f, width: 80, height: 80, fit: BoxFit.cover)),
                Positioned(right: 0, child: GestureDetector(onTap: () => setState(() => _images.remove(f)), child: const Icon(Icons.cancel, color: Colors.red, size: 20))),
              ],
            )),
            GestureDetector(
              onTap: () => _pickFile(isImage: true),
              child: Container(
                width: 80, height: 80,
                decoration: BoxDecoration(color: Colors.grey[100], borderRadius: BorderRadius.circular(8), border: Border.all(color: Colors.grey[300]!)),
                child: const Icon(Icons.add_a_photo, color: Colors.grey),
              ),
            )
          ],
        ),
      ],
    );
  }

  Future<void> _pickFile({required bool isImage}) async {
    final picked = await _picker.pickImage(source: ImageSource.gallery);
    if (picked != null) {
      setState(() {
        _isUploading = true;
        _uploadProgress = 0.0;
      });
      
      // Simulate upload progress
      for (int i = 0; i <= 10; i++) {
        await Future.delayed(const Duration(milliseconds: 100));
        if (mounted) {
          setState(() {
            _uploadProgress = i / 10.0;
          });
        }
      }

      if (mounted) {
        setState(() {
          _isUploading = false;
          if (isImage) {
            _images.add(File(picked.path));
          } else {
            _documents.add(File(picked.path));
          }
        });
      }
    }
  }

  Widget _buildDocumentPicker() {
    return Column(
      children: [
        if (_isUploading) ...[
          const Text('Uploading...', style: TextStyle(fontSize: 12, color: AppTheme.brandBlue)),
          const SizedBox(height: 4),
          LinearProgressIndicator(value: _uploadProgress, minHeight: 2, color: AppTheme.brandBlue),
          const SizedBox(height: 12),
        ],
        ..._existingDocuments.map((doc) => ListTile(
          leading: const Icon(Icons.insert_drive_file),
          title: Text(doc['file_name'] ?? 'Document'),
          trailing: IconButton(icon: const Icon(Icons.delete, color: Colors.red), onPressed: () => setState(() => _existingDocuments.remove(doc))),
        )),
        ..._documents.map((f) => ListTile(
          leading: const Icon(Icons.insert_drive_file),
          title: Text(p.basename(f.path)),
          trailing: IconButton(icon: const Icon(Icons.delete, color: Colors.red), onPressed: () => setState(() => _documents.remove(f))),
        )),
        const SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: () => _pickFile(isImage: false),
          icon: const Icon(Icons.upload_file),
          label: const Text('Upload Document'),
        ),
      ],
    );
  }

  Widget _inputLabel(String label) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(label, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppTheme.brandNavy)),
    );
  }

  Widget _buildBottomActions(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Row(
        children: [
          if (_currentStep > 1)
            Expanded(
              child: OutlinedButton(
                onPressed: _isSaving ? null : () => setState(() => _currentStep--),
                style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 18), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                child: const Text('Back', style: TextStyle(color: AppTheme.brandNavy, fontWeight: FontWeight.bold)),
              ),
            )
          else
            Expanded(
              child: TextButton.icon(
                onPressed: () => context.pop(),
                icon: const Icon(Icons.arrow_back, size: 18, color: AppTheme.brandNavy),
                label: const Text('Back to Dashboard', style: TextStyle(color: AppTheme.brandNavy, fontWeight: FontWeight.bold)),
              ),
            ),
          const SizedBox(width: 16),
          Expanded(
            flex: 2,
            child: ElevatedButton(
              onPressed: _isSaving ? null : (_currentStep == 4 ? _handlePostJob : _nextStep),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF03358E),
                padding: const EdgeInsets.symmetric(vertical: 18),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _isSaving 
                ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(_currentStep == 4 ? 'Post Job' : 'Continue', style: const TextStyle(fontWeight: FontWeight.bold)),
                      const SizedBox(width: 8),
                      const Icon(Icons.arrow_forward, size: 18),
                    ],
                  ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFooter(BuildContext context) {
    return Column(
      children: [
        const Divider(color: Color(0xFFE2E8F0)),
        const SizedBox(height: 40),
        const Text('© 2024 SERVIO Marketplace. All rights reserved.', style: TextStyle(color: AppTheme.textGray, fontSize: 12)),
        const SizedBox(height: 12),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _footerLink('Privacy Policy'),
            _footerLink('Terms of Service'),
            _footerLink('Trust & Safety'),
          ],
        ),
      ],
    );
  }

  Widget _footerLink(String text) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8),
      child: Text(text, style: const TextStyle(color: Color(0xFF2563EB), fontSize: 12, fontWeight: FontWeight.w500)),
    );
  }
}
