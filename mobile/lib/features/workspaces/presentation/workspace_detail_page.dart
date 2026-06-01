import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/section_card.dart';
import '../../../shared/components/loading_shimmer.dart';
import '../data/workspace_repository.dart';
import '../domain/workspace_models.dart';

const _tabs = ['Overview', 'Members', 'Branches', 'Rules', 'Analytics'];

class WorkspaceDetailPage extends ConsumerStatefulWidget {
  const WorkspaceDetailPage({super.key, required this.workspaceId});

  final String workspaceId;

  @override
  ConsumerState<WorkspaceDetailPage> createState() => _WorkspaceDetailPageState();
}

class _WorkspaceDetailPageState extends ConsumerState<WorkspaceDetailPage> {
  int _tabIndex = 0;

  // Branch form state
  bool _addingBranch = false;
  final _branchNameCtrl = TextEditingController();
  final _branchAddrCtrl = TextEditingController();

  // Rule form state
  bool _addingRule = false;
  final _ruleNameCtrl = TextEditingController();
  final _ruleCatCtrl = TextEditingController();

  bool _busy = false;

  @override
  void dispose() {
    _branchNameCtrl.dispose();
    _branchAddrCtrl.dispose();
    _ruleNameCtrl.dispose();
    _ruleCatCtrl.dispose();
    super.dispose();
  }

  Future<void> _reloadAll() async {
    ref.invalidate(workspaceDetailProvider(widget.workspaceId));
    ref.invalidate(workspaceMembersProvider(widget.workspaceId));
    ref.invalidate(workspaceBranchesProvider(widget.workspaceId));
    ref.invalidate(workspaceRulesProvider(widget.workspaceId));
    ref.invalidate(workspaceAnalyticsProvider(widget.workspaceId));
    await Future.wait([
      ref.read(workspaceDetailProvider(widget.workspaceId).future),
      ref.read(workspaceMembersProvider(widget.workspaceId).future),
      ref.read(workspaceBranchesProvider(widget.workspaceId).future),
      ref.read(workspaceRulesProvider(widget.workspaceId).future),
      ref.read(workspaceAnalyticsProvider(widget.workspaceId).future),
    ]);
  }

