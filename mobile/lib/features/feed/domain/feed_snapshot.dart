enum MobileFeedScope {
  all,
  connected;

  String get queryValue =>
      this == MobileFeedScope.connected ? 'connected' : 'all';

  String get label => this == MobileFeedScope.connected ? 'Connected' : 'All';
}

enum MobileFeedItemType {
  demand,
  service,
  product;

  String get label {
    switch (this) {
      case MobileFeedItemType.demand:
        return 'Need';
      case MobileFeedItemType.service:
        return 'Service';
      case MobileFeedItemType.product:
        return 'Product';
    }
  }
}

enum MobileFeedSource {
  helpRequest,
  post,
  serviceListing,
  productListing;

  String get label {
    switch (this) {
      case MobileFeedSource.helpRequest:
        return 'Request';
      case MobileFeedSource.post:
        return 'Post';
      case MobileFeedSource.serviceListing:
        return 'Service';
      case MobileFeedSource.productListing:
        return 'Product';
    }
  }
}

class MobileFeedSnapshot {
  const MobileFeedSnapshot({
    required this.currentUserId,
    required this.stats,
    required this.items,
  });

  factory MobileFeedSnapshot.fromJson(Map<String, dynamic> json) {
    return MobileFeedSnapshot(
      currentUserId: (json['currentUserId'] as String?) ?? '',
      stats: MobileFeedStats.fromJson(
        Map<String, dynamic>.from(
          (json['feedStats'] as Map?) ?? const <String, dynamic>{},
        ),
      ),
      items: ((json['feedItems'] as List?) ?? const [])
          .whereType<Map>()
          .map(
            (item) => MobileFeedItem.fromJson(Map<String, dynamic>.from(item)),
          )
          .toList(),
    );
  }

  final String currentUserId;
  final MobileFeedStats stats;
  final List<MobileFeedItem> items;

  List<MobileFeedItem> get requests =>
      items.where((item) => item.type == MobileFeedItemType.demand).toList();

  List<MobileFeedItem> get providers =>
      items.where((item) => item.type != MobileFeedItemType.demand).toList();
}

class MobileFeedStats {
  const MobileFeedStats({
    required this.total,
    required this.urgent,
    required this.demand,
    required this.service,
    required this.product,
  });

  factory MobileFeedStats.fromJson(Map<String, dynamic> json) {
    return MobileFeedStats(
      total: _toInt(json['total']),
      urgent: _toInt(json['urgent']),
      demand: _toInt(json['demand']),
      service: _toInt(json['service']),
      product: _toInt(json['product']),
    );
  }

  final int total;
  final int urgent;
  final int demand;
  final int service;
  final int product;
}

class MobileFeedItem {
  const MobileFeedItem({
    required this.id,
    required this.providerId,
    required this.source,
    this.providerId = '',
    this.helpRequestId,
    required this.type,
    required this.title,
    required this.description,
    required this.category,
    required this.creatorName,
    required this.avatarUrl,
    required this.locationLabel,
    required this.statusLabel,
    required this.priceLabel,
    required this.timeLabel,
    required this.distanceLabel,
    required this.publicProfilePath,
    required this.verificationStatus,
    required this.profileCompletion,
    required this.responseMinutes,
    required this.averageRating,
    required this.reviewCount,
    required this.completedJobs,
    required this.listingCount,
    required this.urgent,
    required this.mediaCount,
    this.status = 'open',
    this.acceptedProviderId,
    this.viewerMatchStatus,
    this.viewerHasExpressedInterest = false,
  });

  factory MobileFeedItem.fromJson(Map<String, dynamic> json) {
    final type = _parseType(json['type'] as String?);
    final title = _readString(json['title'], fallback: _defaultTitle(type));
    final description = _readString(
      json['description'],
      fallback: 'Trusted local work from your ServiQ network.',
    );
    final creatorName = _readString(
      json['creatorName'] ?? json['creatorUsername'],
      fallback: type == MobileFeedItemType.demand
          ? 'Nearby requester'
          : 'Local provider',
    );
    final location = _readString(json['locationLabel'], fallback: 'Nearby');
    final status = _humanizeStatus(
      _readString(
        json['viewerMatchStatus'] ?? json['status'],
        fallback: 'open',
      ),
    );
    final mediaCount = ((json['media'] as List?) ?? const []).length;

    return MobileFeedItem(
      id: _readString(json['id']),
      providerId: _readString(
        json['providerId'],
        fallback: _readString(json['provider_id']),
      ),
      source: _parseSource(json['source'] as String?),
      providerId: _readString(json['providerId']),
      helpRequestId: _nullableString(json['helpRequestId']),
      type: type,
      title: title,
      description: description,
      category: _readString(json['category'], fallback: type.label),
      creatorName: creatorName,
      avatarUrl: _readString(json['avatarUrl'] ?? json['avatar_url']),
      locationLabel: location,
      statusLabel: status,
      priceLabel: _formatPrice(type: type, price: _toDouble(json['price'])),
      timeLabel: _formatTimeAgo(json['createdAt'] as String?),
      distanceLabel: _formatDistance(
        _toDouble(json['distanceKm']),
        fallback: location,
      ),
      publicProfilePath: _readString(json['publicProfilePath']),
      verificationStatus: _readString(
        json['verificationStatus'],
        fallback: 'pending',
      ),
      profileCompletion: _toInt(json['profileCompletion']),
      responseMinutes: _toInt(json['responseMinutes']),
      averageRating: _nullableDouble(json['averageRating']),
      reviewCount: _toInt(json['reviewCount']),
      completedJobs: _toInt(json['completedJobs']),
      listingCount: _toInt(json['listingCount']),
      urgent: json['urgent'] == true,
      mediaCount: mediaCount,
      status: _readString(json['status'], fallback: 'open'),
      acceptedProviderId: _nullableString(json['acceptedProviderId']),
      viewerMatchStatus: _nullableString(json['viewerMatchStatus']),
      viewerHasExpressedInterest: json['viewerHasExpressedInterest'] == true,
    );
  }

