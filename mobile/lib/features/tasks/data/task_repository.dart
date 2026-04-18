import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/supabase/app_bootstrap.dart';
import '../domain/task_snapshot.dart';

final taskRepositoryProvider = Provider<TaskRepository>((ref) {
  final bootstrap = ref.watch(appBootstrapProvider);
  return TaskRepository(
    apiClient: ref.watch(mobileApiClientProvider),
    supabaseClient: bootstrap.client,
  );
});

final taskSnapshotProvider = FutureProvider<MobileTaskSnapshot>((ref) {
  return ref.watch(taskRepositoryProvider).fetchTasks();
});

class TaskRepository {
  const TaskRepository({
    required MobileApiClient apiClient,
    required SupabaseClient? supabaseClient,
  }) : _apiClient = apiClient,
       _supabaseClient = supabaseClient;

  final MobileApiClient _apiClient;
  final SupabaseClient? _supabaseClient;

  Future<MobileTaskSnapshot> fetchTasks() async {
    final client = _supabaseClient;
    final userId = client?.auth.currentUser?.id ?? '';
    if (client == null || userId.isEmpty) {
      throw const ApiException(
        'Sign in is required before loading the mobile task board.',
        statusCode: 401,
      );
    }

    final futures = await Future.wait<Object?>([
      client
          .from('orders')
          .select(
            'id,help_request_id,status,price,listing_type,consumer_id,provider_id,metadata,created_at',
          )
          .or('consumer_id.eq.$userId,provider_id.eq.$userId')
          .order('created_at', ascending: false)
          .limit(120),
      _apiClient.getJson('/api/tasks/help-requests'),
    ]);

    final orderRows = (futures[0] as List?) ?? const [];
    final helpPayload = futures[1] as Map<String, dynamic>;
    if (helpPayload['ok'] != true) {
      throw ApiException(
        (helpPayload['message'] as String?) ??
            'Unable to load the help request activity.',
      );
    }

    final orderHelpRequestIds = orderRows
        .whereType<Map>()
        .map((row) => _readString(row['help_request_id']))
        .where((id) => id.isNotEmpty)
        .toSet();

    final tasks =
        <MobileTaskItem>[
          ...orderRows.whereType<Map>().map(
            (row) => _mapOrderToTask(
              Map<String, dynamic>.from(row),
              currentUserId: userId,
            ),
          ),
          ...((helpPayload['requests'] as List?) ?? const [])
              .whereType<Map>()
              .map((row) => Map<String, dynamic>.from(row))
              .where(
                (row) => !orderHelpRequestIds.contains(_readString(row['id'])),
              )
              .map((row) => _mapHelpRequestToTask(row, currentUserId: userId)),
        ]..sort((left, right) {
          final leftTime = left.createdAt?.millisecondsSinceEpoch ?? 0;
          final rightTime = right.createdAt?.millisecondsSinceEpoch ?? 0;
          return rightTime.compareTo(leftTime);
        });

    return MobileTaskSnapshot(currentUserId: userId, items: tasks);
  }

  Future<void> performPrimaryAction(MobileTaskItem task) async {
    final action = task.primaryAction;
    if (action == null) {
      return;
    }

    switch (action.kind) {
      case MobileTaskPrimaryActionKind.acceptOrder:
        await _expectOk(
          _apiClient.patchJson(
            '/api/orders/${task.id}',
            body: const {'status': 'accepted'},
          ),
          fallbackMessage: 'Unable to accept this order right now.',
        );
        return;
      case MobileTaskPrimaryActionKind.confirmAccepted:
        await _updateProgressStage(task, stage: 'accepted');
        return;
      case MobileTaskPrimaryActionKind.startTravel:
        await _updateProgressStage(task, stage: 'travel_started');
        return;
      case MobileTaskPrimaryActionKind.startWork:
        await _updateProgressStage(task, stage: 'work_started');
        return;
      case MobileTaskPrimaryActionKind.completeTask:
        if (task.source == MobileTaskSource.order) {
          await _expectOk(
            _apiClient.patchJson(
              '/api/orders/${task.id}',
              body: const {'status': 'completed'},
            ),
            fallbackMessage: 'Unable to complete this order right now.',
          );
        } else {
          await _expectOk(
            _apiClient.postJson(
              '/api/needs/status',
              body: {'helpRequestId': task.id, 'status': 'completed'},
            ),
            fallbackMessage: 'Unable to complete this request right now.',
          );
        }
        return;
    }
  }

