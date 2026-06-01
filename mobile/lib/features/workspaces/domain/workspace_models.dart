class MobileWorkspace {
  final String id;
  final String name;
  final String slug;
  final String? description;
  final String? businessType;
  final String? phone;
  final String? email;
  final String? website;
  final String? logoUrl;
  final int maxMembers;
  final bool isActive;
  final Map<String, dynamic> settings;
  final DateTime createdAt;

  const MobileWorkspace({
    required this.id,
    required this.name,
    required this.slug,
    this.description,
    this.businessType,
    this.phone,
    this.email,
    this.website,
    this.logoUrl,
    this.maxMembers = 5,
    this.isActive = true,
    this.settings = const {},
    required this.createdAt,
  });

  factory MobileWorkspace.fromJson(Map<String, dynamic> json) {
    return MobileWorkspace(
      id: _readString(json['id']),
      name: _readString(json['name']),
      slug: _readString(json['slug']),
      description: _readOptionalString(json['description']),
      businessType: _readOptionalString(json['business_type']),
      phone: _readOptionalString(json['phone']),
      email: _readOptionalString(json['email']),
      website: _readOptionalString(json['website']),
      logoUrl: _readOptionalString(json['logo_url']),
      maxMembers: _toInt(json['max_members'], fallback: 5),
      isActive: _toBool(json['is_active']),
      settings: _readMap(json['settings']),
      createdAt: _parseDate(json['created_at']),
    );
  }
}

class MobileWorkspaceMember {
  final String id;
  final String userId;
  final String role;
  final bool isActive;
  final DateTime? joinedAt;
  final MobileWorkspaceProfile? profile;

  const MobileWorkspaceMember({
    required this.id,
    required this.userId,
    required this.role,
    this.isActive = true,
    this.joinedAt,
    this.profile,
  });

  factory MobileWorkspaceMember.fromJson(Map<String, dynamic> json) {
    Map<String, dynamic>? profileJson;
    final raw = json['profiles'];
    if (raw is Map<String, dynamic>) {
      profileJson = raw;
    } else if (raw is Map) {
      profileJson = raw.cast<String, dynamic>();
    }

    return MobileWorkspaceMember(
      id: _readString(json['id']),
      userId: _readString(json['user_id']),
      role: _readString(json['role'], fallback: 'member'),
      isActive: _toBool(json['is_active']),
      joinedAt: _parseDate(json['joined_at']),
      profile: profileJson != null ? MobileWorkspaceProfile.fromJson(profileJson) : null,
    );
  }
}

class MobileWorkspaceProfile {
  final String id;
  final String fullName;
  final String? avatarUrl;
  final String? email;
  final String? phone;

  const MobileWorkspaceProfile({
    required this.id,
    required this.fullName,
    this.avatarUrl,
    this.email,
    this.phone,
  });

  factory MobileWorkspaceProfile.fromJson(Map<String, dynamic> json) {
    return MobileWorkspaceProfile(
      id: _readString(json['id']),
      fullName: _readString(json['full_name']),
      avatarUrl: _readOptionalString(json['avatar_url']),
      email: _readOptionalString(json['email']),
      phone: _readOptionalString(json['phone']),
    );
  }
}

class MobileWorkspaceBranch {
  final String id;
  final String name;
  final String? address;
  final String? phone;
  final String? email;
  final double? latitude;
  final double? longitude;
  final double serviceAreaRadiusKm;
  final bool isActive;

  const MobileWorkspaceBranch({
    required this.id,
    required this.name,
    this.address,
    this.phone,
    this.email,
    this.latitude,
    this.longitude,
    this.serviceAreaRadiusKm = 5,
    this.isActive = true,
  });

  factory MobileWorkspaceBranch.fromJson(Map<String, dynamic> json) {
    return MobileWorkspaceBranch(
      id: _readString(json['id']),
      name: _readString(json['name']),
      address: _readOptionalString(json['address']),
      phone: _readOptionalString(json['phone']),
      email: _readOptionalString(json['email']),
      latitude: _toOptionalDouble(json['latitude']),
      longitude: _toOptionalDouble(json['longitude']),
      serviceAreaRadiusKm: _toDouble(json['service_area_radius_km'], fallback: 5),
      isActive: _toBool(json['is_active']),
    );
  }
}

