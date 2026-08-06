import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../widgets/motion.dart';

/// Client-only professional discovery workspace.
class ClientFindProsScreen extends StatefulWidget {
  const ClientFindProsScreen({super.key});

  @override
  State<ClientFindProsScreen> createState() => _ClientFindProsScreenState();
}

class _ClientFindProsScreenState extends State<ClientFindProsScreen> {
  final _searchController = TextEditingController();
  final _cityController = TextEditingController();
  final _mapController = MapController();
  List<Map<String, dynamic>> _professionals = [];
  final Map<Object, LatLng> _locationsByProfessionalId = {};
  bool _loading = true;
  bool _showMap = false;
  bool _loadingLocations = false;
  bool _verifiedOnly = false;
  bool _topRatedOnly = false;
  bool _availableOnly = false;

  @override
  void initState() {
    super.initState();
    _loadProfessionals();
  }

  @override
  void dispose() {
    _searchController.dispose();
    _cityController.dispose();
    super.dispose();
  }

  Future<void> _loadProfessionals() async {
    try {
      final results = await ApiClient.instance.getList('/api/v1/professionals?limit=50', authenticated: false);
      if (mounted) {
        setState(() => _professionals = results);
      }
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
      }
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _showProfessionalsOnMap() async {
    setState(() => _showMap = true);
    if (_locationsByProfessionalId.isNotEmpty || _loadingLocations) return;

    setState(() => _loadingLocations = true);
    final locations = <Object, LatLng>{};
    for (final professional in _visibleProfessionals) {
      final id = professional['id'];
      if (id == null) continue;
      final point = await _locationFromProfessional(professional);
      if (point != null) locations[id] = point;
    }
    if (!mounted) return;
    setState(() {
      _locationsByProfessionalId.addAll(locations);
      _loadingLocations = false;
    });
  }

  Future<LatLng?> _locationFromProfessional(Map<String, dynamic> professional) async {
    final latitude = double.tryParse('${professional['latitude'] ?? professional['lat'] ?? ''}');
    final longitude = double.tryParse('${professional['longitude'] ?? professional['lng'] ?? professional['lon'] ?? ''}');
    if (latitude != null && longitude != null) return LatLng(latitude, longitude);

    final location = [
      professional['address'],
      professional['serviceArea'],
      professional['professionalCity'],
    ].map((value) => (value ?? '').toString().trim()).firstWhere(
          (value) => value.isNotEmpty,
          orElse: () => '',
        );
    if (location.isEmpty) return null;

    try {
      final response = await http.get(
        Uri.https('nominatim.openstreetmap.org', '/search', {
          'format': 'jsonv2',
          'limit': '1',
          'q': location,
        }),
        headers: const {'User-Agent': 'ServioApp/1.0'},
      );
      final data = jsonDecode(response.body);
      if (data is! List || data.isEmpty || data.first is! Map) return null;
      final result = Map<String, dynamic>.from(data.first as Map);
      final lat = double.tryParse('${result['lat']}');
      final lng = double.tryParse('${result['lon']}');
      return lat != null && lng != null ? LatLng(lat, lng) : null;
    } catch (_) {
      return null;
    }
  }

  void _focusProfessional(Map<String, dynamic> professional) {
    final location = _locationsByProfessionalId[professional['id']];
    if (location == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('This professional has not added a mappable location yet.')));
      return;
    }
    _mapController.move(location, 14);
  }

  List<Map<String, dynamic>> get _visibleProfessionals {
    final query = _searchController.text.trim().toLowerCase();
    final city = _cityController.text.trim().toLowerCase();
    return _professionals.where((pro) {
      final text = '${pro['firstName']} ${pro['lastName']} ${pro['professionalCategory']} ${pro['companyDescription']}'.toLowerCase();
      final rating = double.tryParse((pro['averageRating'] ?? 0).toString()) ?? 0;
      final verified = pro['isVerified'] == true || pro['isVerified'] == 1;
      final isAvailable = (pro['availabilityStatus'] ?? '').toString().toLowerCase() == 'available';
      final proCity = (pro['professionalCity'] ?? '').toString().toLowerCase();
      return (query.isEmpty || text.contains(query)) &&
          (city.isEmpty || proCity.contains(city)) &&
          (!_verifiedOnly || verified) &&
          (!_topRatedOnly || rating >= 4.5) &&
          (!_availableOnly || isAvailable);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF7F9FD),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(icon: const Icon(Icons.arrow_back, color: AppTheme.brandNavy), onPressed: () => context.canPop() ? context.pop() : context.go('/dashboard')),
        title: const Text('Find professionals', style: TextStyle(color: AppTheme.brandNavy, fontWeight: FontWeight.w800)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadProfessionals,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 14, 20, 30),
                children: [
                  const Text('Find the right person for your project', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: AppTheme.brandNavy)),
                  const SizedBox(height: 6),
                  const Text('Search experts, compare their experience, and hire with confidence.', style: TextStyle(color: AppTheme.textGray, height: 1.45)),
                  const SizedBox(height: 18),
                  TextField(
                    controller: _searchController,
                    onChanged: (_) => setState(() {}),
                    decoration: InputDecoration(
                      hintText: 'Search design, plumbing, developer…',
                      prefixIcon: const Icon(Icons.search),
                      suffixIcon: _searchController.text.isEmpty ? null : IconButton(icon: const Icon(Icons.clear), onPressed: () { _searchController.clear(); setState(() {}); }),
                      filled: true,
                      fillColor: Colors.white,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                    ),
                  ),
                  const SizedBox(height: 13),
                  TextField(
                    controller: _cityController,
                    onChanged: (_) => setState(() {}),
                    decoration: InputDecoration(
                      hintText: 'Filter by city',
                      prefixIcon: const Icon(Icons.location_on_outlined),
                      filled: true,
                      fillColor: Colors.white,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                    ),
                  ),
                  const SizedBox(height: 13),
                  Wrap(spacing: 8, runSpacing: 8, children: [
                    FilterChip(label: const Text('Verified pros'), selected: _verifiedOnly, onSelected: (value) => setState(() => _verifiedOnly = value), selectedColor: const Color(0xFFDDE8FF)),
                    FilterChip(label: const Text('Rating 4.5+'), selected: _topRatedOnly, onSelected: (value) => setState(() => _topRatedOnly = value), selectedColor: const Color(0xFFDDE8FF)),
                    FilterChip(label: const Text('Available now'), selected: _availableOnly, onSelected: (value) => setState(() => _availableOnly = value), selectedColor: const Color(0xFFDDE8FF)),
                  ]),
                  const SizedBox(height: 13),
                  SegmentedButton<bool>(
                    segments: const [
                      ButtonSegment(value: false, icon: Icon(Icons.view_list_outlined), label: Text('List')),
                      ButtonSegment(value: true, icon: Icon(Icons.map_outlined), label: Text('Map')),
                    ],
                    selected: {_showMap},
                    onSelectionChanged: (selection) {
                      if (selection.first) {
                        _showProfessionalsOnMap();
                      } else {
                        setState(() => _showMap = false);
                      }
                    },
                  ),
                  const SizedBox(height: 22),
                  Text('${_visibleProfessionals.length} professionals found', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppTheme.brandNavy)),
                  const SizedBox(height: 12),
                  if (_visibleProfessionals.isEmpty)
                    _emptyState()
                  else if (_showMap)
                    _mapAndProfessionalList()
                  else
                    ..._visibleProfessionals.asMap().entries.map((entry) => FadeSlideIn(delay: Duration(milliseconds: entry.key * 45), child: _professionalCard(entry.value))),
                ],
              ),
            ),
    );
  }

  Widget _mapAndProfessionalList() {
    final visible = _visibleProfessionals;
    final markers = visible
        .where((professional) => _locationsByProfessionalId[professional['id']] != null)
        .map((professional) {
      final location = _locationsByProfessionalId[professional['id']]!;
      final name = '${professional['firstName'] ?? ''} ${professional['lastName'] ?? ''}'.trim();
      return Marker(
        point: location,
        width: 54,
        height: 54,
        child: Tooltip(
          message: name.isEmpty ? 'Professional' : name,
          child: GestureDetector(
            onTap: () {
              final id = professional['id'];
              if (id != null) context.push('/pro/$id');
            },
            child: const Icon(Icons.location_on, size: 46, color: AppTheme.brandBlue),
          ),
        ),
      );
    }).toList();
    final center = markers.isNotEmpty ? markers.first.point : const LatLng(20.5937, 78.9629);

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Container(
        height: 330,
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(borderRadius: BorderRadius.circular(20), border: Border.all(color: const Color(0xFFE5EAF2))),
        child: _loadingLocations
            ? const Center(child: CircularProgressIndicator())
            : FlutterMap(
                mapController: _mapController,
                options: MapOptions(initialCenter: center, initialZoom: markers.length == 1 ? 11 : 5),
                children: [
                  TileLayer(
                    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                    userAgentPackageName: 'com.servio.app',
                  ),
                  MarkerLayer(markers: markers),
                ],
              ),
      ),
      const SizedBox(height: 10),
      Text(
        markers.isEmpty
            ? 'No locations have been added for these professionals yet.'
            : 'Tap a pin or a professional below to open their profile.',
        style: const TextStyle(color: AppTheme.textGray, fontSize: 12),
      ),
      const SizedBox(height: 12),
      ...visible.asMap().entries.map((entry) => FadeSlideIn(
            delay: Duration(milliseconds: entry.key * 45),
            child: _professionalCard(entry.value, showLocation: true),
          )),
    ]);
  }

  Widget _professionalCard(Map<String, dynamic> pro, {bool showLocation = false}) {
    final name = '${pro['firstName'] ?? ''} ${pro['lastName'] ?? ''}'.trim().isEmpty ? 'Professional' : '${pro['firstName'] ?? ''} ${pro['lastName'] ?? ''}'.trim();
    final id = pro['id'];
    final avatar = (pro['avatarUrl'] ?? '').toString();
    final verified = pro['isVerified'] == true || pro['isVerified'] == 1;
    final rating = (double.tryParse((pro['averageRating'] ?? 0).toString()) ?? 0).toStringAsFixed(1);
    final rate = pro['hourlyRate'] ?? 0;
    return Container(
      margin: const EdgeInsets.only(bottom: 13),
      padding: const EdgeInsets.all(17),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: const Color(0xFFE5EAF2))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          CircleAvatar(radius: 25, backgroundColor: const Color(0xFFEAF0FF), backgroundImage: avatar.startsWith('http') ? NetworkImage(avatar) : null, child: avatar.startsWith('http') ? null : const Icon(Icons.person_outline, color: AppTheme.brandBlue)),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [Expanded(child: Text(name, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: AppTheme.brandNavy))), if (verified) const Icon(Icons.verified_rounded, color: Color(0xFF2450B8), size: 19)]),
            const SizedBox(height: 3), Text((pro['professionalCategory'] ?? 'Service professional').toString(), style: const TextStyle(color: AppTheme.textGray)),
          ])),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [const Icon(Icons.star_rounded, color: Color(0xFFF59E0B), size: 19), Text(rating, style: const TextStyle(fontWeight: FontWeight.w800, color: AppTheme.brandNavy))]),
        ]),
        if ((pro['companyDescription'] ?? '').toString().trim().isNotEmpty) ...[const SizedBox(height: 13), Text(pro['companyDescription'].toString(), maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppTheme.textGray, height: 1.4))],
        const SizedBox(height: 15),
        Row(children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('STARTING AT', style: TextStyle(fontSize: 10, color: AppTheme.textGray, fontWeight: FontWeight.w800)), Text('\$$rate/hr', style: const TextStyle(fontSize: 18, color: AppTheme.brandNavy, fontWeight: FontWeight.w900))])),
          if (showLocation) IconButton(tooltip: 'Show location', onPressed: () => _focusProfessional(pro), icon: const Icon(Icons.location_on_outlined, color: AppTheme.brandBlue)),
          OutlinedButton(onPressed: id == null ? null : () => context.push('/pro/$id'), child: const Text('View')),
          const SizedBox(width: 8),
          ElevatedButton(onPressed: id == null ? null : () => context.push('/pro/$id'), style: ElevatedButton.styleFrom(backgroundColor: AppTheme.brandBlue, foregroundColor: Colors.white), child: const Text('Hire')),
        ]),
      ]),
    );
  }

  Widget _emptyState() => Container(padding: const EdgeInsets.all(34), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20)), child: const Column(children: [Icon(Icons.person_search_outlined, size: 48, color: AppTheme.textGray), SizedBox(height: 12), Text('No professionals match these filters', style: TextStyle(fontWeight: FontWeight.w700)), SizedBox(height: 5), Text('Try another search or remove a filter.', textAlign: TextAlign.center, style: TextStyle(color: AppTheme.textGray))]));
}
