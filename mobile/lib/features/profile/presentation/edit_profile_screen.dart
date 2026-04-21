import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/error/app_error_mapper.dart';
import '../../../core/services/analytics_service.dart';
import '../../../core/theme/design_tokens.dart';
import '../../../shared/widgets/error_state.dart';
import '../../../shared/widgets/loading_skeletons.dart';
import '../data/profile_hub_repository.dart';

class EditProfileScreen extends ConsumerStatefulWidget {
  const EditProfileScreen({super.key});

  @override
  ConsumerState<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends ConsumerState<EditProfileScreen> {
  final _nameController = TextEditingController();
  final _headlineController = TextEditingController();
  final _bioController = TextEditingController();
  final _localityController = TextEditingController();
  final Set<String> _selectedCategories = <String>{};
  bool _seeded = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(analyticsServiceProvider).trackScreen('edit_profile_screen');
    });
  }

  @override
  void dispose() {
    _nameController.dispose();
    _headlineController.dispose();
    _bioController.dispose();
    _localityController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final profileAsync = ref.watch(profileHubProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Edit profile')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.pageInset,
            AppSpacing.sm,
            AppSpacing.pageInset,
            AppSpacing.pageInset,
          ),
          children: [
            profileAsync.when(
              data: (hub) {
                if (!_seeded) {
                  _nameController.text = hub.profile.name;
                  _headlineController.text = hub.profile.headline;
                  _bioController.text = hub.profile.bio;
                  _localityController.text = hub.profile.locality;
                  _selectedCategories
                    ..clear()
                    ..addAll(hub.profile.serviceCategories);
                  _seeded = true;
                }

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Edit core trust signals',
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      'A stronger headline, clearer bio, and focused categories improve conversion and trust.',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    TextField(
                      controller: _nameController,
                      decoration: const InputDecoration(labelText: 'Name'),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    TextField(
                      controller: _headlineController,
                      decoration: const InputDecoration(labelText: 'Headline'),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    TextField(
                      controller: _bioController,
                      maxLines: 4,
                      decoration: const InputDecoration(labelText: 'About'),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    TextField(
                      controller: _localityController,
                      decoration: const InputDecoration(labelText: 'Locality'),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    Text(
                      'Service categories',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Wrap(
                      spacing: AppSpacing.sm,
                      runSpacing: AppSpacing.sm,
                      children:
                          const [
                            'Repairs',
                            'Errands',
                            'Tutors',
                            'Cleaning',
                            'Moving',
                            'Home help',
                          ].map((category) {
                            return _buildCategoryChoice(category: category);
                          }).toList(),
                    ),
                    const SizedBox(height: AppSpacing.xl),
                    FilledButton.icon(
                      onPressed: () async {
                        try {
                          await ref
                              .read(profileHubRepositoryProvider)
                              .updateProfile(
                                name: _nameController.text.trim(),
                                headline: _headlineController.text.trim(),
                                bio: _bioController.text.trim(),
                                locality: _localityController.text.trim(),
                                serviceCategories: _selectedCategories.toList(),
                              );
                          ref.invalidate(profileHubProvider);
                          if (!context.mounted) {
                            return;
                          }
                          Navigator.of(context).pop();
                        } catch (error) {
                          if (!context.mounted) {
                            return;
                          }
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text(AppErrorMapper.toMessage(error)),
                            ),
                          );
                        }
                      },
                      icon: const Icon(Icons.save_outlined),
                      label: const Text('Save changes'),
                    ),
                  ],
                );
              },
              loading: () => const CardListSkeleton(count: 3),
              error: (error, _) => AppErrorState(
                title: 'Profile could not load',
                message: AppErrorMapper.toMessage(error),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCategoryChoice({required String category}) {
    final selected = _selectedCategories.contains(category);
    return FilterChip(
      label: Text(category),
      selected: selected,
      onSelected: (value) {
        setState(() {
          if (value) {
            _selectedCategories.add(category);
          } else {
            _selectedCategories.remove(category);
          }
        });
      },
    );
  }
}