class MobileWorkspaceRule {
  final String id;
  final String name;
  final String? category;
  final int priority;
  final double? maxDistanceKm;
  final int maxLeadsPerMember;
  final bool roundRobin;
  final int slaMinutes;
  final bool isActive;

  const MobileWorkspaceRule({
    required this.id,
    required this.name,
    this.category,
    this.priority = 100,
    this.maxDistanceKm,
    this.maxLeadsPerMember = 10,
    this.roundRobin = true,
    this.slaMinutes = 15,
    this.isActive = true,
  });

  factory MobileWorkspaceRule.fromJson(Map<String, dynamic> json) {
    return MobileWorkspaceRule(
      id: _readString(json['id']),
      name: _readString(json['name']),
      category: _readOptionalString(json['category']),
      priority: _toInt(json['priority'], fallback: 100),
      maxDistanceKm: _toOptionalDouble(json['max_distance_km']),
      maxLeadsPerMember: _toInt(json['max_leads_per_member'], fallback: 10),
      roundRobin: _toBool(json['round_robin']),
      slaMinutes: _toInt(json['sla_minutes'], fallback: 15),
      isActive: _toBool(json['is_active']),
    );
  }
}

class MobileWorkspaceAnalytics {
  final int totalMembers;
  final int activeMembers;
  final int totalOrders;
  final int completedOrders;
  final double totalRevenue;
  final double avgOrderValue;
  final List<MobileWorkspaceActivity> recentActivity;
  final List<MobileWorkspaceAnalyticsMember> members;

  const MobileWorkspaceAnalytics({
    this.totalMembers = 0,
    this.activeMembers = 0,
    this.totalOrders = 0,
    this.completedOrders = 0,
    this.totalRevenue = 0,
    this.avgOrderValue = 0,
    this.recentActivity = const [],
    this.members = const [],
  });

  factory MobileWorkspaceAnalytics.fromJson(Map<String, dynamic> json) {
    return MobileWorkspaceAnalytics(
      totalMembers: _toInt(json['totalMembers']),
      activeMembers: _toInt(json['activeMembers']),
      totalOrders: _toInt(json['totalOrders']),
      completedOrders: _toInt(json['completedOrders']),
      totalRevenue: _toDouble(json['totalRevenue']),
      avgOrderValue: _toDouble(json['avgOrderValue']),
      recentActivity: _parseList<MobileWorkspaceActivity>(
        json['recentActivity'],
        (e) => MobileWorkspaceActivity.fromJson(Map<String, dynamic>.from(e as Map)),
      ),
      members: _parseList<MobileWorkspaceAnalyticsMember>(
        json['members'],
        (e) => MobileWorkspaceAnalyticsMember.fromJson(Map<String, dynamic>.from(e as Map)),
      ),
    );
  }
}

class MobileWorkspaceActivity {
  final String id;
  final String action;
  final String? description;
  final DateTime? createdAt;

  const MobileWorkspaceActivity({
    required this.id,
    required this.action,
    this.description,
    this.createdAt,
  });

  factory MobileWorkspaceActivity.fromJson(Map<String, dynamic> json) {
    return MobileWorkspaceActivity(
      id: _readString(json['id']),
      action: _readString(json['action']),
      description: _readOptionalString(json['description']),
      createdAt: _parseDate(json['created_at']),
    );
  }
}

class MobileWorkspaceAnalyticsMember {
  final String userId;
  final String role;
  final bool isActive;
  final String? fullName;

  const MobileWorkspaceAnalyticsMember({
    required this.userId,
    required this.role,
    this.isActive = true,
    this.fullName,
  });

  factory MobileWorkspaceAnalyticsMember.fromJson(Map<String, dynamic> json) {
    String? fullName;
    final raw = json['profiles'];
    if (raw is Map) {
      fullName = _readOptionalString(raw['full_name']);
    }

    return MobileWorkspaceAnalyticsMember(
      userId: _readString(json['user_id']),
      role: _readString(json['role'], fallback: 'member'),
      isActive: _toBool(json['is_active']),
      fullName: fullName,
    );
  }
}

