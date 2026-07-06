import 'package:supabase_flutter/supabase_flutter.dart';

const _defaultBatchSize = 30;

/// Batches an [inFilter] query into chunks to avoid overflowing
/// Kong/nginx URI length limits (default 8 KiB per header line).
///
/// Splits [values] into chunks of [batchSize], runs parallel
/// [select] queries for each chunk, and merges the results.
extension BatchedPostgrestQuery on PostgrestQueryBuilder {
  Future<List<Map<String, dynamic>>> batchedSelect({
    required String columns,
    required String filterColumn,
    required List<String> values,
    int batchSize = _defaultBatchSize,
  }) async {
    if (values.length <= batchSize) {
      final result = await select(columns).inFilter(filterColumn, values);
      return _flatten(result);
    }

    final results = await Future.wait(
      chunks(values, batchSize).map(
        (batch) => select(columns).inFilter(filterColumn, batch),
      ),
    );
    return results.expand((r) => _flatten(r)).toList();
  }
}

List<Map<String, dynamic>> _flatten(Object? value) {
  final list = value as List? ?? const [];
  return list
      .whereType<Map>()
      .map((row) => Map<String, dynamic>.from(row))
      .toList();
}

List<List<T>> chunks<T>(List<T> items, int size) {
  final result = <List<T>>[];
  for (var i = 0; i < items.length; i += size) {
    result.add(items.sublist(i, i + size > items.length ? items.length : i + size));
  }
  return result;
}
