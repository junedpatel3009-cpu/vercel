import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:http/http.dart' as http;

class PickedLocation {
  const PickedLocation({
    required this.latitude,
    required this.longitude,
    this.address = '',
    this.city = '',
    this.state = '',
    this.country = '',
    this.pincode = '',
  });

  final double latitude;
  final double longitude;
  final String address;
  final String city;
  final String state;
  final String country;
  final String pincode;
}

/// A searchable OpenStreetMap location picker. Selecting a result or map pin
/// reverse-geocodes the location so the job form can fill its address fields.
class LocationPickerScreen extends StatefulWidget {
  const LocationPickerScreen({
    super.key,
    this.initialLatitude,
    this.initialLongitude,
  });

  final double? initialLatitude;
  final double? initialLongitude;

  @override
  State<LocationPickerScreen> createState() => _LocationPickerScreenState();
}

class _LocationPickerScreenState extends State<LocationPickerScreen> {
  static const _fallback = LatLng(20.5937, 78.9629);
  late LatLng _selected;
  final _mapController = MapController();
  final _searchController = TextEditingController();
  List<Map<String, dynamic>> _results = [];
  bool _isSearching = false;
  String _address = '';
  String _city = '';
  String _state = '';
  String _country = '';
  String _pincode = '';

  @override
  void initState() {
    super.initState();
    _selected = LatLng(
      widget.initialLatitude ?? _fallback.latitude,
      widget.initialLongitude ?? _fallback.longitude,
    );
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _searchPlaces() async {
    final query = _searchController.text.trim();
    if (query.length < 2) return;
    setState(() => _isSearching = true);
    try {
      final uri = Uri.https('nominatim.openstreetmap.org', '/search', {
        'format': 'jsonv2',
        'addressdetails': '1',
        'limit': '5',
        'q': query,
      });
      final response = await http.get(uri, headers: const {'User-Agent': 'ServioJobApp/1.0'});
      final data = jsonDecode(response.body);
      if (!mounted) return;
      setState(() => _results = data is List
          ? data.whereType<Map>().map((item) => Map<String, dynamic>.from(item)).toList()
          : []);
    } catch (_) {
      if (mounted) setState(() => _results = []);
    } finally {
      if (mounted) setState(() => _isSearching = false);
    }
  }

  void _applyAddress(Map<String, dynamic>? rawAddress, {String? displayName}) {
    final address = rawAddress ?? const <String, dynamic>{};
    final road = (address['road'] ?? '').toString();
    final houseNumber = (address['house_number'] ?? '').toString();
    _address = [houseNumber, road].where((part) => part.isNotEmpty).join(' ');
    if (_address.isEmpty) _address = displayName ?? '';
    _city = (address['city'] ?? address['town'] ?? address['village'] ?? address['municipality'] ?? '').toString();
    _state = (address['state'] ?? '').toString();
    _country = (address['country'] ?? '').toString();
    _pincode = (address['postcode'] ?? '').toString();
  }

  Future<void> _selectResult(Map<String, dynamic> result) async {
    final latitude = double.tryParse('${result['lat']}');
    final longitude = double.tryParse('${result['lon']}');
    if (latitude == null || longitude == null) return;
    final point = LatLng(latitude, longitude);
    setState(() {
      _selected = point;
      _results = [];
      _searchController.text = (result['display_name'] ?? '').toString();
      _applyAddress(result['address'] is Map ? Map<String, dynamic>.from(result['address']) : null,
          displayName: _searchController.text);
    });
    _mapController.move(point, 16);
  }

  Future<void> _selectMapPoint(LatLng point) async {
    setState(() => _selected = point);
    try {
      final uri = Uri.https('nominatim.openstreetmap.org', '/reverse', {
        'format': 'jsonv2',
        'addressdetails': '1',
        'lat': point.latitude.toString(),
        'lon': point.longitude.toString(),
      });
      final response = await http.get(uri, headers: const {'User-Agent': 'ServioJobApp/1.0'});
      final data = jsonDecode(response.body);
      if (!mounted || data is! Map) return;
      setState(() {
        _applyAddress(data['address'] is Map ? Map<String, dynamic>.from(data['address']) : null,
            displayName: data['display_name']?.toString());
        _searchController.text = data['display_name']?.toString() ?? _searchController.text;
      });
    } catch (_) {
      // Keep the selected coordinates if reverse geocoding is temporarily unavailable.
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Pick job location'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(
              context,
              PickedLocation(
                latitude: _selected.latitude,
                longitude: _selected.longitude,
                address: _address,
                city: _city,
                state: _state,
                country: _country,
                pincode: _pincode,
              ),
            ),
            child: const Text('Done'),
          ),
        ],
      ),
      body: Stack(
        children: [
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: _selected,
              initialZoom: 14,
              onTap: (_, point) => _selectMapPoint(point),
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.example.servio_flutter',
              ),
              MarkerLayer(
                markers: [
                  Marker(
                    point: _selected,
                    width: 48,
                    height: 48,
                    child: const Icon(Icons.location_on, color: Colors.red, size: 42),
                  ),
                ],
              ),
            ],
          ),
          Positioned(
            top: 16,
            left: 16,
            right: 16,
            child: Column(
              children: [
                Material(
                  elevation: 6,
                  borderRadius: BorderRadius.circular(14),
                  child: TextField(
                    controller: _searchController,
                    textInputAction: TextInputAction.search,
                    onSubmitted: (_) => _searchPlaces(),
                    decoration: InputDecoration(
                      hintText: 'Search a place, e.g. Bharuch',
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                      suffixIcon: IconButton(
                        onPressed: _isSearching ? null : _searchPlaces,
                        icon: _isSearching
                            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                            : const Icon(Icons.search),
                      ),
                    ),
                  ),
                ),
                if (_results.isNotEmpty)
                  Material(
                    elevation: 6,
                    child: ListView.separated(
                      shrinkWrap: true,
                      itemCount: _results.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (_, index) => ListTile(
                        dense: true,
                        leading: const Icon(Icons.location_on_outlined),
                        title: Text(_results[index]['display_name']?.toString() ?? ''),
                        onTap: () => _selectResult(_results[index]),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          Positioned(
            left: 16,
            right: 16,
            bottom: 24,
            child: Material(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              elevation: 8,
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Text(
                  '${_address.isEmpty ? 'Search or tap the map to place the pin' : _address}\n${_city.isEmpty ? '${_selected.latitude.toStringAsFixed(6)}, ${_selected.longitude.toStringAsFixed(6)}' : '$_city${_pincode.isEmpty ? '' : ', $_pincode'}'}',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
