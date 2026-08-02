import '../../../core/api/mobile_api_client.dart';
import '../../feed/domain/feed_snapshot.dart';
import '../../people/domain/people_snapshot.dart';

class ProviderProfileBundle {
  const ProviderProfileBundle({
    required this.provider,
    required this.items,
    required this.currentUserId,
    this.acceptedConnectionIds = const [],
    this.viewerRoleFamily = 'seeker',
    this.reviewRows = const [],
  });

  factory ProviderProfileBundle.fromJson(Map<String, dynamic> json) {
    final snapshot = MobilePeopleSnapshot.fromJson(json);
    final provider = snapshot.people.isNotEmpty ? snapshot.people.first : null;
    if (provider == null) {
      throw ApiException('Provider not found.');
    }

    final services = _asList(json['services']);
    final products = _asList(json['products']);
    final helpRequests = _asList(json['helpRequests']);
    final posts = _asList(json['posts']);
    final profile = _asMap(json['profiles']).isNotEmpty
        ? _asMap(json['profiles']).first
        : <String, dynamic>{};

    final items = <MobileFeedItem>[
      ...services.map((s) => _buildFeedItem(s, profile, 'service')),
      ...products.map((p) => _buildFeedItem(p, profile, 'product')),
      ...posts.map((p) => _buildFeedItem(p, profile, 'post')),
      ...helpRequests.map((h) => _buildFeedItem(h, profile, 'help_request')),
    ];

    return ProviderProfileBundle(
      provider: provider,
      items: items,
      currentUserId: snapshot.currentUserId,
      acceptedConnectionIds: snapshot.acceptedConnectionIds,
      viewerRoleFamily: snapshot.viewerRoleFamily,
      reviewRows: _asList(json['reviews']),
    );
  }

  final MobilePersonCard provider;
  final List<MobileFeedItem> items;
  final String currentUserId;
  final List<String> acceptedConnectionIds;
  final String viewerRoleFamily;
  final List<Map<String, dynamic>> reviewRows;

  bool get isEmpty => items.isEmpty;

  List<MobileFeedItem> get offers => items
      .where((item) => item.type != MobileFeedItemType.demand)
      .toList();

  List<MobileFeedItem> get requests => items
      .where((item) => item.type == MobileFeedItemType.demand)
      .toList();
}

MobileFeedItem _buildFeedItem(
  Map<String, dynamic> record,
  Map<String, dynamic> profile,
  String sourceType,
) {
  final isDemand = sourceType == 'help_request';
  final type = isDemand ? 'demand' : (sourceType == 'post' ? 'demand' : 'offer');
  final price = _toDouble(record['price']);

  return MobileFeedItem(
    id: _readString(record['id']),
    providerId: _readString(
      record['provider_id'],
      fallback: _readString(profile['id']),
    ),
    source: _parseSource(sourceType),
    type: _parseType(type),
    title: _readString(record['title'], fallback: _readString(record['name'])),
    description: _readString(
      record['description'],
      fallback: _readString(record['details']),
    ),
    category: _readString(
      record['category'],
      fallback: type == 'demand' ? 'Need' : 'Service',
    ),
    creatorName: _readString(
      profile['name'],
      fallback: type == 'demand' ? 'Nearby requester' : 'Local provider',
    ),
    avatarUrl: _readString(profile['avatar_url']),
    locationLabel: _readString(profile['location'], fallback: 'Nearby'),
    statusLabel: _humanizeStatus(
      _readString(
        record['status'],
        fallback: type == 'demand' ? 'open' : 'available',
      ),
    ),
    priceLabel: price > 0
        ? 'INR ${price.round()}'
        : (type == 'demand' ? 'Budget in chat' : 'Price in chat'),
    price: price,
    timeLabel: _formatTimeAgo(_readString(record['created_at'])),
    distanceLabel: _readString(profile['location'], fallback: 'Nearby'),
    publicProfilePath: '',
    verificationStatus: _readString(
      profile['verification_level'],
      fallback: 'pending',
    ),
    profileCompletion: _toInt(profile['profile_completion_percent']),
    responseMinutes: _toInt(profile['response_time_minutes']),
    averageRating: _nullableDouble(record['rating']),
    reviewCount: 0,
    completedJobs: 0,
    listingCount: 0,
    urgent: false,
    mediaCount: 0,
  );
}

MobileFeedSource _parseSource(String value) {
  switch (value) {
    case 'service':
      return MobileFeedSource.serviceListing;
    case 'product':
      return MobileFeedSource.productListing;
    case 'post':
      return MobileFeedSource.post;
    case 'help_request':
      return MobileFeedSource.helpRequest;
    default:
      return MobileFeedSource.post;
  }
}

MobileFeedItemType _parseType(String value) {
  switch (value.toLowerCase()) {
    case 'demand':
      return MobileFeedItemType.demand;
    case 'service':
    case 'offer':
      return MobileFeedItemType.service;
    case 'product':
      return MobileFeedItemType.product;
    default:
      return MobileFeedItemType.service;
  }
}

String _humanizeStatus(String status) {
  switch (status.toLowerCase()) {
    case 'open':
      return 'Open';
    case 'available':
      return 'Available';
    case 'matched':
      return 'Matched';
    case 'in_progress':
      return 'In progress';
    case 'fulfilled':
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    case 'closed':
      return 'Closed';
    default:
      return status;
  }
}

String _formatTimeAgo(String? iso) {
  if (iso == null || iso.isEmpty) return 'Recently';
  final date = DateTime.tryParse(iso);
  if (date == null) return 'Recently';
  final diff = DateTime.now().toUtc().difference(date.toUtc());
  if (diff.inMinutes < 1) return 'Just now';
  if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
  if (diff.inHours < 24) return '${diff.inHours}h ago';
  if (diff.inDays < 7) return '${diff.inDays}d ago';
  return date.toLocal().toString().substring(0, 10);
}

String _readString(Object? value, {String fallback = ''}) {
  final text = value is String ? value.trim() : '';
  return text.isEmpty ? fallback : text;
}

int _toInt(Object? value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value) ?? 0;
  return 0;
}

double _toDouble(Object? value) {
  if (value is double) return value;
  if (value is int) return value.toDouble();
  if (value is String) return double.tryParse(value) ?? 0;
  return 0;
}

double? _nullableDouble(Object? value) {
  if (value == null) return null;
  if (value is double) return value;
  if (value is int) return value.toDouble();
  if (value is String) {
    final parsed = double.tryParse(value);
    return parsed;
  }
  return null;
}

List<Map<String, dynamic>> _asList(Object? value) {
  if (value is List) {
    return value
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }
  return [];
}

List<Map<String, dynamic>> _asMap(Object? value) {
  if (value is List) {
    return value
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }
  return [];
}
