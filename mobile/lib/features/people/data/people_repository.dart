import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/mobile_api_client.dart';
import '../domain/people_snapshot.dart';

final peopleRepositoryProvider = Provider<PeopleRepository>((ref) {
  final bootstrap = ref.watch(appBootstrapProvider);
  final apiClient = MobileApiClient(
    config: bootstrap.config,
    supabaseClient: bootstrap.client,
  );
  ref.onDispose(apiClient.dispose);

  return PeopleRepository(apiClient);
import '../../../core/api/mobile_api_provider.dart';
import '../domain/people_snapshot.dart';

final peopleRepositoryProvider = Provider<PeopleRepository>((ref) {
  return PeopleRepository(ref.watch(mobileApiClientProvider));
});

final peopleSnapshotProvider = FutureProvider<MobilePeopleSnapshot>((ref) {
  return ref.watch(peopleRepositoryProvider).fetchPeople();
});

class PeopleRepository {
  const PeopleRepository(this._apiClient);

  final MobileApiClient _apiClient;

  Future<MobilePeopleSnapshot> fetchPeople() async {
    final payload = await _apiClient.getJson('/api/community/people');
    if (payload['ok'] != true) {
      throw ApiException(
        (payload['message'] as String?) ??
            'Unable to load the people directory right now.',
      );
    }

    return MobilePeopleSnapshot.fromJson(payload);
  }
        (payload['message'] as String?) ?? 'Unable to load nearby people.',
      );
    }

    final currentUserId = _readString(payload['currentUserId']);
    final profiles = ((payload['profiles'] as List?) ?? const [])
        .whereType<Map>()
        .map((row) => Map<String, dynamic>.from(row))
        .toList();
    final services = ((payload['services'] as List?) ?? const [])
        .whereType<Map>()
        .map((row) => Map<String, dynamic>.from(row))
        .toList();
    final products = ((payload['products'] as List?) ?? const [])
        .whereType<Map>()
        .map((row) => Map<String, dynamic>.from(row))
        .toList();
    final posts = ((payload['posts'] as List?) ?? const [])
        .whereType<Map>()
        .map((row) => Map<String, dynamic>.from(row))
        .toList();
    final reviews = ((payload['reviews'] as List?) ?? const [])
        .whereType<Map>()
        .map((row) => Map<String, dynamic>.from(row))
        .toList();
    final presence = ((payload['presence'] as List?) ?? const [])
        .whereType<Map>()
        .map((row) => Map<String, dynamic>.from(row))
        .toList();
    final orderStats = ((payload['orderStats'] as List?) ?? const [])
        .whereType<Map>()
        .map((row) => Map<String, dynamic>.from(row))
        .toList();

    final serviceCountByProvider = <String, int>{};
    for (final row in services) {
      final providerId = _readString(row['provider_id']);
      if (providerId.isEmpty) {
        continue;
      }
      serviceCountByProvider.update(providerId, (value) => value + 1,
          ifAbsent: () => 1);
    }

    final productCountByProvider = <String, int>{};
    for (final row in products) {
      final providerId = _readString(row['provider_id']);
      if (providerId.isEmpty) {
        continue;
      }
      productCountByProvider.update(providerId, (value) => value + 1,
          ifAbsent: () => 1);
    }

    final postCountByProvider = <String, int>{};
    for (final row in posts) {
      final providerId = _firstNonEmpty([
        _readString(row['provider_id']),
        _readString(row['user_id']),
        _readString(row['author_id']),
        _readString(row['created_by']),
      ]);
      if (providerId.isEmpty) {
        continue;
      }
      postCountByProvider.update(providerId, (value) => value + 1,
          ifAbsent: () => 1);
    }

    final reviewSummaryByProvider = <String, ({double total, int count})>{};
    for (final row in reviews) {
      final providerId = _readString(row['provider_id']);
      final rating = _toDouble(row['rating']);
      if (providerId.isEmpty || rating <= 0) {
        continue;
      }
      final current =
          reviewSummaryByProvider[providerId] ?? (total: 0.0, count: 0);
      reviewSummaryByProvider[providerId] = (
        total: current.total + rating,
        count: current.count + 1,
      );
    }

    final presenceByProvider = <String, Map<String, dynamic>>{};
    for (final row in presence) {
      final providerId = _readString(row['provider_id']);
      if (providerId.isNotEmpty) {
        presenceByProvider[providerId] = row;
      }
    }

    final orderStatsByProvider = <String, Map<String, dynamic>>{};
    for (final row in orderStats) {
      final providerId = _readString(row['provider_id']);
      if (providerId.isNotEmpty) {
        orderStatsByProvider[providerId] = row;
      }
    }

    final people = profiles.map((profile) {
      final id = _readString(profile['id']);
      final reviewSummary =
          reviewSummaryByProvider[id] ?? (total: 0.0, count: 0);
      final rating = reviewSummary.count == 0
          ? 0.0
          : reviewSummary.total / reviewSummary.count;
      final presenceRow = presenceByProvider[id];
      final orderRow = orderStatsByProvider[id];

      return MobilePersonItem(
        id: id,
        name: _readString(profile['name'], fallback: 'ServiQ member'),
        roleLabel: _humanize(
          _readString(profile['role'], fallback: 'community member'),
        ),
        locationLabel: _readString(profile['location'], fallback: 'Nearby'),
        availabilityLabel: _humanize(
          _readString(
            presenceRow?['availability'] ?? profile['availability'],
            fallback: 'available',
          ),
        ),
        bio: _readString(
          profile['bio'],
          fallback: 'Local services and requests are visible here as this profile becomes active.',
        ),
        serviceCount: serviceCountByProvider[id] ?? 0,
        productCount: productCountByProvider[id] ?? 0,
        postCount: postCountByProvider[id] ?? 0,
        completedJobs: _toInt(orderRow?['completed_jobs']),
        openLeads: _toInt(orderRow?['open_leads']),
        rating: rating,
        reviewCount: reviewSummary.count,
        online: presenceRow?['is_online'] == true,
        isCurrentUser: id == currentUserId,
      );
    }).toList()
      ..sort((left, right) {
        final leftScore =
            (left.online ? 1000 : 0) +
            (left.completedJobs * 10) +
            left.serviceCount +
            left.productCount;
        final rightScore =
            (right.online ? 1000 : 0) +
            (right.completedJobs * 10) +
            right.serviceCount +
            right.productCount;
        return rightScore.compareTo(leftScore);
      });

    return MobilePeopleSnapshot(currentUserId: currentUserId, people: people);
  }
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
  final normalized = value.trim().replaceAll('_', ' ');
  if (normalized.isEmpty) {
    return '';
  }
  return normalized
      .split(RegExp(r'\s+'))
      .map((part) {
        if (part.isEmpty) {
          return part;
        }
        return '${part[0].toUpperCase()}${part.substring(1).toLowerCase()}';
      })
      .join(' ');
}
