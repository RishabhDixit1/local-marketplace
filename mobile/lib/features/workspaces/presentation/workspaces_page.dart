import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/design_system/design_system.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/section_card.dart';
import '../data/workspace_repository.dart';
import '../domain/workspace_models.dart';

class WorkspacesPage extends ConsumerStatefulWidget {
  const WorkspacesPage({super.key});

  @override
  ConsumerState<WorkspacesPage> createState() => _WorkspacesPageState();
}

class _WorkspacesPageState extends ConsumerState<WorkspacesPage> {
  final _nameController = TextEditingController();
  final _descController = TextEditingController();
  final _typeController = TextEditingController();
  bool _creating = false;

  @override
  void dispose() {
    _nameController.dispose();
    _descController.dispose();
    _typeController.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    ref.invalidate(workspaceListProvider);
    await ref.read(workspaceListProvider.future);
  }

  Future<void> _createWorkspace() async {
    final name = _nameController.text.trim();
    if (name.isEmpty) return;

    setState(() => _creating = true);
    try {
      final ws = await ref.read(workspacesRepositoryProvider).createWorkspace(
        CreateWorkspaceInput(
          name: name,
          description: _descController.text.trim(),
          businessType: _typeController.text.trim(),
        ),
      );
      if (!mounted) return;
      Navigator.of(context).pop();
      _nameController.clear();
      _descController.clear();
      _typeController.clear();
      context.push('/app/workspaces/${ws.id}');
    } catch (e) {
      if (!mounted) return;
      ServiqToast.show(context, message: 'Failed to create workspace: $e', tone: ServiqToastTone.danger);
    } finally {
      if (mounted) setState(() => _creating = false);
    }
  }

  void _showCreateSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.viewInsetsOf(ctx).bottom,
        ),
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.sizeOf(ctx).height * 0.75,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
                child: Text(
                  'New Workspace',
                  style: Theme.of(ctx).textTheme.titleLarge,
                ),
              ),
              Flexible(
                child: ListView(
                  shrinkWrap: true,
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  children: [
                    AppTextField(
                      controller: _nameController,
                      label: 'Business name',
                      hint: 'Your business or team name',
                      textCapitalization: TextCapitalization.words,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    AppTextField(
                      controller: _descController,
                      label: 'Description (optional)',
                      hint: 'What does your team do?',
                      maxLines: 2,
                      textCapitalization: TextCapitalization.sentences,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    AppTextField(
                      controller: _typeController,
                      label: 'Business type (optional)',
                      hint: 'e.g. Plumbing, Design, Consulting',
                      textCapitalization: TextCapitalization.sentences,
                    ),
                    const SizedBox(height: AppSpacing.lg),
                  ],
                ),
              ),
              Container(
                width: double.infinity,
                padding: EdgeInsets.fromLTRB(
                  20, 12, 20,
                  MediaQuery.paddingOf(ctx).bottom + 12,
                ),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  border: Border(top: BorderSide(color: Theme.of(context).colorScheme.outline)),
                ),
                child: FilledButton(
                  onPressed: _creating || _nameController.text.trim().isEmpty
                      ? null
                      : _createWorkspace,
                  child: _creating
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Text('Create Workspace'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final workspacesAsync = ref.watch(workspaceListProvider);

    return ServiqScaffold(
      appBar: ServiqTopBar(
        title: 'Team Workspaces',
        actions: [
          IconButton(
            icon: Icon(Icons.add_rounded),
            onPressed: _showCreateSheet,
            tooltip: 'New workspace',
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: workspacesAsync.when(
          loading: () => const _WorkspacesLoading(),
          error: (err, _) => Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('Unable to load workspaces',
                    style: Theme.of(context).textTheme.bodyLarge),
                const SizedBox(height: 8),
                FilledButton.tonalIcon(
                  onPressed: _refresh,
                  icon: const Icon(Icons.refresh_rounded),
                  label: const Text('Retry'),
                ),
              ],
            ),
          ),
          data: (workspaces) {
            if (workspaces.isEmpty) return _EmptyWorkspaces(onCreate: _showCreateSheet);
            return ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
              itemCount: workspaces.length,
              separatorBuilder: (_, _) => const SizedBox(height: 12),
              itemBuilder: (_, i) => _WorkspaceCard(
                workspace: workspaces[i],
                onTap: () => context.push('/app/workspaces/${workspaces[i].id}'),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _WorkspaceCard extends StatelessWidget {
  const _WorkspaceCard({required this.workspace, required this.onTap});

  final MobileWorkspace workspace;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.lg),
        onTap: onTap,
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: AppColors.primarySoft,
                borderRadius: BorderRadius.circular(AppRadii.lg),
              ),
              child: Center(
                child: Text(
                  workspace.name.isNotEmpty
                      ? workspace.name[0].toUpperCase()
                      : '?',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    color: AppColors.primaryDeep,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    workspace.name,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  if (workspace.description != null &&
                      workspace.description!.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        workspace.description!,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Icon(Icons.people_outline_rounded,
                          size: 14, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.45)),
                      const SizedBox(width: 4),
                      Text(
                        'Max ${workspace.maxMembers} members',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.45),
                        ),
                      ),
                      if (workspace.businessType != null) ...[
                        const SizedBox(width: 12),
                        Text(
                          workspace.businessType!,
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.45),
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
            Icon(Icons.chevron_right_rounded, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.45)),
          ],
        ),
      ),
    );
  }
}

class _EmptyWorkspaces extends StatelessWidget {
  const _EmptyWorkspaces({required this.onCreate});

  final VoidCallback onCreate;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.business_outlined,
            size: 64,
            color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.45),
          ),
          const SizedBox(height: 16),
          Text(
            'No workspaces yet',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Create a workspace to add team members\nand branches.',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
            ),
          ),
          const SizedBox(height: 24),
          FilledButton.icon(
            onPressed: onCreate,
            icon: const Icon(Icons.add_rounded),
            label: const Text('New Workspace'),
          ),
        ],
      ),
    );
  }
}

class _WorkspacesLoading extends StatelessWidget {
  const _WorkspacesLoading();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
      children: List.generate(
        3,
        (_) => const Padding(
          padding: EdgeInsets.only(bottom: 12),
          child: SectionCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                LoadingShimmer(height: 20, width: 180),
                SizedBox(height: 8),
                LoadingShimmer(height: 14, width: 260),
                SizedBox(height: 6),
                LoadingShimmer(height: 14, width: 140),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