  Future<void> _handleAddBranch() async {
    final name = _branchNameCtrl.text.trim();
    if (name.isEmpty) return;
    setState(() => _busy = true);
    try {
      await ref.read(workspacesRepositoryProvider).addBranch(
        widget.workspaceId,
        AddBranchInput(
          name: name,
          address: _branchAddrCtrl.text.trim(),
        ),
      );
      if (!mounted) return;
      _branchNameCtrl.clear();
      _branchAddrCtrl.clear();
      setState(() => _addingBranch = false);
      await _reloadAll();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to add branch: $e')),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _handleAddRule() async {
    final name = _ruleNameCtrl.text.trim();
    if (name.isEmpty) return;
    setState(() => _busy = true);
    try {
      await ref.read(workspacesRepositoryProvider).addRule(
        widget.workspaceId,
        AddRuleInput(name: name, category: _ruleCatCtrl.text.trim()),
      );
      if (!mounted) return;
      _ruleNameCtrl.clear();
      _ruleCatCtrl.clear();
      setState(() => _addingRule = false);
      await _reloadAll();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to add rule: $e')),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final wsAsync = ref.watch(workspaceDetailProvider(widget.workspaceId));
    final membersAsync = ref.watch(workspaceMembersProvider(widget.workspaceId));
    final branchesAsync = ref.watch(workspaceBranchesProvider(widget.workspaceId));
    final rulesAsync = ref.watch(workspaceRulesProvider(widget.workspaceId));
    final analyticsAsync = ref.watch(workspaceAnalyticsProvider(widget.workspaceId));

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => context.pop(),
        ),
        title: wsAsync.hasValue
            ? Text(wsAsync.value!.name)
            : const Text('Workspace'),
      ),
      body: wsAsync.when(
        loading: () => const _DetailLoading(),
        error: (err, _) => Center(child: Text('Unable to load workspace')),
        data: (workspace) => RefreshIndicator(
          onRefresh: _reloadAll,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (workspace.description != null &&
                              workspace.description!.isNotEmpty)
                            Padding(
                              padding: const EdgeInsets.only(top: 2),
                              child: Text(
                                workspace.description!,
                                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                  color: AppColors.inkSubtle,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                    Column(
                      children: [
                        Icon(Icons.people_outline_rounded,
                            size: 18, color: AppColors.inkFaint),
                        const SizedBox(height: 2),
                        Text(
                          '${membersAsync.hasValue ? membersAsync.value!.length : 0}/${workspace.maxMembers}',
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: AppColors.inkFaint,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Container(
                    decoration: BoxDecoration(
                      color: AppColors.surfaceAlt,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    padding: const EdgeInsets.all(3),
                    child: Row(
                      children: List.generate(_tabs.length, (i) {
                        final selected = _tabIndex == i;
                        return GestureDetector(
                          onTap: () => setState(() => _tabIndex = i),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: 8,
                            ),
                            decoration: BoxDecoration(
                              color: selected ? AppColors.surface : null,
                              borderRadius: BorderRadius.circular(10),
                              boxShadow: selected
                                  ? [
                                      BoxShadow(
                                        color: Colors.black.withValues(alpha: 0.06),
                                        blurRadius: 4,
                                        offset: const Offset(0, 2),
                                      ),
                                    ]
                                  : null,
                            ),
                            child: Text(
                              _tabs[i],
                              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                                fontWeight: selected ? FontWeight.bold : FontWeight.w500,
                                color: selected
                                    ? AppColors.ink
                                    : AppColors.inkSubtle,
                              ),
                            ),
                          ),
                        );
                      }),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 28),
                  children: [
                    switch (_tabIndex) {
                      0 => _OverviewTab(analyticsAsync),
                      1 => _MembersTab(membersAsync: membersAsync),
                      2 => _BranchesTab(
                        branchesAsync: branchesAsync,
                        addingBranch: _addingBranch,
                        busy: _busy,
                        branchNameCtrl: _branchNameCtrl,
                        branchAddrCtrl: _branchAddrCtrl,
                        onToggleForm: () =>
                            setState(() => _addingBranch = !_addingBranch),
                        onAdd: _handleAddBranch,
                      ),
                      3 => _RulesTab(
                        rulesAsync: rulesAsync,
                        addingRule: _addingRule,
                        busy: _busy,
                        ruleNameCtrl: _ruleNameCtrl,
                        ruleCatCtrl: _ruleCatCtrl,
                        onToggleForm: () =>
                            setState(() => _addingRule = !_addingRule),
                        onAdd: _handleAddRule,
                      ),
                      4 => _AnalyticsTab(analyticsAsync),
                      _ => const SizedBox.shrink(),
                    },
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Overview Tab ──

class _OverviewTab extends StatelessWidget {
  const _OverviewTab(this.analyticsAsync);

  final AsyncValue<MobileWorkspaceAnalytics> analyticsAsync;

  @override
  Widget build(BuildContext context) {
    final analytics = analyticsAsync.asData?.value;
    return Column(
      children: [
        _StatCard(
          label: 'Total Orders',
          value: '${analytics?.totalOrders ?? 0}',
        ),
        const SizedBox(height: 12),
        _StatCard(
          label: 'Completed Jobs',
          value: '${analytics?.completedOrders ?? 0}',
          valueColor: AppColors.success,
        ),
        const SizedBox(height: 12),
        _StatCard(
          label: 'Revenue',
          value: '₹${_formatInr(analytics?.totalRevenue ?? 0)}',
          valueColor: AppColors.primaryDeep,
        ),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.label,
    required this.value,
    this.valueColor,
  });

  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.inkSubtle,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  value,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: valueColor ?? AppColors.ink,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Members Tab ──

class _MembersTab extends ConsumerWidget {
  const _MembersTab({required this.membersAsync});

  final AsyncValue<List<MobileWorkspaceMember>> membersAsync;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return membersAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Text('Error: $e'),
      data: (members) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '${members.length} member${members.length == 1 ? '' : 's'}',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  color: AppColors.inkSubtle,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (members.isEmpty)
            _emptyHint('No members yet.')
          else
            ...members.map((m) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _MemberTile(member: m),
            )),
        ],
      ),
    );
  }
}

class _MemberTile extends StatelessWidget {
  const _MemberTile({required this.member});

  final MobileWorkspaceMember member;

  @override
  Widget build(BuildContext context) {
    final initial = (member.profile?.fullName ?? '?').isNotEmpty
        ? (member.profile?.fullName ?? '?')[0].toUpperCase()
        : '?';
    return SectionCard(
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.primarySoft,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Center(
              child: Text(
                initial,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: AppColors.primaryDeep,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  member.profile?.fullName ?? 'Unknown',
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  '${member.role} · ${member.isActive ? 'Active' : 'Inactive'}',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.inkSubtle,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: member.role == 'owner'
                  ? AppColors.warmSoft
                  : AppColors.accentSoft,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              member.role,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                fontWeight: FontWeight.bold,
                color: member.role == 'owner'
                    ? AppColors.warm
                    : AppColors.accent,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Branches Tab ──

class _BranchesTab extends StatelessWidget {
  const _BranchesTab({
    required this.branchesAsync,
    required this.addingBranch,
    required this.busy,
    required this.branchNameCtrl,
    required this.branchAddrCtrl,
    required this.onToggleForm,
    required this.onAdd,
  });

  final AsyncValue<List<MobileWorkspaceBranch>> branchesAsync;
  final bool addingBranch;
  final bool busy;
  final TextEditingController branchNameCtrl;
  final TextEditingController branchAddrCtrl;
  final VoidCallback onToggleForm;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    return branchesAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Text('Error: $e'),
      data: (branches) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '${branches.length} branch${branches.length == 1 ? '' : 'es'}',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  color: AppColors.inkSubtle,
                ),
              ),
              TextButton.icon(
                onPressed: onToggleForm,
                icon: const Icon(Icons.add_rounded, size: 18),
                label: const Text('Add Branch'),
              ),
            ],
          ),
          if (addingBranch) ...[
            const SizedBox(height: 8),
            SectionCard(
              child: Column(
                children: [
                  TextField(
                    controller: branchNameCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Branch name',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: branchAddrCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Address (optional)',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      FilledButton(
                        onPressed:
                            busy || branchNameCtrl.text.trim().isEmpty ? null : onAdd,
                        child: busy
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : const Text('Save'),
                      ),
                      const SizedBox(width: 8),
                      TextButton(
                        onPressed: onToggleForm,
                        child: const Text('Cancel'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
          ],
          if (branches.isEmpty && !addingBranch)
            _emptyHint('No branches added yet.')
          else
            ...branches.map((b) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _BranchTile(branch: b),
            )),
        ],
      ),
    );
  }
}

class _BranchTile extends StatelessWidget {
  const _BranchTile({required this.branch});

  final MobileWorkspaceBranch branch;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.surfaceAlt,
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.location_on_outlined,
                size: 20, color: AppColors.inkSubtle),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  branch.name,
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                if (branch.address != null && branch.address!.isNotEmpty)
                  Text(
                    branch.address!,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppColors.inkSubtle,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                Text(
                  '${branch.serviceAreaRadiusKm.toStringAsFixed(0)} km radius',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.inkFaint,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Rules Tab ──

class _RulesTab extends StatelessWidget {
  const _RulesTab({
    required this.rulesAsync,
    required this.addingRule,
    required this.busy,
    required this.ruleNameCtrl,
    required this.ruleCatCtrl,
    required this.onToggleForm,
    required this.onAdd,
  });

  final AsyncValue<List<MobileWorkspaceRule>> rulesAsync;
  final bool addingRule;
  final bool busy;
  final TextEditingController ruleNameCtrl;
  final TextEditingController ruleCatCtrl;
  final VoidCallback onToggleForm;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    return rulesAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Text('Error: $e'),
      data: (rules) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '${rules.length} rule${rules.length == 1 ? '' : 's'}',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  color: AppColors.inkSubtle,
                ),
              ),
              TextButton.icon(
                onPressed: onToggleForm,
                icon: const Icon(Icons.add_rounded, size: 18),
                label: const Text('Add Rule'),
              ),
            ],
          ),
          if (addingRule) ...[
            const SizedBox(height: 8),
            SectionCard(
              child: Column(
                children: [
                  TextField(
                    controller: ruleNameCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Rule name',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: ruleCatCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Category (optional)',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      FilledButton(
                        onPressed:
                            busy || ruleNameCtrl.text.trim().isEmpty ? null : onAdd,
                        child: busy
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : const Text('Save'),
                      ),
                      const SizedBox(width: 8),
                      TextButton(
                        onPressed: onToggleForm,
                        child: const Text('Cancel'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
          ],
          if (rules.isEmpty && !addingRule)
            _emptyHint('No assignment rules yet.')
          else
            ...rules.map((r) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _RuleTile(rule: r),
            )),
        ],
      ),
    );
  }
}

class _RuleTile extends StatelessWidget {
  const _RuleTile({required this.rule});

  final MobileWorkspaceRule rule;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  rule.name,
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              Text(
                'Priority ${rule.priority}',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppColors.inkFaint,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: [
              if (rule.category != null && rule.category!.isNotEmpty)
                _Tag(rule.category!),
              _Tag('SLA: ${rule.slaMinutes}m'),
              _Tag('Max leads: ${rule.maxLeadsPerMember}'),
              _Tag(rule.roundRobin ? 'Round-robin' : 'Fixed'),
            ],
          ),
        ],
      ),
    );
  }
}

class _Tag extends StatelessWidget {
  const _Tag(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: AppColors.surfaceAlt,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        text,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
          color: AppColors.inkSubtle,
          fontSize: 10,
        ),
      ),
    );
  }
}