  Future<void> _updateProgressStage(
    MobileTaskItem task, {
    required String stage,
  }) async {
    await _expectOk(
      _apiClient.postJson(
        '/api/tasks/progress',
        body: {
          'taskId': task.id,
          'source': task.source == MobileTaskSource.order
              ? 'order'
              : 'help_request',
          'stage': stage,
        },
      ),
      fallbackMessage: 'Unable to update the live task tracker right now.',
    );
  }

  Future<void> _expectOk(
    Future<Map<String, dynamic>> request, {
    required String fallbackMessage,
  }) async {
    final payload = await request;
    if (payload['ok'] == true) {
      return;
    }

    throw ApiException(
      (payload['message'] as String?) ?? fallbackMessage,
      statusCode: payload['statusCode'] as int?,
    );
  }
}

MobileTaskItem _mapOrderToTask(
  Map<String, dynamic> row, {
  required String currentUserId,
}) {
  final metadata = _readObject(row['metadata']);
  final listingType = _normalizeListingType(_readString(row['listing_type']));
  final rawStatus = _readString(row['status'], fallback: 'new_lead');
  final role = _readString(row['consumer_id']) == currentUserId
      ? MobileTaskRole.posted
      : MobileTaskRole.accepted;

  final title = _firstNonEmpty([
    _readString(metadata['task_title']),
    _readString(metadata['title']),
    _defaultOrderTitle(listingType),
  ]);
  final description = _firstNonEmpty([
    _readString(metadata['task_description']),
    _readString(metadata['notes']),
    _readString(metadata['address']),
    'Track the next step for this ${listingType.toLowerCase()} on mobile.',
  ]);
  final locationLabel = _firstNonEmpty([
    _readString(metadata['location_label']),
    _readString(metadata['address']),
    'Nearby',
  ]);

  return MobileTaskItem(
    id: _readString(row['id']),
    source: MobileTaskSource.order,
    role: role,
    status: _normalizeTaskStatus(rawStatus),
    rawStatus: rawStatus,
    progressStage: _normalizeProgressStage(
      metadata['progress_stage'],
      fallbackStatus: rawStatus,
    ),
    title: title,
    description: description,
    budgetLabel: _formatCurrency(_readNum(row['price'])),
    locationLabel: locationLabel,
    listingTypeLabel: listingType,
    createdAt: _parseDate(row['created_at']),
  );
}

MobileTaskItem _mapHelpRequestToTask(
  Map<String, dynamic> row, {
  required String currentUserId,
}) {
  final metadata = _readObject(row['metadata']);
  final rawStatus = _readString(row['status'], fallback: 'open');
  final role = _readString(row['requester_id']) == currentUserId
      ? MobileTaskRole.posted
      : MobileTaskRole.accepted;

  return MobileTaskItem(
    id: _readString(row['id']),
    source: MobileTaskSource.helpRequest,
    role: role,
    status: _normalizeTaskStatus(rawStatus),
    rawStatus: rawStatus,
    progressStage: _normalizeProgressStage(
      metadata['progress_stage'],
      fallbackStatus: rawStatus,
    ),
    title: _firstNonEmpty([
      _readString(row['title']),
      _readString(row['category']),
      'Service request',
    ]),
    description: _firstNonEmpty([
      _readString(row['details']),
      'Live request posted on ServiQ.',
    ]),
    budgetLabel: _formatBudgetRange(
      min: _readNum(row['budget_min']),
      max: _readNum(row['budget_max']),
    ),
    locationLabel: _firstNonEmpty([
      _readString(row['location_label']),
      'Nearby',
    ]),
    listingTypeLabel: _firstNonEmpty([_readString(row['category']), 'Demand']),
    createdAt: _parseDate(row['created_at']),
  );
}

