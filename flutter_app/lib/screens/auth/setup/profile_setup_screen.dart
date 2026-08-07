import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import '../../../widgets/site_header.dart';
import '../../../core/auth/auth_service.dart';
import '../../../core/auth/biometric_service.dart';
import '../../../core/api/api_client.dart';

class ProfileSetupScreen extends StatefulWidget {
  final String role; // 'client' or 'professional'
  const ProfileSetupScreen({super.key, required this.role});

  @override
  State<ProfileSetupScreen> createState() => _ProfileSetupScreenState();
}

class _ProfileSetupScreenState extends State<ProfileSetupScreen> {
  final _formKey = GlobalKey<FormState>();
  bool _isLoading = true;
  bool _isSaving = false;
  Map<String, dynamic>? _profileData;
  File? _imageFile;
  String? _uploadedAvatarDataUrl;
  final ImagePicker _picker = ImagePicker();
  final BiometricService _biometricService = BiometricService();
  bool _biometricEnabled = false;
  bool _biometricAvailable = false;
  
  final _fullNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _dobController = TextEditingController();
  final _addressController = TextEditingController();
  final _cityController = TextEditingController();
  final _pincodeController = TextEditingController();

  final _professionController = TextEditingController();
  final _experienceController = TextEditingController();
  final _hourlyRateController = TextEditingController();
  final _companyNameController = TextEditingController();
  final _companyWebsiteController = TextEditingController();
  final _industryController = TextEditingController();
  final _teamSizeController = TextEditingController();
  final _companyDescriptionController = TextEditingController();
  final _hiringNeedsController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadInitialData();
    _loadBiometricState();
  }

  Future<void> _loadBiometricState() async {
    final enabled = await AuthService().isBiometricEnabled();
    final available = await _biometricService.isBiometricAvailable();
    if (mounted) {
      setState(() {
        _biometricEnabled = enabled;
        _biometricAvailable = available;
      });
    }
  }

  Future<void> _changeBiometric(bool enabled) async {
    if (enabled && !_biometricAvailable) {
      _showFriendlyMsg('Fingerprint or face unlock is not available on this phone.');
      return;
    }

    String? type;
    if (enabled) {
      final verified = await _biometricService.authenticate();
      if (!verified) {
        _showFriendlyMsg('Biometric verification was not completed.');
        return;
      }
      final options = await _biometricService.getAvailableBiometrics();
      type = options.isEmpty ? 'device' : options.first.name;
    }

    try {
      await ApiClient.instance.patch(
        '/api/v1/profile/biometric',
        data: {'enabled': enabled, 'type': type},
      );
      await AuthService().setBiometricPreference(enabled, type);
      final user = await AuthService().getUser();
      if (user != null) {
        user['biometric_enabled'] = enabled;
        user['biometric_type'] = type;
        await AuthService().saveUser(user);
      }
      if (mounted) {
        setState(() => _biometricEnabled = enabled);
        _showFriendlyMsg(enabled ? 'Biometric login enabled.' : 'Biometric login disabled.');
      }
    } on ApiException {
      _showFriendlyMsg('Could not save biometric preference. Please try again.');
    }
  }

  Future<void> _loadInitialData() async {
    try {
      final user = await AuthService().getUser();
      if (user != null) {
        Map<String, dynamic> profile = Map<String, dynamic>.from(user);
        try {
          final serverProfile = await ApiClient.instance.get(
            widget.role == 'client' ? '/api/v1/client/profile' : '/api/v1/profile',
          );
          profile.addAll(serverProfile);
        } on ApiException {
          // The saved login session still contains the user's basic profile
          // data, so keep the form useful if the server is briefly slow.
        }

        if (mounted) {
          setState(() {
            _profileData = profile;
            _fullNameController.text = (profile['fullName'] ??
                  '${profile['firstName'] ?? ''} ${profile['lastName'] ?? ''}')
                .toString()
                .trim();
              _emailController.text = (profile['email'] ?? user['email'] ?? '').toString();
              _phoneController.text = (profile['phone'] ?? user['phone'] ?? '').toString();
               _addressController.text = profile['address'] ?? '';
               _cityController.text = profile['professionalCity'] ?? '';
               if (widget.role == 'client') {
                 _companyNameController.text = profile['companyName'] ?? '';
                 _companyWebsiteController.text = profile['companyWebsite'] ?? '';
                 _industryController.text = profile['industry'] ?? '';
                 _teamSizeController.text = profile['teamSize'] ?? '';
                 _companyDescriptionController.text = profile['companyDescription'] ?? '';
                 _hiringNeedsController.text = (profile['hiringNeeds'] as List? ?? []).join(', ');
                 final locations = profile['savedLocations'] as List? ?? [];
                 if (locations.isNotEmpty && locations.first is Map) {
                   _cityController.text = (locations.first['label'] ?? '').toString();
                   _addressController.text = (locations.first['address'] ?? _addressController.text).toString();
                 }
               }
              if (widget.role == 'professional') {
              _professionController.text = profile['professionalCategory'] ?? '';
                _hourlyRateController.text = profile['hourlyRate']?.toString() ?? '';
              }
            _isLoading = false;
          });
        }
      } else {
        if (mounted) context.go('/login');
      }
    } catch (e) {
      if (mounted) {
        _showFriendlyMsg('Unable to load profile data. Please try again later.');
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _saveProfile() async {
    if (!_formKey.currentState!.validate()) {
      _showFriendlyMsg('Please complete all required fields correctly.');
      return;
    }
    
    setState(() => _isSaving = true);
    try {
      final user = await AuthService().getUser();
      if (user == null) {
        if (mounted) context.go('/login');
        return;
      }

      final nameParts = _fullNameController.text.trim().split(RegExp(r'\s+'));
      final data = <String, dynamic>{
        'firstName': nameParts.first,
        'lastName': nameParts.length > 1 ? nameParts.skip(1).join(' ') : '-',
        'phone': _phoneController.text.trim(),
        'address': _addressController.text.trim(),
      };
      if (_uploadedAvatarDataUrl != null) data['avatarUrl'] = _uploadedAvatarDataUrl;

      if (widget.role == 'client') {
        final hiringNeeds = _hiringNeedsController.text.split(',').map((item) => item.trim()).where((item) => item.isNotEmpty).toList();
        final clientData = <String, dynamic>{
          'fullName': _fullNameController.text.trim(),
          'email': _emailController.text.trim(),
          'phone': _phoneController.text.trim(),
          'companyName': _companyNameController.text.trim(),
          'companyWebsite': _companyWebsiteController.text.trim(),
          'industry': _industryController.text.trim(),
          'teamSize': _teamSizeController.text.trim(),
          'companyDescription': _companyDescriptionController.text.trim(),
          'address': _addressController.text.trim(),
          'profilePhotoUrl': _uploadedAvatarDataUrl ?? _profileData?['avatarUrl'] ?? '',
          'savedLocations': [
            {'label': _cityController.text.trim().isEmpty ? 'Primary location' : _cityController.text.trim(), 'address': _addressController.text.trim()},
          ],
          'hiringNeeds': hiringNeeds,
        };
        await ApiClient.instance.patch('/api/v1/client/profile', data: clientData);
        // Keep the current signed-in user shape (including its role) while
        // refreshing the details displayed locally.
        final accessToken = await AuthService().getAccessToken();
        if (accessToken != null) {
          await AuthService().saveSession(
            {
              ...user,
              'firstName': nameParts.first,
              'lastName': nameParts.length > 1 ? nameParts.skip(1).join(' ') : '-',
              'phone': _phoneController.text.trim(),
            },
            accessToken,
            isProfileComplete: true,
          );
        }
        if (mounted) {
          _showFriendlyMsg('Client profile saved successfully!');
          context.go('/');
        }
        return;
      }

      if (widget.role == 'professional') {
        data.addAll({
          'professionalCategory': _professionController.text.trim(),
          'professionalCity': _cityController.text.trim(),
          'hourlyRate': int.tryParse(_hourlyRateController.text),
        });
      }
      final updated = await ApiClient.instance.patch('/api/v1/profile', data: data);
      await AuthService().saveSession(
        updated,
        (await AuthService().getAccessToken())!,
        isProfileComplete: true,
      );
      
      if (mounted) {
        _showFriendlyMsg('Profile completed successfully!');
        context.go('/');
      }
    } catch (e) {
      if (mounted) {
        _showFriendlyMsg('Unable to save your profile. Please try again later.');
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  void _showFriendlyMsg(String msg) {
    if (mounted) {
      ScaffoldMessenger.of(context).hideCurrentSnackBar();
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
    }
  }

  ImageProvider? _savedAvatar() {
    final value = (_profileData?['avatarUrl'] ?? '').toString();
    if (value.startsWith('http://') || value.startsWith('https://')) return NetworkImage(value);
    if (value.startsWith('data:image')) {
      try {
        return MemoryImage(base64Decode(value.substring(value.indexOf(',') + 1)));
      } catch (_) {
        return null;
      }
    }
    return null;
  }

  Future<void> _logout() async {
    await AuthService().logout();
    if (mounted) context.go('/');
  }

  @override
  void dispose() {
    _fullNameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _dobController.dispose();
    _addressController.dispose();
    _cityController.dispose();
    _pincodeController.dispose();
    _professionController.dispose();
    _experienceController.dispose();
    _hourlyRateController.dispose();
    _companyNameController.dispose();
    _companyWebsiteController.dispose();
    _industryController.dispose();
    _teamSizeController.dispose();
    _companyDescriptionController.dispose();
    _hiringNeedsController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: const SiteHeaderWidget(),
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.role == 'client' ? 'Client company profile' : 'Professional Profile Setup',
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                const SizedBox(height: 12),
                Text(
                  widget.role == 'client'
                      ? 'Tell professionals who you are, where you work, and the skills you need.'
                      : 'Please complete your profile to access all features.',
                ),
                const SizedBox(height: 32),
                Center(
                  child: GestureDetector(
                    onTap: () async {
                      final image = await _picker.pickImage(source: ImageSource.gallery, imageQuality: 80);
                      if (image == null) return;
                      final bytes = await image.readAsBytes();
                      if (!mounted) return;
                      setState(() {
                        _imageFile = File(image.path);
                        _uploadedAvatarDataUrl = 'data:image/jpeg;base64,${base64Encode(bytes)}';
                      });
                    },
                    child: CircleAvatar(
                      radius: 50,
                      backgroundColor: const Color(0xFFE8F0FF),
                      backgroundImage: _imageFile != null ? FileImage(_imageFile!) : _savedAvatar(),
                      child: _imageFile == null && _savedAvatar() == null
                          ? const Icon(Icons.person_outline, size: 48, color: Color(0xFF1E40AF))
                          : null,
                    ),
                  ),
                ),
                const SizedBox(height: 32),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF6F8FF),
                    border: Border.all(color: const Color(0xFFD9E3F8)),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: const BoxDecoration(color: Color(0xFFE1EAFF), shape: BoxShape.circle),
                        child: const Icon(Icons.fingerprint_rounded, color: Color(0xFF2450B8)),
                      ),
                      const SizedBox(width: 12),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Biometric login', style: TextStyle(fontWeight: FontWeight.w800)),
                            SizedBox(height: 3),
                            Text('Use fingerprint or face unlock next time.', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                          ],
                        ),
                      ),
                      Switch(value: _biometricEnabled, onChanged: _changeBiometric),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                _buildField('Full Name', _fullNameController),
                const SizedBox(height: 16),
                _buildField('Email', _emailController, enabled: false),
                const SizedBox(height: 16),
                _buildField('Phone', _phoneController, type: TextInputType.phone),
                const SizedBox(height: 16),
                if (widget.role == 'client') ...[
                  const Text('Company details', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 17)),
                  const SizedBox(height: 16),
                  _buildField('Company Name', _companyNameController),
                  const SizedBox(height: 16),
                  _buildField('Company Website', _companyWebsiteController, hint: 'https://example.com', required: false),
                  const SizedBox(height: 16),
                  Row(children: [
                    Expanded(child: _buildField('Industry', _industryController)),
                    const SizedBox(width: 16),
                    Expanded(child: _buildField('Team Size', _teamSizeController, hint: 'e.g. 1-10')),
                  ]),
                  const SizedBox(height: 16),
                  _buildField(
                    'Company Description',
                    _companyDescriptionController,
                    hint: 'Tell professionals about your company and goals',
                    maxLines: 4,
                  ),
                  const SizedBox(height: 16),
                  _buildField('Hiring Needs / Skills', _hiringNeedsController, hint: 'e.g. UI design, Flutter, SEO'),
                  const SizedBox(height: 16),
                ],
                if (widget.role != 'client') ...[
                  _buildField('Date of Birth', _dobController, hint: 'YYYY-MM-DD', type: TextInputType.datetime),
                  const SizedBox(height: 16),
                ],
                if (widget.role == 'client') ...[
                  const Text('Primary saved location', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 17)),
                  const SizedBox(height: 16),
                ],
                _buildField('Address', _addressController),
                const SizedBox(height: 16),
                Row(children: [
                  Expanded(child: _buildField(widget.role == 'client' ? 'Location Label' : 'City', _cityController)),
                  const SizedBox(width: 16), 
                  Expanded(child: _buildField('Pincode', _pincodeController, type: TextInputType.number, required: widget.role != 'client'))
                ]),
                if (widget.role == 'professional') ...[
                  const SizedBox(height: 16),
                  _buildField('Profession', _professionController),
                  const SizedBox(height: 16),
                  Row(children: [
                    Expanded(child: _buildField('Experience (Years)', _experienceController, type: TextInputType.number)), 
                    const SizedBox(width: 16), 
                    Expanded(child: _buildField('Hourly Rate (\$)', _hourlyRateController, type: TextInputType.number))
                  ]),
                ],
                const SizedBox(height: 40),
                _buildButton(),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: TextButton.icon(
                    onPressed: _logout,
                    icon: const Icon(Icons.logout_outlined),
                    label: const Text('Log out'),
                    style: TextButton.styleFrom(foregroundColor: Colors.redAccent),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildField(
    String label,
    TextEditingController controller, {
    bool enabled = true,
    bool required = true,
    String? hint,
    TextInputType type = TextInputType.text,
    int maxLines = 1,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
        const SizedBox(height: 8),
        TextFormField(
          controller: controller,
          enabled: enabled,
          keyboardType: type,
          maxLines: maxLines,
          decoration: InputDecoration(hintText: hint ?? label),
          validator: (v) {
            if (required && (v == null || v.trim().isEmpty)) return 'Please enter your ${label.toLowerCase()}';
            if (label == 'Date of Birth' && !RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(v ?? '')) return 'Use YYYY-MM-DD format';
            if (label == 'Company Description' && v != null && v.trim().length < 20) return 'Use at least 20 characters';
            return null;
          },
        ),
      ],
    );
  }

  Widget _buildButton() {
    return _AnimatedButton(
      onPressed: _isSaving ? null : _saveProfile,
      text: widget.role == 'client' ? 'Save company profile' : 'Complete Setup',
      isLoading: _isSaving,
    );
  }
}

