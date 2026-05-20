import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/mobile_api_client.dart';
import '../../../core/api/mobile_api_provider.dart';
import '../domain/report_models.dart';

final reportRepositoryProvider = Provider<ReportRepository>((ref) {
  return ReportRepository(apiClient: ref.watch(mobileApiClientProvider));
});

class ReportRepository {
  const ReportRepository({required MobileApiClient apiClient}) : _apiClient = apiClient;
  final MobileApiClient _apiClient;

  Future<void> submitReport(ReportSubmission submission) async {
    await _apiClient.postJson('/api/reports', body: submission.toJson());
  }
}
