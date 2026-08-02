import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/constants/app_routes.dart';
import '../../../core/design_system/design_system.dart';
import '../../../core/theme/design_tokens.dart';
import '../../../features/profile/data/profile_repository.dart';

enum _SeekerOnboardingStep { welcome, profile, complete }

const _interestCategories = [
  'Home & Repairs',
  'Cleaning',
  'Electronics',
  'Tutoring',
  'Health & Wellness',
  'Photography',
  'Events',
  'Delivery',
  'Automotive',
  'Pet Care',
  'Gardening',
  'Cooking',
  'Design',
  'Tech Support',
  'Moving & Hauling',
  'Other',
];

class SeekerOnboardingPage extends ConsumerStatefulWidget {
  const SeekerOnboardingPage({super.key});

  @override
  ConsumerState<SeekerOnboardingPage> createState() =>
      _SeekerOnboardingPageState();
}

class _SeekerOnboardingPageState
    extends ConsumerState<SeekerOnboardingPage> {
  _SeekerOnboardingStep _step = _SeekerOnboardingStep.welcome;
  bool _saving = false;
  String _error = '';

  final _nameController = TextEditingController();
  final _locationController = TextEditingController();
  final _phoneController = TextEditingController();
  final _interests = <String>{};

  @override
  void initState() {
    super.initState();
    final profile = ref
        .read(profileSnapshotProvider)
        .asData
        ?.value
        .profile;
    if (profile != null) {
      _nameController.text = profile.fullName;
      _locationController.text = profile.location;
      _phoneController.text = profile.phone;
      final hasData = profile.fullName.isNotEmpty ||
          profile.location.isNotEmpty ||
          profile.phone.isNotEmpty;
      if (hasData) {
        _step = _SeekerOnboardingStep.profile;
      }
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _locationController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  bool get _hasName => _nameController.text.trim().isNotEmpty;
  bool get _hasLocation => _locationController.text.trim().isNotEmpty;
  bool get _hasPhone => _phoneController.text.trim().isNotEmpty;

  Future<void> _save() async {
    if (!_hasName) {
      setState(() => _error = 'Please enter your full name.');
      return;
    }
    if (!_hasLocation) {
      setState(() => _error = 'Please enter your city or area.');
      return;
    }
    if (!_hasPhone) {
      setState(() => _error = 'Please enter your phone number.');
      return;
    }
    final digits = _phoneController.text.replaceAll(RegExp(r'\D'), '');
    if (digits.length != 10) {
      setState(() => _error = 'Enter a 10-digit mobile number.');
      return;
    }

    setState(() {
      _saving = true;
      _error = '';
    });

    try {
      final asyncSnapshot = ref.read(profileSnapshotProvider);
      final snapshot = asyncSnapshot.asData?.value;
      if (snapshot == null) {
        throw const ApiException('Profile not loaded yet.');
      }

      await ref.read(profileRepositoryProvider).saveProfileFields(
        snapshot,
        fullName: _nameController.text.trim(),
        location: _locationController.text.trim(),
        bio: snapshot.profile.bio.isNotEmpty
            ? snapshot.profile.bio
            : 'Active on ServiQ — here to find help nearby.',
        phone: _phoneController.text.trim(),
        website: snapshot.profile.website,
        avatarUrl: snapshot.profile.avatarUrl,
        availability: snapshot.profile.availability,
        interests: _interests.toList(),
      );

      ref.invalidate(profileSnapshotProvider);
      await ref.read(profileSnapshotProvider.future);

      if (!mounted) return;
      HapticFeedback.mediumImpact();
      setState(() {
        _step = _SeekerOnboardingStep.complete;
        _saving = false;
      });
    } on ApiException catch (error) {
      setState(() {
        _error = error.message;
        _saving = false;
      });
    } catch (error) {
      setState(() {
        _error = 'Unable to save. Please try again.';
        _saving = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return ServiqScaffold(
      appBar: ServiqTopBar(
        title: _step == _SeekerOnboardingStep.welcome
            ? 'Welcome'
            : _step == _SeekerOnboardingStep.profile
                ? 'Set up your profile'
                : 'You\'re all set',
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.xxs, AppSpacing.lg, AppSpacing.lg),
          child: Column(
            children: [
              _StepIndicator(
                currentStep: _step,
                totalSteps: 3,
              ),
              const SizedBox(height: AppSpacing.xl),
              Expanded(child: _buildStepContent()),
              const SizedBox(height: AppSpacing.md),
              _buildNavigation(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStepContent() {
    switch (_step) {
      case _SeekerOnboardingStep.welcome:
        return _buildWelcomeStep();
      case _SeekerOnboardingStep.profile:
        return _buildProfileStep();
      case _SeekerOnboardingStep.complete:
        return _buildCompleteStep();
    }
  }

  Widget _buildWelcomeStep() {
    return SingleChildScrollView(
      child: Column(
        children: [
          const SizedBox(height: AppSpacing.xl),
          ClipRRect(
            borderRadius: BorderRadius.circular(24),
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
              child: Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      Theme.of(context).colorScheme.primary.withValues(alpha: 0.25),
                      Theme.of(context).colorScheme.primary.withValues(alpha: 0.08),
                    ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.2)),
                ),
                child: Icon(
                  Icons.bolt_rounded,
                  size: 40,
                  color: Theme.of(context).colorScheme.primary,
                ),
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.xl),
          Text(
            'Welcome to ServiQ',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Your local marketplace for trusted help nearby. '
            'Post what you need, get replies from vetted providers in your area.',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
              height: 1.5,
            ),
          ),
          const SizedBox(height: AppSpacing.xxl),
          _InfoCard(
            icon: Icons.search_rounded,
            title: 'Find help nearby',
            description: 'Browse providers or post a task and let them come to you.',
          ),
          const SizedBox(height: AppSpacing.sm),
          _InfoCard(
            icon: Icons.chat_rounded,
            title: 'Chat & compare',
            description: 'Message providers, compare quotes, and choose the best fit.',
          ),
          const SizedBox(height: AppSpacing.sm),
          _InfoCard(
            icon: Icons.shield_rounded,
            title: 'Trust & safety',
            description: 'Reviews, verified profiles, and secure payments built in.',
          ),
        ],
      ),
    );
  }

  Widget _buildProfileStep() {
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Your details',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: AppSpacing.xxs),
          Text(
            'This helps nearby providers know who they\'re talking to.',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          AppTextField(
            controller: _nameController,
            label: 'Full name',
            hint: 'Your full name',
            prefixIcon: Icons.person_outline_rounded,
            textCapitalization: TextCapitalization.words,
            textInputAction: TextInputAction.next,
          ),
          const SizedBox(height: AppSpacing.sm),
          AppTextField(
            controller: _locationController,
            label: 'Location',
            hint: 'City or area (e.g. "Andheri West, Mumbai")',
            prefixIcon: Icons.location_on_outlined,
            textCapitalization: TextCapitalization.words,
            textInputAction: TextInputAction.next,
          ),
          const SizedBox(height: AppSpacing.sm),
          AppTextField(
            controller: _phoneController,
            label: 'Phone number',
            hint: '10-digit mobile number',
            prefixIcon: Icons.phone_outlined,
            keyboardType: TextInputType.phone,
            textInputAction: TextInputAction.done,
          ),
          const SizedBox(height: AppSpacing.xl),
          Text(
            'What are you interested in?',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: AppSpacing.xxs),
          Text(
            'Select categories you might need help with.',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: _interestCategories.map((category) {
              final selected = _interests.contains(category);
              return _GlassInterestChip(
                label: category,
                selected: selected,
                onTap: () {
                  setState(() {
                    if (!selected) {
                      _interests.add(category);
                    } else {
                      _interests.remove(category);
                    }
                  });
                },
              );
            }).toList(),
          ),
          if (_error.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            ServiqSurface(
              variant: ServiqSurfaceVariant.glass,
              padding: const EdgeInsets.all(AppSpacing.sm),
              child: Row(
                children: [
                  Icon(Icons.warning_amber_rounded, size: 16, color: Theme.of(context).colorScheme.error),
                  const SizedBox(width: AppSpacing.xs),
                  Expanded(
                    child: Text(
                      _error,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildCompleteStep() {
    return SingleChildScrollView(
      child: Column(
        children: [
          const SizedBox(height: AppSpacing.xl),
          ClipRRect(
            borderRadius: BorderRadius.circular(24),
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
              child: Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      AppColors.success.withValues(alpha: 0.25),
                      AppColors.success.withValues(alpha: 0.08),
                    ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: AppColors.success.withValues(alpha: 0.2)),
                ),
                child: Icon(
                  Icons.check_circle_rounded,
                  size: 48,
                  color: AppColors.success,
                ),
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.xl),
          Text(
            'You\'re all set!',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Your profile is ready. Here are the fastest ways to get started.',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
              height: 1.5,
            ),
          ),
          const SizedBox(height: AppSpacing.xxl),
          _ActionCard(
            icon: Icons.edit_note_rounded,
            title: 'Post your first need',
            description: 'Describe what you need and nearby providers will reply.',
            onTap: () => context.go(AppRoutes.createNeed),
          ),
          const SizedBox(height: AppSpacing.sm),
          _ActionCard(
            icon: Icons.people_rounded,
            title: 'Browse providers',
            description: 'Explore trusted providers and services in your area.',
            onTap: () => context.go(AppRoutes.people),
          ),
          const SizedBox(height: AppSpacing.sm),
          _ActionCard(
            icon: Icons.explore_rounded,
            title: 'Explore the feed',
            description: 'See what\'s happening in your local marketplace.',
            onTap: () => context.go(AppRoutes.welcome),
          ),
        ],
      ),
    );
  }

  Widget _buildNavigation() {
    switch (_step) {
      case _SeekerOnboardingStep.welcome:
        return PrimaryButton(
          label: 'Get started',
          onPressed: () => setState(() {
            _step = _SeekerOnboardingStep.profile;
            _error = '';
          }),
        );
      case _SeekerOnboardingStep.profile:
        return Row(
          children: [
            Expanded(
              child: SecondaryButton(
                label: 'Back',
                onPressed: _saving
                    ? null
                    : () => setState(() {
                          _step = _SeekerOnboardingStep.welcome;
                          _error = '';
                        }),
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              flex: 2,
              child: PrimaryButton(
                label: _saving ? 'Saving...' : 'Save & continue',
                icon: _saving
                    ? const SizedBox(
                        width: AppSpacing.lg,
                        height: AppSpacing.lg,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : null,
                onPressed: _saving ? null : () => _save(),
              ),
            ),
          ],
        );
      case _SeekerOnboardingStep.complete:
        return PrimaryButton(
          label: 'Start exploring',
          onPressed: () => context.go(AppRoutes.welcome),
        );
    }
  }
}

class _StepIndicator extends StatelessWidget {
  const _StepIndicator({
    required this.currentStep,
    required this.totalSteps,
  });

  final _SeekerOnboardingStep currentStep;
  final int totalSteps;

  int get _currentIndex {
    switch (currentStep) {
      case _SeekerOnboardingStep.welcome:
        return 0;
      case _SeekerOnboardingStep.profile:
        return 1;
      case _SeekerOnboardingStep.complete:
        return 2;
    }
  }

  @override
  Widget build(BuildContext context) {
    final stepLabels = ['Welcome', 'Profile', 'Done'];
    return Row(
      children: List.generate(totalSteps, (index) {
        final isActive = index == _currentIndex;
        final isComplete = index < _currentIndex;
        return Expanded(
          child: Padding(
            padding: EdgeInsets.only(
              right: index < totalSteps - 1 ? AppSpacing.xs : 0,
            ),
            child: Row(
              children: [
                Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: isComplete
                        ? AppColors.success
                        : isActive
                            ? Theme.of(context).colorScheme.primary
                            : Theme.of(context).colorScheme.outline,
                  ),
                  child: Center(
                    child: isComplete
                        ? Icon(Icons.check, size: 16, color: Colors.white)
                        : Text(
                            '${index + 1}',
                            style: TextStyle(
                              color: isActive ? Colors.white : Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.5),
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                  ),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    stepLabels[index],
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
                      color: isActive
                          ? Theme.of(context).colorScheme.onSurface
                          : isComplete
                              ? AppColors.success
                              : Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.5),
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
        );
      }),
    );
  }
}

class _InfoCard extends StatelessWidget {
  const _InfoCard({
    required this.icon,
    required this.title,
    required this.description,
  });

  final IconData icon;
  final String title;
  final String description;

  @override
  Widget build(BuildContext context) {
    return ServiqSurface(
      variant: ServiqSurfaceVariant.glass,
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  Theme.of(context).colorScheme.primary.withValues(alpha: 0.25),
                  Theme.of(context).colorScheme.primary.withValues(alpha: 0.08),
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.2)),
            ),
            child: Icon(
              icon,
              color: Theme.of(context).colorScheme.primary,
              size: 22,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 15,
                  ),
                ),
                const SizedBox(height: AppSpacing.xxxs),
                Text(
                  description,
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
                    fontSize: 13,
                    height: 1.4,
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

class _ActionCard extends StatelessWidget {
  const _ActionCard({
    required this.icon,
    required this.title,
    required this.description,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String description;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: ServiqSurface(
        variant: ServiqSurfaceVariant.glass,
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    Theme.of(context).colorScheme.primary.withValues(alpha: 0.25),
                    Theme.of(context).colorScheme.primary.withValues(alpha: 0.08),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.2)),
              ),
              child: Icon(
                icon,
                color: Theme.of(context).colorScheme.primary,
                size: 22,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 15,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xxxs),
                  Text(
                    description,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
                      fontSize: 13,
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(AppRadii.pill),
              ),
              child: Icon(
                Icons.chevron_right_rounded,
                size: 14,
                color: AppColors.primary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _GlassInterestChip extends StatelessWidget {
  const _GlassInterestChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppRadii.pill),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 6, sigmaY: 6),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: selected
                    ? [AppColors.primary.withValues(alpha: 0.25), AppColors.primary.withValues(alpha: 0.08)]
                    : [Colors.transparent, Colors.transparent],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(AppRadii.pill),
              border: Border.all(
                color: selected
                    ? AppColors.primary.withValues(alpha: 0.5)
                    : Theme.of(context).colorScheme.outline.withValues(alpha: 0.25),
              ),
            ),
            child: Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
                color: selected ? AppColors.primary : Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
