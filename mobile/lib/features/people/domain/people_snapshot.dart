class MobilePeopleSnapshot {
  const MobilePeopleSnapshot({
    required this.currentUserId,
    required this.people,
  });

  factory MobilePeopleSnapshot.fromJson(Map<String, dynamic> json) {
    final currentUserId = _readString(json['currentUserId']);
    final profileRows = ((json['profiles'] as List?) ?? const [])
        .whereType<Map>()
        .map((row) => Map<String, dynamic>.from(row))
        .toList();
    final serviceRows = ((json['services'] as List?) ?? const [])
        .whereType<Map>()
        .map((row) => Map<String, dynamic>.from(row))
        .toList();
    final productRows = ((json['products'] as List?) ?? const [])
        .whereType<Map>()
        .map((row) => Map<String, dynamic>.from(row))
        .toList();
    final postRows = ((json['posts'] as List?) ?? const [])
        .whereType<Map>()
        .map((row) => Map<String, dynamic>.from(row))
        .toList();
    final helpRequestRows = ((json['helpRequests'] as List?) ?? const [])
        .whereType<Map>()
        .map((row) => Map<String, dynamic>.from(row))
        .toList();
    final reviewRows = ((json['reviews'] as List?) ?? const [])
        .whereType<Map>()
        .map((row) => Map<String, dynamic>.from(row))
        .toList();
    final presenceRows = ((json['presence'] as List?) ?? const [])
        .whereType<Map>()
        .map((row) => Map<String, dynamic>.from(row))
        .toList();
    final orderStatsRows = ((json['orderStats'] as List?) ?? const [])
        .whereType<Map>()
        .map((row) => Map<String, dynamic>.from(row))
        .toList();

    final tagsByProvider = <String, Set<String>>{};
    final pricesByProvider = <String, List<double>>{};
    final postsByProvider = <String, int>{};
    final liveRequestsByProfile = <String, int>{};
    final reviewSumsByProvider = <String, double>{};
    final reviewCountsByProvider = <String, int>{};
    final presenceByProvider = <String, Map<String, dynamic>>{};
    final orderStatsByProvider = <String, Map<String, dynamic>>{};

    void addTag(String providerId, Object? value) {
      final normalized = _readString(value);
      if (providerId.isEmpty || normalized.isEmpty) {
        return;
      }

      tagsByProvider.putIfAbsent(providerId, () => <String>{}).add(normalized);
    }

    void addPrice(String providerId, Object? value) {
      final parsed = _toDouble(value);
      if (providerId.isEmpty || parsed <= 0) {
        return;
      }

      pricesByProvider.putIfAbsent(providerId, () => <double>[]).add(parsed);
    }

    for (final row in serviceRows) {
      final providerId = _readString(row['provider_id']);
      addTag(providerId, row['category']);
      addPrice(providerId, row['price']);
    }

    for (final row in productRows) {
      final providerId = _readString(row['provider_id']);
      addTag(providerId, row['category']);
      addPrice(providerId, row['price']);
    }

    for (final row in postRows) {
      final providerId = _firstNonEmpty([
        _readString(row['provider_id']),
        _readString(row['author_id']),
        _readString(row['created_by']),
        _readString(row['user_id']),
      ]);
      if (providerId.isEmpty) {
        continue;
      }

      addTag(providerId, row['category']);
      postsByProvider.update(providerId, (count) => count + 1, ifAbsent: () => 1);
    }

    for (final row in helpRequestRows) {
      final requesterId = _readString(row['requester_id']);
      if (requesterId.isEmpty) {
        continue;
      }

      addTag(requesterId, row['category']);
      if (_readString(row['status'], fallback: 'open').toLowerCase() !=
          'completed') {
        liveRequestsByProfile.update(
          requesterId,
          (count) => count + 1,
          ifAbsent: () => 1,
        );
      }
    }

    for (final row in reviewRows) {
      final providerId = _readString(row['provider_id']);
      final rating = _toDouble(row['rating']);
      if (providerId.isEmpty || rating <= 0) {
        continue;
      }

      reviewSumsByProvider.update(
        providerId,
        (sum) => sum + rating,
        ifAbsent: () => rating,
      );
      reviewCountsByProvider.update(
        providerId,
        (count) => count + 1,
        ifAbsent: () => 1,
      );
    }

    for (final row in presenceRows) {
      final providerId = _readString(row['provider_id']);
      if (providerId.isEmpty) {
        continue;
      }

      presenceByProvider[providerId] = row;
    }

    for (final row in orderStatsRows) {
      final providerId = _readString(row['provider_id']);
      if (providerId.isEmpty) {
        continue;
      }

      orderStatsByProvider[providerId] = row;
    }

    final people = profileRows
        .map((profile) {
          final id = _readString(profile['id']);
          if (id.isEmpty || id == currentUserId) {
            return null;
          }

          final completionPercent = _toInt(profile['profile_completion_percent']);
          final reviewCount = reviewCountsByProvider[id] ?? 0;
          final averageRating = reviewCount == 0
              ? null
              : (reviewSumsByProvider[id] ?? 0) / reviewCount;
          final presence = presenceByProvider[id] ?? const <String, dynamic>{};
          final orderStats = orderStatsByProvider[id] ?? const <String, dynamic>{};
          final prices = List<double>.from(pricesByProvider[id] ?? const <double>[])
            ..sort();
          final tags = (tagsByProvider[id] ?? const <String>{}).toList()..sort();
          final completedJobs = _toInt(orderStats['completed_jobs']);
          final openLeads = _toInt(orderStats['open_leads']);
          final isOnline = presence['is_online'] == true;
          final responseMinutes = _toInt(presence['rolling_response_minutes']);
          final verificationLevel = _humanize(_readString(profile['verification_level']));
          final locationLabel = _firstNonEmpty([
            _readString(profile['location']),
            'Nearby',
          ]);
          final headline = _firstNonEmpty([
            _readString(profile['bio']),
            _humanize(_readString(profile['role'])),
            'Serving nearby requests through ServiQ.',
          ]);

          return MobilePersonCard(
            id: id,
            name: _firstNonEmpty([
              _readString(profile['name']),
              _readString(profile['email']),
              'Local provider',
            ]),
            avatarUrl: _readString(profile['avatar_url']),
            headline: headline,
            locationLabel: locationLabel,
            isOnline: isOnline,
            activityLabel: isOnline
                ? 'Online now'
                : responseMinutes > 0
                ? 'Replies in about $responseMinutes min'
                : _firstNonEmpty([
                    _humanize(_readString(presence['availability'])),
                    'Recently active',
                  ]),
            verificationLabel: verificationLevel.isNotEmpty
                ? verificationLevel
                : completionPercent >= 90
                ? 'Profile complete'
                : 'Growing profile',
            completionPercent: completionPercent,
            primaryTags: tags.take(3).toList(),
            openNeedsCount: liveRequestsByProfile[id] ?? 0,
            postCount: postsByProvider[id] ?? 0,
            completedJobs: completedJobs,
            openLeads: openLeads,
            averageRating: averageRating,
            reviewCount: reviewCount,
            priceLabel: prices.isEmpty
                ? 'Pricing in chat'
                : 'From INR ${prices.first.round()}',
          );
        })
        .whereType<MobilePersonCard>()
        .toList()
      ..sort((left, right) {
        final leftScore = _sortScore(left);
        final rightScore = _sortScore(right);
        final scoreCompare = rightScore.compareTo(leftScore);
        if (scoreCompare != 0) {
          return scoreCompare;
        }
        return left.name.toLowerCase().compareTo(right.name.toLowerCase());
      });

    return MobilePeopleSnapshot(currentUserId: currentUserId, people: people);
  }

  final String currentUserId;
  final List<MobilePersonCard> people;

  int get totalCount => people.length;

  int get onlineCount => people.where((person) => person.isOnline).length;

  int get verifiedCount =>
      people.where((person) => person.completionPercent >= 80).length;
}

