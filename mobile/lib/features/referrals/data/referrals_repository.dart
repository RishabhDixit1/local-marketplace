import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/api/mobile_api_provider.dart';
import '../domain/referral_models.dart';

final referralsRepositoryProvider = Provider<ReferralsRepository>((ref) {
  return ReferralsRepository(ref.watch(mobileApiClientProvider));
});

final referralBundleProvider = FutureProvider<ReferralBundle>((ref) {
  return ref.watch(referralsRepositoryProvider).fetchBundle();
});

class ReferralsRepository {
  const ReferralsRepository(this._apiClient);

  final MobileApiClient _apiClient;

  Future<ReferralBundle> fetchBundle() async {
    final [refPayload, payoutPayload] = await Future.wait([
      _apiClient.getJson('/api/referrals'),
      _apiClient.getJson('/api/referrals/payout'),
    ]);

    _expectOk(refPayload, 'Unable to load referrals.');
    _expectOk(payoutPayload, 'Unable to load payout data.');

    return ReferralBundle.fromJson(refPayload, payoutPayload);
  }

  Future<ReferralCode> createCode() async {
    final payload = await _apiClient.postJson('/api/referrals');
    _expectOk(payload, 'Unable to generate code.');

    return ReferralCode.fromJson(
      Map<String, dynamic>.from(
        (payload['code'] as Map?) ?? <String, dynamic>{},
      ),
    );
  }

  Future<String> requestPayout(int points) async {
    final payload = await _apiClient.postJson(
      '/api/referrals/payout',
      body: {'points': points},
    );
    _expectOk(payload, 'Unable to request payout.');

    return (payload['message'] as String?) ?? 'Payout requested.';
  }

  void shareCode(String code) {
    final url = 'https://www.serviqapp.com/referral?code=$code';
    SharePlus.instance.share(ShareParams(text: 'Join ServiQ using my referral code: $code\n\n$url'));
  }

  void _expectOk(Map<String, dynamic> payload, String fallbackMessage) {
    if (payload['ok'] == true) return;
    throw ApiException(
      (payload['message'] as String?) ?? fallbackMessage,
      statusCode: payload['statusCode'] as int?,
    );
  }
}
