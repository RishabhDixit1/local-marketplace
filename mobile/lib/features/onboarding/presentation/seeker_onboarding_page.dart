import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/constants/app_routes.dart';
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
    return Scaffold(
      appBar: AppBar(
        title: Text(
          _step == _SeekerOnboardingStep.welcome
              ? 'Welcome'
              : _step == _SeekerOnboardingStep.profile
                  ? 'Set up your profile'
                  : 'You\'re all set',
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
          child: Column(
            children: [
              _StepIndicator(
                currentStep: _step,
                totalSteps: 3,
              ),
              const SizedBox(height: 24),
              Expanded(child: _buildStepContent()),
              const SizedBox(height: 16),
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
          const SizedBox(height: 24),
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(24),
            ),
            child: Icon(
              Icons.bolt_rounded,
              size: 40,
              color: Theme.of(context).colorScheme.primary,
            ),
          ),
          const SizedBox(height: 24),
          Text(
            'Welcome to ServiQ',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'Your local marketplace for trusted help nearby. '
            'Post what you need, get replies from vetted providers in your area.',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: AppColors.inkMuted,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 32),
          _InfoCard(
            icon: Icons.search_rounded,
            title: 'Find help nearby',
            description: 'Browse providers or post a task and let them come to you.',
          ),
          const SizedBox(height: 12),
          _InfoCard(
            icon: Icons.chat_rounded,
            title: 'Chat & compare',
            description: 'Message providers, compare quotes, and choose the best fit.',
          ),
          const SizedBox(height: 12),
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
          const SizedBox(height: 4),
          Text(
            'This helps nearby providers know who they\'re talking to.',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: AppColors.inkMuted,
            ),
          ),
          const SizedBox(height: 20),
          TextField(
            controller: _nameController,
            decoration: const InputDecoration(
              labelText: 'Full name',
              hintText: 'Your full name',
              prefixIcon: Icon(Icons.person_outline_rounded),
              border: OutlineInputBorder(),
            ),
            textCapitalization: TextCapitalization.words,
            textInputAction: TextInputAction.next,
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _locationController,
            decoration: const InputDecoration(
              labelText: 'Location',
              hintText: 'City or area (e.g. "Andheri West, Mumbai")',
              prefixIcon: Icon(Icons.location_on_outlined),
              border: OutlineInputBorder(),
            ),
            textCapitalization: TextCapitalization.words,
            textInputAction: TextInputAction.next,
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _phoneController,
            decoration: const InputDecoration(
              labelText: 'Phone number',
              hintText: '10-digit mobile number',
              prefixIcon: Icon(Icons.phone_outlined),
              border: OutlineInputBorder(),
            ),
            keyboardType: TextInputType.phone,
            textInputAction: TextInputAction.done,
          ),
          const SizedBox(height: 24),
          Text(
            'What are you interested in?',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Select categories you might need help with.',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: AppColors.inkMuted,
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _interestCategories.map((category) {
              final selected = _interests.contains(category);
              return FilterChip(
                label: Text(category),
                selected: selected,
                onSelected: (isSelected) {
                  setState(() {
                    if (isSelected) {
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
            const SizedBox(height: 16),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.error.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
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
        ],
      ),
    );
  }

  Widget _buildCompleteStep() {
    return SingleChildScrollView(
      child: Column(
        children: [
          const SizedBox(height: 24),
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              color: Colors.green.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(24),
            ),
            child: const Icon(
              Icons.check_circle_rounded,
              size: 48,
              color: Colors.green,
            ),
          ),
          const SizedBox(height: 24),
          Text(
            'You\'re all set!',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'Your profile is ready. Here are the fastest ways to get started.',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: AppColors.inkMuted,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 32),
          _ActionCard(
            icon: Icons.edit_note_rounded,
            title: 'Post your first need',
            description: 'Describe what you need and nearby providers will reply.',
            onTap: () => context.go(AppRoutes.createNeed),
          ),
          const SizedBox(height: 12),
          _ActionCard(
            icon: Icons.people_rounded,
            title: 'Browse providers',
            description: 'Explore trusted providers and services in your area.',
            onTap: () => context.go(AppRoutes.people),
          ),
          const SizedBox(height: 12),
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
        return SizedBox(
          width: double.infinity,
          child: FilledButton(
            onPressed: () => setState(() {
              _step = _SeekerOnboardingStep.profile;
              _error = '';
            }),
            child: const Text('Get started'),
          ),
        );
      case _SeekerOnboardingStep.profile:
        return Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: _saving
                    ? null
                    : () => setState(() {
                          _step = _SeekerOnboardingStep.welcome;
                          _error = '';
                        }),
                child: const Text('Back'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              flex: 2,
              child: FilledButton(
                onPressed: _saving ? null : () => _save(),
                child: _saving
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text('Save & continue'),
              ),
            ),
          ],
        );
      case _SeekerOnboardingStep.complete:
        return SizedBox(
          width: double.infinity,
          child: FilledButton(
            onPressed: () => context.go(AppRoutes.welcome),
            child: const Text('Start exploring'),
          ),
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
              right: index < totalSteps - 1 ? 8 : 0,
            ),
            child: Row(
              children: [
                Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: isComplete
                        ? Colors.green
                        : isActive
                            ? Theme.of(context).colorScheme.primary
                            : AppColors.border,
                  ),
                  child: Center(
                    child: isComplete
                        ? const Icon(Icons.check, size: 16, color: Colors.white)
                        : Text(
                            '${index + 1}',
                            style: TextStyle(
                              color: isActive ? Colors.white : AppColors.inkMuted,
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
                          ? AppColors.ink
                          : isComplete
                              ? Colors.green
                              : AppColors.inkMuted,
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
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surfaceAlt,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(14),
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
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 15,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  description,
                  style: TextStyle(
                    color: AppColors.inkMuted,
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
    return Material(
      color: Theme.of(context).colorScheme.surface,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.border),
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: Theme.of(context)
                      .colorScheme
                      .primary
                      .withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(14),
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
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 15,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      description,
                      style: TextStyle(
                        color: AppColors.inkMuted,
                        fontSize: 13,
                        height: 1.4,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.chevron_right_rounded,
                color: AppColors.inkMuted,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