class _AnimatedButton extends StatefulWidget {
  final VoidCallback? onPressed;
  final String text;
  final bool isLoading;
  const _AnimatedButton({this.onPressed, required this.text, required this.isLoading});
  @override
  State<_AnimatedButton> createState() => _AnimatedButtonState();
}

class _AnimatedButtonState extends State<_AnimatedButton> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scale;
  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 100));
    _scale = Tween<double>(begin: 1.0, end: 0.95).animate(_controller);
  }
  @override
  void dispose() { _controller.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) {
    final isDisabled = widget.onPressed == null || widget.isLoading;
    return GestureDetector(
      onTapDown: (_) => !isDisabled ? _controller.forward() : null,
      onTapUp: (_) { if (!isDisabled) { _controller.reverse(); widget.onPressed!(); } },
      onTapCancel: () => _controller.reverse(),
      child: ScaleTransition(
        scale: _scale,
        child: SizedBox(
          width: double.infinity, 
          height: 54, 
          child: ElevatedButton(
            onPressed: null, 
            style: ElevatedButton.styleFrom(
              disabledBackgroundColor: isDisabled ? Colors.grey[300] : Theme.of(context).colorScheme.primary,
              disabledForegroundColor: Colors.white,
            ),
            child: widget.isLoading 
              ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)) 
              : Text(widget.text),
          ),
        ),
      ),
    );
  }
}