  final String id;
  final String providerId;
  final MobileFeedSource source;
  final String? helpRequestId;
  final MobileFeedItemType type;
  final String title;
  final String description;
  final String category;
  final String creatorName;
  final String avatarUrl;
  final String locationLabel;
  final String statusLabel;
  final String priceLabel;
  final String timeLabel;
  final String distanceLabel;
  final String publicProfilePath;
  final String verificationStatus;
  final int profileCompletion;
  final int responseMinutes;
  final double? averageRating;
  final int reviewCount;
  final int completedJobs;
  final int listingCount;
  final bool urgent;
  final int mediaCount;
  final String status;
  final String? acceptedProviderId;
  final String? viewerMatchStatus;
  final bool viewerHasExpressedInterest;

  bool get hasMedia => mediaCount > 0;
  bool get isVerified => verificationStatus == 'verified';

  String get trustLabel {
    if (isVerified) {
      return 'Verified';
    }
    if (profileCompletion >= 85) {
      return 'Profile complete';
    }
    return 'Growing trust';
  }

  String get responseLabel {
    if (responseMinutes > 0) {
      return 'Replies in $responseMinutes min';
    }
    return 'Response time building';
  }

  String get ratingLabel {
    final rating = averageRating;
    if (rating == null || reviewCount == 0) {
      return 'New to reviews';
    }

      return '${rating.toStringAsFixed(1)} ($reviewCount)';
  }
  bool get isDemand => type == MobileFeedItemType.demand;
  bool get isOpen => _normalizeStatus(status) == 'open';
  bool get isAccepted => _normalizeStatus(status) == 'accepted';
  bool get isClosed => const {
    'completed',
    'cancelled',
    'canceled',
    'closed',
    'archived',
  }.contains(_normalizeStatus(status));
}

int _toInt(Object? value) {
  if (value is int) {
    return value;
  }
  if (value is num) {
    return value.toInt();
  }
  if (value is String) {
    return int.tryParse(value) ?? 0;
  }
  return 0;
}

double _toDouble(Object? value) {
  if (value is double) {
    return value;
  }
  if (value is int) {
    return value.toDouble();
  }
  if (value is num) {
    return value.toDouble();
  }
  if (value is String) {
    return double.tryParse(value) ?? 0;
  }
  return 0;
}

double? _nullableDouble(Object? value) {
  final parsed = _toDouble(value);
  if (parsed <= 0) {
    return null;
  }
  return parsed;
}

String _readString(Object? value, {String fallback = ''}) {
  final text = value is String ? value.trim() : '';
  return text.isEmpty ? fallback : text;
}

String? _nullableString(Object? value) {
  final text = _readString(value);
  return text.isEmpty ? null : text;
}

MobileFeedItemType _parseType(String? value) {
  switch ((value ?? '').trim().toLowerCase()) {
    case 'service':
      return MobileFeedItemType.service;
    case 'product':
      return MobileFeedItemType.product;
    default:
      return MobileFeedItemType.demand;
  }
}

MobileFeedSource _parseSource(String? value) {
  switch ((value ?? '').trim().toLowerCase()) {
    case 'service_listing':
      return MobileFeedSource.serviceListing;
    case 'product_listing':
      return MobileFeedSource.productListing;
    case 'post':
      return MobileFeedSource.post;
    default:
      return MobileFeedSource.helpRequest;
  }
}

String _defaultTitle(MobileFeedItemType type) {
  switch (type) {
    case MobileFeedItemType.demand:
      return 'Need local support';
    case MobileFeedItemType.service:
      return 'Local service';
    case MobileFeedItemType.product:
      return 'Local product';
  }
}

String _formatPrice({required MobileFeedItemType type, required double price}) {
  if (price > 0) {
    return 'INR ${price.round()}';
  }
  if (type == MobileFeedItemType.demand) {
    return 'Budget shared in chat';
  }
  return 'Price on request';
}

String _formatTimeAgo(String? createdAt) {
  if (createdAt == null || createdAt.trim().isEmpty) {
    return 'Recently posted';
  }

  final parsed = DateTime.tryParse(createdAt);
  if (parsed == null) {
    return 'Recently posted';
  }

  final diff = DateTime.now().difference(parsed);
  if (diff.inMinutes < 1) {
    return 'Just now';
  }
  if (diff.inHours < 1) {
    return '${diff.inMinutes}m ago';
  }
  if (diff.inDays < 1) {
    return '${diff.inHours}h ago';
  }
  return '${diff.inDays}d ago';
}

String _formatDistance(double distanceKm, {required String fallback}) {
  if (distanceKm > 0) {
    return '${distanceKm.toStringAsFixed(1)} km away';
  }
  return fallback;
}

String _humanizeStatus(String raw) {
  final normalized = raw.trim().toLowerCase();
  if (normalized.isEmpty) {
    return 'Open';
  }

  return normalized
      .split('_')
      .map(
        (segment) => segment.isEmpty
            ? segment
            : '${segment[0].toUpperCase()}${segment.substring(1)}',
      )
      .join(' ');
}

String _normalizeStatus(String raw) {
  return raw.trim().toLowerCase().replaceAll('-', '_');
}