class MobilePersonCard {
  const MobilePersonCard({
    required this.id,
    required this.name,
    required this.avatarUrl,
    required this.headline,
    required this.locationLabel,
    required this.isOnline,
    required this.activityLabel,
    required this.verificationLabel,
    required this.completionPercent,
    required this.primaryTags,
    required this.openNeedsCount,
    required this.postCount,
    required this.completedJobs,
    required this.openLeads,
    required this.averageRating,
    required this.reviewCount,
    required this.priceLabel,
  final String currentUserId;
  final List<MobilePersonItem> people;
}

class MobilePersonItem {
  const MobilePersonItem({
    required this.id,
    required this.name,
    required this.roleLabel,
    required this.locationLabel,
    required this.availabilityLabel,
    required this.bio,
    required this.serviceCount,
    required this.productCount,
    required this.postCount,
    required this.completedJobs,
    required this.openLeads,
    required this.rating,
    required this.reviewCount,
    required this.online,
    required this.isCurrentUser,
  });

  final String id;
  final String name;
  final String avatarUrl;
  final String headline;
  final String locationLabel;
  final bool isOnline;
  final String activityLabel;
  final String verificationLabel;
  final int completionPercent;
  final List<String> primaryTags;
  final int openNeedsCount;
  final int postCount;
  final int completedJobs;
  final int openLeads;
  final double? averageRating;
  final int reviewCount;
  final String priceLabel;

  String get ratingLabel {
    final rating = averageRating;
    if (rating == null || reviewCount == 0) {
      return 'New to reviews';
    }

    return '${rating.toStringAsFixed(1)} stars';
  }

  String get workLabel {
    if (completedJobs > 0) {
      return '$completedJobs jobs completed';
    }
    if (openLeads > 0) {
      return '$openLeads live leads';
    }
    if (openNeedsCount > 0) {
      return '$openNeedsCount active needs';
    }
    return '$postCount recent posts';
  }

  bool matchesQuery(String query) {
    final normalized = query.trim().toLowerCase();
    if (normalized.isEmpty) {
      return true;
    }

    final haystack = [
      name,
      headline,
      locationLabel,
      verificationLabel,
      activityLabel,
      ...primaryTags,
    ].join(' ').toLowerCase();

    return haystack.contains(normalized);
  }
}

double _sortScore(MobilePersonCard person) {
  var score = 0.0;
  if (person.isOnline) {
    score += 1000;
  }
  score += person.completedJobs * 8;
  score += person.openLeads * 2;
  score += person.reviewCount * 3;
  score += (person.averageRating ?? 0) * 25;
  score += person.completionPercent.toDouble();
  return score;
}

String _readString(Object? value, {String fallback = ''}) {
  final text = value is String ? value.trim() : '';
  return text.isEmpty ? fallback : text;
}

String _firstNonEmpty(List<String> values) {
  for (final value in values) {
    if (value.trim().isNotEmpty) {
      return value.trim();
    }
  }
  return '';
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

String _humanize(String value) {
  final normalized = value.trim().toLowerCase();
  if (normalized.isEmpty) {
    return '';
  }

  return normalized
      .split('_')
      .map(
        (part) => part.isEmpty ? part : '${part[0].toUpperCase()}${part.substring(1)}',
      )
      .join(' ');
  final String roleLabel;
  final String locationLabel;
  final String availabilityLabel;
  final String bio;
  final int serviceCount;
  final int productCount;
  final int postCount;
  final int completedJobs;
  final int openLeads;
  final double rating;
  final int reviewCount;
  final bool online;
  final bool isCurrentUser;

  String get initials {
    final parts = name
        .split(RegExp(r'\s+'))
        .map((entry) => entry.trim())
        .where((entry) => entry.isNotEmpty)
        .take(2)
        .toList();
    if (parts.isEmpty) {
      return 'S';
    }
    return parts.map((entry) => entry[0].toUpperCase()).join();
  }

  String get ratingLabel =>
      reviewCount == 0 ? 'No reviews yet' : rating.toStringAsFixed(1);

  String get statsSummary {
    final entries = <String>[
      if (serviceCount > 0) '$serviceCount services',
      if (productCount > 0) '$productCount products',
      if (completedJobs > 0) '$completedJobs completed',
    ];
    if (entries.isEmpty) {
      return 'Building presence in ServiQ';
    }
    return entries.join(' • ');
  }
}
