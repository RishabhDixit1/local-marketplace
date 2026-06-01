import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/api/mobile_api_provider.dart';
import '../domain/workspace_models.dart';

final workspacesRepositoryProvider = Provider<WorkspacesRepository>((ref) {
  return WorkspacesRepository(apiClient: ref.watch(mobileApiClientProvider));
});

final workspaceListProvider = FutureProvider<List<MobileWorkspace>>((ref) {
  return ref.watch(workspacesRepositoryProvider).fetchWorkspaces();
});

final workspaceDetailProvider = FutureProvider.family<MobileWorkspace, String>((ref, id) {
  return ref.watch(workspacesRepositoryProvider).fetchWorkspace(id);
});

final workspaceMembersProvider = FutureProvider.family<List<MobileWorkspaceMember>, String>((ref, id) {
  return ref.watch(workspacesRepositoryProvider).fetchMembers(id);
});

final workspaceBranchesProvider = FutureProvider.family<List<MobileWorkspaceBranch>, String>((ref, id) {
  return ref.watch(workspacesRepositoryProvider).fetchBranches(id);
});

final workspaceRulesProvider = FutureProvider.family<List<MobileWorkspaceRule>, String>((ref, id) {
  return ref.watch(workspacesRepositoryProvider).fetchRules(id);
});

final workspaceAnalyticsProvider = FutureProvider.family<MobileWorkspaceAnalytics, String>((ref, id) {
  return ref.watch(workspacesRepositoryProvider).fetchAnalytics(id);
});

class WorkspacesRepository {
  const WorkspacesRepository({required MobileApiClient apiClient}) : _apiClient = apiClient;

  final MobileApiClient _apiClient;

  Future<List<MobileWorkspace>> fetchWorkspaces() async {
    final payload = await _apiClient.getJson('/api/workspaces');
    _expectOk(payload, 'Unable to load workspaces.');
    final list = (payload['workspaces'] as List?) ?? [];
    return list
        .whereType<Map>()
        .map((e) => MobileWorkspace.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<MobileWorkspace> createWorkspace(CreateWorkspaceInput input) async {
    final payload = await _apiClient.postJson(
      '/api/workspaces',
      body: input.toJson(),
    );
    _expectOk(payload, 'Unable to create workspace.');
    final ws = (payload['workspace'] as Map?) ?? <String, dynamic>{};
    return MobileWorkspace.fromJson(Map<String, dynamic>.from(ws));
  }

  Future<MobileWorkspace> fetchWorkspace(String workspaceId) async {
    final payload = await _apiClient.getJson('/api/workspaces/$workspaceId');
    _expectOk(payload, 'Unable to load workspace.');
    final ws = (payload['workspace'] as Map?) ?? <String, dynamic>{};
    return MobileWorkspace.fromJson(Map<String, dynamic>.from(ws));
  }

  Future<void> updateWorkspace(
    String workspaceId, {
    String? name,
    String? description,
    String? phone,
    String? email,
    String? website,
  }) async {
    final body = <String, dynamic>{};
    if (name != null) body['name'] = name;
    if (description != null) body['description'] = description;
    if (phone != null) body['phone'] = phone;
    if (email != null) body['email'] = email;
    if (website != null) body['website'] = website;

    final payload = await _apiClient.patchJson(
      '/api/workspaces/$workspaceId',
      body: body.isNotEmpty ? body : null,
    );
    _expectOk(payload, 'Unable to update workspace.');
  }

  Future<void> deleteWorkspace(String workspaceId) async {
    final payload = await _apiClient.deleteJson('/api/workspaces/$workspaceId');
    _expectOk(payload, 'Unable to delete workspace.');
  }

  Future<List<MobileWorkspaceMember>> fetchMembers(String workspaceId) async {
    final payload = await _apiClient.getJson('/api/workspaces/$workspaceId/members');
    _expectOk(payload, 'Unable to load members.');
    final list = (payload['members'] as List?) ?? [];
    return list
        .whereType<Map>()
        .map((e) => MobileWorkspaceMember.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<void> addMember(String workspaceId, String userId, {String role = 'member'}) async {
    final payload = await _apiClient.postJson(
      '/api/workspaces/$workspaceId/members',
      body: {'userId': userId, 'role': role},
    );
    _expectOk(payload, 'Unable to add member.');
  }

  Future<void> removeMember(String workspaceId, String memberId) async {
    final payload = await _apiClient.deleteJson(
      '/api/workspaces/$workspaceId/members?memberId=$memberId',
    );
    _expectOk(payload, 'Unable to remove member.');
  }

  Future<List<MobileWorkspaceBranch>> fetchBranches(String workspaceId) async {
    final payload = await _apiClient.getJson('/api/workspaces/$workspaceId/branches');
    _expectOk(payload, 'Unable to load branches.');
    final list = (payload['branches'] as List?) ?? [];
    return list
        .whereType<Map>()
        .map((e) => MobileWorkspaceBranch.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<void> addBranch(String workspaceId, AddBranchInput input) async {
    final payload = await _apiClient.postJson(
      '/api/workspaces/$workspaceId/branches',
      body: input.toJson(),
    );
    _expectOk(payload, 'Unable to add branch.');
  }

  Future<List<MobileWorkspaceRule>> fetchRules(String workspaceId) async {
    final payload = await _apiClient.getJson('/api/workspaces/$workspaceId/rules');
    _expectOk(payload, 'Unable to load rules.');
    final list = (payload['rules'] as List?) ?? [];
    return list
        .whereType<Map>()
        .map((e) => MobileWorkspaceRule.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<void> addRule(String workspaceId, AddRuleInput input) async {
    final payload = await _apiClient.postJson(
      '/api/workspaces/$workspaceId/rules',
      body: input.toJson(),
    );
    _expectOk(payload, 'Unable to add rule.');
  }

  Future<MobileWorkspaceAnalytics> fetchAnalytics(String workspaceId) async {
    final payload = await _apiClient.getJson('/api/workspaces/$workspaceId/analytics');
    _expectOk(payload, 'Unable to load analytics.');
    final an = (payload['analytics'] as Map?) ?? <String, dynamic>{};
    return MobileWorkspaceAnalytics.fromJson(Map<String, dynamic>.from(an));
  }

  void _expectOk(Map<String, dynamic> payload, String fallbackMessage) {
    if (payload['ok'] == true) return;
    throw ApiException(
      (payload['message'] as String?) ?? fallbackMessage,
      statusCode: payload['statusCode'] as int?,
    );
  }
}