Map<String, dynamic> _readObject(Object? value) {
  if (value is Map<String, dynamic>) {
    return value;
  }
  if (value is Map) {
    return value.map((key, data) => MapEntry(key.toString(), data));
  }
  return const <String, dynamic>{};
}

String _readString(Object? value, {String fallback = ''}) {
  final text = value is String ? value.trim() : '';
  return text.isEmpty ? fallback : text;
}

double? _readNum(Object? value) {
  if (value is int) {
    return value.toDouble();
  }
  if (value is double) {
    return value;
  }
  if (value is num) {
    return value.toDouble();
  }
  if (value is String) {
    return double.tryParse(value.trim());
  }
  return null;
}

DateTime? _parseDate(Object? value) {
  if (value is! String || value.trim().isEmpty) {
    return null;
  }
  return DateTime.tryParse(value.trim());
}

String _firstNonEmpty(List<String> candidates) {
  for (final candidate in candidates) {
    if (candidate.trim().isNotEmpty) {
      return candidate.trim();
    }
  }
  return '';
}

String _defaultOrderTitle(String listingType) {
  switch (listingType) {
    case 'Service':
      return 'Service booking';
    case 'Product':
      return 'Product order';
    case 'Demand':
      return 'Demand response';
    default:
      return 'Marketplace task';
  }
}

String _normalizeListingType(String rawType) {
  final normalized = rawType.trim().toLowerCase();
  if (normalized == 'service' || normalized == 'services') {
    return 'Service';
  }
  if (normalized == 'product' || normalized == 'products') {
    return 'Product';
  }
  if (normalized == 'demand' ||
      normalized == 'need' ||
      normalized == 'needs' ||
      normalized == 'request') {
    return 'Demand';
  }
  return 'Order';
}

MobileTaskStatus _normalizeTaskStatus(String rawStatus) {
  final normalized = rawStatus.trim().toLowerCase();
  if (normalized == 'accepted' || normalized == 'in_progress') {
    return MobileTaskStatus.inProgress;
  }
  if (normalized == 'completed' || normalized == 'closed') {
    return MobileTaskStatus.completed;
  }
  if (normalized == 'cancelled' ||
      normalized == 'canceled' ||
      normalized == 'rejected') {
    return MobileTaskStatus.cancelled;
  }
  return MobileTaskStatus.active;
}

MobileTaskProgressStage _normalizeProgressStage(
  Object? rawStage, {
  required String fallbackStatus,
}) {
  final normalizedStage = _readString(rawStage).toLowerCase();
  switch (normalizedStage) {
    case 'accepted':
      return MobileTaskProgressStage.accepted;
    case 'travel_started':
      return MobileTaskProgressStage.travelStarted;
    case 'work_started':
      return MobileTaskProgressStage.workStarted;
    case 'completed':
      return MobileTaskProgressStage.completed;
    case 'pending_acceptance':
      return MobileTaskProgressStage.pendingAcceptance;
  }

  final normalizedStatus = fallbackStatus.trim().toLowerCase();
  if (normalizedStatus == 'completed' || normalizedStatus == 'closed') {
    return MobileTaskProgressStage.completed;
  }
  if (normalizedStatus == 'in_progress') {
    return MobileTaskProgressStage.workStarted;
  }
  if (normalizedStatus == 'accepted') {
    return MobileTaskProgressStage.pendingAcceptance;
  }
  return MobileTaskProgressStage.pendingAcceptance;
}

String _formatCurrency(double? value) {
  if (value == null || value <= 0) {
    return 'Price on request';
  }
  return 'INR ${value.round()}';
}

String _formatBudgetRange({required double? min, required double? max}) {
  final high = max != null && max > 0 ? max : null;
  final low = min != null && min > 0 ? min : null;
  final chosen = high ?? low;
  if (chosen == null) {
    return 'Price on request';
  }
  return 'INR ${chosen.round()}';
}
