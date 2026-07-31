class Job {
  final int? id;
  final int clientId;
  final String title;
  final String categoryId;
  final String subcategoryId;
  final String description;
  final String? serviceType;
  final String? priority;
  final String? address;
  final String? city;
  final String? state;
  final String? country;
  final String? pincode;
  final double? latitude;
  final double? longitude;
  final bool isRemote;
  final String? startDate;
  final String? startTime;
  final String? duration;
  final String? deadline;
  final bool flexibleSchedule;
  final String? budgetType;
  final double? minBudget;
  final double? maxBudget;
  final String? currency;
  final String? specialInstructions;
  final String? requiredSkills;
  final int professionalsRequired;
  final String status;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  Job({
    this.id,
    required this.clientId,
    required this.title,
    required this.categoryId,
    required this.subcategoryId,
    required this.description,
    this.serviceType,
    this.priority,
    this.address,
    this.city,
    this.state,
    this.country,
    this.pincode,
    this.latitude,
    this.longitude,
    this.isRemote = false,
    this.startDate,
    this.startTime,
    this.duration,
    this.deadline,
    this.flexibleSchedule = false,
    this.budgetType,
    this.minBudget,
    this.maxBudget,
    this.currency = 'USD',
    this.specialInstructions,
    this.requiredSkills,
    this.professionalsRequired = 1,
    this.status = 'draft',
    this.createdAt,
    this.updatedAt,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'client_id': clientId,
      'title': title,
      'category_id': categoryId,
      'subcategory_id': subcategoryId,
      'description': description,
      'service_type': serviceType,
      'priority': priority,
      'address': address,
      'city': city,
      'state': state,
      'country': country,
      'pincode': pincode,
      'latitude': latitude,
      'longitude': longitude,
      'is_remote': isRemote ? 1 : 0,
      'start_date': startDate,
      'start_time': startTime,
      'duration': duration,
      'deadline': deadline,
      'flexible_schedule': flexibleSchedule ? 1 : 0,
      'budget_type': budgetType,
      'min_budget': minBudget,
      'max_budget': maxBudget,
      'currency': currency,
      'special_instructions': specialInstructions,
      'required_skills': requiredSkills,
      'professionals_required': professionalsRequired,
      'status': status,
      'created_at': createdAt?.toIso8601String(),
      'updated_at': updatedAt?.toIso8601String(),
    };
  }

  factory Job.fromMap(Map<String, dynamic> map) {
    return Job(
      id: map['id'],
      clientId: map['client_id'],
      title: map['title'] ?? '',
      categoryId: map['category_id'] ?? '',
      subcategoryId: map['subcategory_id'] ?? '',
      description: map['description'] ?? '',
      serviceType: map['service_type'],
      priority: map['priority'],
      address: map['address'],
      city: map['city'],
      state: map['state'],
      country: map['country'],
      pincode: map['pincode'],
      latitude: map['latitude'],
      longitude: map['longitude'],
      isRemote: map['is_remote'] == 1,
      startDate: map['start_date'],
      startTime: map['start_time'],
      duration: map['duration'],
      deadline: map['deadline'],
      flexibleSchedule: map['flexible_schedule'] == 1,
      budgetType: map['budget_type'],
      minBudget: map['min_budget'],
      maxBudget: map['max_budget'],
      currency: map['currency'] ?? 'USD',
      specialInstructions: map['special_instructions'],
      requiredSkills: map['required_skills'],
      professionalsRequired: map['professionals_required'] ?? 1,
      status: map['status'] ?? 'draft',
      createdAt: map['created_at'] != null ? DateTime.parse(map['created_at']) : null,
      updatedAt: map['updated_at'] != null ? DateTime.parse(map['updated_at']) : null,
    );
  }
}
