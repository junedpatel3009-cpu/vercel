import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:io';
import '../../../widgets/site_header.dart';
import '../../../core/auth/auth_service.dart';
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
  final ImagePicker _picker = ImagePicker();

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

  @override
  void initState() {
    super.initState();
    _loadInitialData();
  }

  Future<void> _loadInitialData() async {
    try {
      final user = await AuthService().getUser();
      if (user != null) {
        final profile = await ApiClient.instance.get('/api/v1/profile');

        if (mounted) {
          setState(() {
            _profileData = profile;
            _fullNameController.text =
                  '${profile['firstName'] ?? ''} ${profile['lastName'] ?? ''}'.trim();
              _emailController.text = profile['email'] ?? '';
              _phoneController.text = profile['phone'] ?? '';
              _addressController.text = profile['address'] ?? '';
              _cityController.text = profile['professionalCity'] ?? '';
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
                Text('${widget.role == 'client' ? 'Client' : 'Professional'} Profile Setup', style: Theme.of(context).textTheme.headlineMedium),
                const SizedBox(height: 12),
                const Text('Please complete your profile to access all features.'),
                const SizedBox(height: 32),
                Center(
                  child: GestureDetector(
                    onTap: () async {
                      try {
                        final XFile? image = await _picker.pickImage(source: ImageSource.gallery);
                        if (image != null) setState(() => _imageFile = File(image.path));
                      } catch (e) {
                        _showFriendlyMsg('Unable to access gallery. Please check permissions.');
                      }
                    },
                    child: CircleAvatar(
                      radius: 50,
                      backgroundColor: Colors.grey[200],
                      backgroundImage: _imageFile != null 
                        ? FileImage(_imageFile!) 
                        : (_profileData?['profile_photo'] != null && _profileData!['profile_photo'].isNotEmpty
                          ? FileImage(File(_profileData!['profile_photo'])) 
                          : const NetworkImage('https://i.pravatar.cc/300')) as ImageProvider,
                      child: const Icon(Icons.camera_alt, color: Colors.white70),
                    ),
                  ),
                ),
                const SizedBox(height: 32),
                _buildField('Full Name', _fullNameController),
                const SizedBox(height: 16),
                _buildField('Email', _emailController, enabled: false),
                const SizedBox(height: 16),
                _buildField('Phone', _phoneController, type: TextInputType.phone),
                const SizedBox(height: 16),
                _buildField('Date of Birth', _dobController, hint: 'YYYY-MM-DD', type: TextInputType.datetime),
                const SizedBox(height: 16),
                _buildField('Address', _addressController),
                const SizedBox(height: 16),
                Row(children: [
                  Expanded(child: _buildField('City', _cityController)), 
                  const SizedBox(width: 16), 
                  Expanded(child: _buildField('Pincode', _pincodeController, type: TextInputType.number))
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
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildField(String label, TextEditingController controller, {bool enabled = true, String? hint, TextInputType type = TextInputType.text}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
        const SizedBox(height: 8),
        TextFormField(
          controller: controller,
          enabled: enabled,
          keyboardType: type,
          decoration: InputDecoration(hintText: hint ?? label),
          validator: (v) {
            if (v == null || v.trim().isEmpty) return 'Please enter your ${label.toLowerCase()}';
            if (label == 'Date of Birth' && !RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(v)) return 'Use YYYY-MM-DD format';
            return null;
          },
        ),
      ],
    );
  }

  Widget _buildButton() {
    return _AnimatedButton(onPressed: _isSaving ? null : _saveProfile, text: 'Complete Setup', isLoading: _isSaving);
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
