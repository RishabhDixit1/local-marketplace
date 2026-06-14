import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

enum OfflineOperationType {
  sendMessage,
  createNeed,
  updateTask,
  submitReview,
  updateOrderStatus,
}

class OfflineOperation {
  final OfflineOperationType type;
  final Map<String, dynamic> payload;
  final DateTime createdAt;

  OfflineOperation({
    required this.type,
    required this.payload,
    DateTime? createdAt,
  }) : createdAt = createdAt ?? DateTime.now();

  Map<String, dynamic> toJson() => {
    'type': type.name,
    'payload': payload,
    'createdAt': createdAt.toIso8601String(),
  };

  factory OfflineOperation.fromJson(Map<String, dynamic> json) {
    return OfflineOperation(
      type: OfflineOperationType.values.firstWhere(
        (e) => e.name == json['type'],
        orElse: () => OfflineOperationType.sendMessage,
      ),
      payload: Map<String, dynamic>.from(json['payload'] as Map),
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}

class OfflineQueue {
  static const _key = 'serviq_offline_queue';

  final List<OfflineOperation> _operations = [];

  Future<void> enqueue(OfflineOperation operation) async {
    _operations.add(operation);
    await _persist();
  }

  Future<void> enqueueFront(OfflineOperation operation) async {
    _operations.insert(0, operation);
    await _persist();
  }

  List<OfflineOperation> dequeueAll() {
    final items = List<OfflineOperation>.from(_operations);
    _operations.clear();
    _persist();
    return items;
  }

  bool get hasPending => _operations.isNotEmpty;

  Future<void> _persist() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, jsonEncode(
      _operations.map((o) => o.toJson()).toList(),
    ));
  }

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key);
    if (raw == null) return;
    try {
      final list = jsonDecode(raw) as List<dynamic>;
      _operations.addAll(list
          .whereType<Map<String, dynamic>>()
          .map(OfflineOperation.fromJson));
    } catch (_) {}
  }
}