class CreateWorkspaceInput {
  final String name;
  final String? description;
  final String? businessType;

  const CreateWorkspaceInput({
    required this.name,
    this.description,
    this.businessType,
  });

  Map<String, dynamic> toJson() => {
    'name': name,
    if (description != null && description!.trim().isNotEmpty) 'description': description!.trim(),
    if (businessType != null && businessType!.trim().isNotEmpty) 'business_type': businessType!.trim(),
  };
}

class AddBranchInput {
  final String name;
  final String? address;
  final String? phone;
  final String? email;
  final double? latitude;
  final double? longitude;
  final double? serviceAreaRadiusKm;

  const AddBranchInput({
    required this.name,
    this.address,
    this.phone,
    this.email,
    this.latitude,
    this.longitude,
    this.serviceAreaRadiusKm,
  });

  Map<String, dynamic> toJson() => {
    'name': name,
    if (address != null && address!.trim().isNotEmpty) 'address': address!.trim(),
    if (phone != null && phone!.trim().isNotEmpty) 'phone': phone!.trim(),
    if (email != null && email!.trim().isNotEmpty) 'email': email!.trim(),
    if (latitude != null) 'latitude': latitude,
    if (longitude != null) 'longitude': longitude,
    if (serviceAreaRadiusKm != null) 'service_area_radius_km': serviceAreaRadiusKm,
  };
}

class AddRuleInput {
  final String name;
  final String? category;
  final int? priority;
  final double? maxDistanceKm;
  final int? maxLeadsPerMember;
  final bool? roundRobin;
  final int? slaMinutes;

  const AddRuleInput({
    required this.name,
    this.category,
    this.priority,
    this.maxDistanceKm,
    this.maxLeadsPerMember,
    this.roundRobin,
    this.slaMinutes,
  });

  Map<String, dynamic> toJson() => {
    'name': name,
    if (category != null && category!.trim().isNotEmpty) 'category': category!.trim(),
    if (priority != null) 'priority': priority,
    if (maxDistanceKm != null) 'max_distance_km': maxDistanceKm,
    if (maxLeadsPerMember != null) 'max_leads_per_member': maxLeadsPerMember,
    if (roundRobin != null) 'round_robin': roundRobin,
    if (slaMinutes != null) 'sla_minutes': slaMinutes,
  };
}

String _readString(Object? value, {String fallback = ''}) {
  final text = value is String ? value.trim() : '';
  return text.isEmpty ? fallback : text;
}

String? _readOptionalString(Object? value) {
  if (value is String && value.trim().isNotEmpty) {
    return value.trim();
  }
  return null;
}

int _toInt(Object? value, {int fallback = 0}) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value) ?? fallback;
  return fallback;
}

double _toDouble(Object? value, {double fallback = 0}) {
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value) ?? fallback;
  return fallback;
}

double? _toOptionalDouble(Object? value) {
  if (value is num) return value.toDouble();
  if (value is String) {
    final parsed = double.tryParse(value);
    return parsed;
  }
  return null;
}

bool _toBool(Object? value, {bool fallback = true}) {
  if (value is bool) return value;
  if (value is int) return value != 0;
  if (value is String) {
    final lower = value.trim().toLowerCase();
    if (lower == 'true') return true;
    if (lower == 'false') return false;
  }
  return fallback;
}

Map<String, dynamic> _readMap(Object? value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) {
    return value.map((k, v) => MapEntry(k.toString(), v));
  }
  return const <String, dynamic>{};
}

DateTime _parseDate(Object? value) {
  if (value is! String || value.trim().isEmpty) {
    return DateTime.now();
  }
  return DateTime.tryParse(value.trim())?.toLocal() ?? DateTime.now();
}

List<T> _parseList<T>(Object? value, T Function(dynamic) fromJson) {
  if (value is List) {
    return value.map(fromJson).toList();
  }
  return [];
}