// ── Analytics Tab ──

class _AnalyticsTab extends StatelessWidget {
  const _AnalyticsTab(this.analyticsAsync);

  final AsyncValue<MobileWorkspaceAnalytics> analyticsAsync;

  @override
  Widget build(BuildContext context) {
    final analytics = analyticsAsync.asData?.value;
    if (analytics == null) {
      return const Center(child: CircularProgressIndicator());
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Stats grid
        Row(
          children: [
            Expanded(child: _MiniStatCard(
              label: 'Members',
              value: '${analytics.activeMembers} / ${analytics.totalMembers}',
            )),
            const SizedBox(width: 12),
            Expanded(child: _MiniStatCard(
              label: 'Orders',
              value: '${analytics.totalOrders}',
            )),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(child: _MiniStatCard(
              label: 'Completed',
              value: '${analytics.completedOrders}',
            )),
            const SizedBox(width: 12),
            Expanded(child: _MiniStatCard(
              label: 'Avg Order',
              value: '₹${_formatInr(analytics.avgOrderValue)}',
            )),
          ],
        ),

        // Recent activity
        if (analytics.recentActivity.isNotEmpty) ...[
          const SizedBox(height: 20),
          SectionCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Recent Activity',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 12),
                ...analytics.recentActivity.take(10).map((a) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Row(
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        decoration: const BoxDecoration(
                          color: AppColors.primary,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              a.description ?? a.action,
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                            if (a.createdAt != null)
                              Text(
                                _dateLabel(a.createdAt),
                                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                  color: AppColors.inkFaint,
                                  fontSize: 10,
                                ),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                )),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class _MiniStatCard extends StatelessWidget {
  const _MiniStatCard({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: AppColors.inkSubtle,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Shared widgets ──

Widget _emptyHint(String message) {
  return Padding(
    padding: const EdgeInsets.symmetric(vertical: 24),
    child: Center(
      child: Text(
        message,
        style: const TextStyle(color: AppColors.inkFaint),
      ),
    ),
  );
}

class _DetailLoading extends StatelessWidget {
  const _DetailLoading();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: List.generate(
        4,
        (_) => const Padding(
          padding: EdgeInsets.only(bottom: 12),
          child: SectionCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                LoadingShimmer(height: 16, width: 120),
                SizedBox(height: 10),
                LoadingShimmer(height: 28, width: 160),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

String _formatInr(double amount) {
  return amount.toInt().toString().replaceAllMapped(
    RegExp(r'(\d)(?=(\d{2})+\d(?!\d))'),
    (match) => '${match[1]},',
  );
}

String _dateLabel(DateTime? date) {
  if (date == null) return '';
  return '${date.day}/${date.month}/${date.year}';
}
