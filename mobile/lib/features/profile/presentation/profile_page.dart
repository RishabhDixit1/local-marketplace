import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/auth/auth_state_controller.dart';
import '../../../core/auth/mobile_auth_service.dart';
import '../../../core/widgets/section_card.dart';
import '../data/profile_repository.dart';
import '../domain/mobile_profile_snapshot.dart';

class ProfilePage extends ConsumerStatefulWidget {
  const ProfilePage({super.key, this.title = 'Profile', this.snapshotOverride});

  final String title;
  final AsyncValue<MobileProfileSnapshot>? snapshotOverride;

  @override
  ConsumerState<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends ConsumerState<ProfilePage> {
  final _passwordFormKey = GlobalKey<FormState>();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  bool _passwordSubmitting = false;
  String? _passwordStatus;
  String? _passwordError;
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;

  bool _googleSubmitting = false;
  String? _googleStatus;
  String? _googleError;

  @override
  void dispose() {
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  String? _validatePassword(String? value) {
    final password = value ?? '';
    if (password.length < 8) {
      return 'Use at least 8 characters.';
    }

    final hasLetter = RegExp(r'[A-Za-z]').hasMatch(password);
    final hasNumber = RegExp(r'\d').hasMatch(password);
    if (!hasLetter || !hasNumber) {
      return 'Use letters and at least one number.';
    }

    return null;
  }

  String? _validatePasswordConfirmation(String? value) {
    if ((value ?? '').isEmpty) {
      return 'Re-enter the password.';
    }

    if (value != _passwordController.text) {
      return 'Passwords do not match.';
    }

    return null;
  }

  Future<void> _refresh() async {
    ref.invalidate(profileSnapshotProvider);
    await ref.read(profileSnapshotProvider.future);
  }

  Future<void> _updatePassword() async {
    if (!_passwordFormKey.currentState!.validate()) {
      return;
    }

    final authService = ref.read(mobileAuthServiceProvider);
    FocusScope.of(context).unfocus();
    setState(() {
      _passwordSubmitting = true;
      _passwordError = null;
      _passwordStatus = null;
    });

    try {
      await authService.updatePassword(_passwordController.text);

      if (!mounted) {
        return;
      }

      _passwordController.clear();
      _confirmPasswordController.clear();

      setState(() {
        _passwordStatus =
            'Password saved. You can use email + password the next time you log in.';
      });
    } catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _passwordError = authService.friendlyErrorMessage(
          error,
          fallbackPrefix: 'Unable to save password',
        );
      });
    } finally {
      if (mounted) {
        setState(() {
          _passwordSubmitting = false;
        });
      }
    }
  }

  Future<void> _linkGoogle() async {
    final authService = ref.read(mobileAuthServiceProvider);
    FocusScope.of(context).unfocus();
    setState(() {
      _googleSubmitting = true;
      _googleError = null;
      _googleStatus = null;
    });

    try {
      await authService.linkGoogle();

      if (!mounted) {
        return;
      }

      setState(() {
        _googleStatus =
            'Google linking opened in your browser. Finish there and this same ServiQ account will keep its history.';
      });
    } catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _googleError = authService.friendlyErrorMessage(
          error,
          fallbackPrefix: 'Unable to start Google linking',
        );
      });
    } finally {
      if (mounted) {
        setState(() {
          _googleSubmitting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.read(authStateControllerProvider);
    final user = ref.watch(currentSessionProvider).asData?.value?.user;
    final AsyncValue<MobileProfileSnapshot> snapshot =
        widget.snapshotOverride ?? ref.watch(profileSnapshotProvider);

    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
            children: [
              snapshot.when(
                data: (data) => Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _ProfileHero(snapshot: data),
                    const SizedBox(height: 16),
                    _MetricsGrid(snapshot: data),
                    const SizedBox(height: 16),
                    _SummaryCard(snapshot: data),
                    const SizedBox(height: 14),
                    _CollectionCard<MobileProfileService>(
                      title: 'Services',
                      subtitle:
                          '${data.serviceCount} live services from the web profile now available on mobile.',
                      emptyState:
                          'No services added yet. The provider storefront is ready for the next listing.',
                      items: data.services.take(3).toList(),
                      itemBuilder: (service) => _PreviewRow(
                        title: service.title,
                        subtitle:
                            '${_formatPrice(service.price)} / ${_humanize(service.availability)}',
                      ),
                    ),
                    const SizedBox(height: 14),
                    _CollectionCard<MobileProfileProduct>(
                      title: 'Products',
                      subtitle:
                          '${data.productCount} product listings synced into the mobile account view.',
                      emptyState:
                          'No products yet. Once the web catalog grows, it will appear here too.',
                      items: data.products.take(3).toList(),
                      itemBuilder: (product) => _PreviewRow(
                        title: product.title,
                        subtitle:
                            '${_formatPrice(product.price)} / ${product.stock} in stock',
                      ),
                    ),
                    const SizedBox(height: 14),
                    _CollectionCard<MobileProfilePortfolioItem>(
                      title: 'Portfolio',
                      subtitle:
                          '${data.portfolioCount} proof points and projects ready for buyer trust.',
                      emptyState:
                          'No portfolio entries yet. Add showcased work from the web profile next.',
                      items: data.portfolio.take(3).toList(),
                      itemBuilder: (entry) => _PreviewRow(
                        title: entry.title,
                        subtitle: entry.category,
                      ),
                    ),
                    const SizedBox(height: 14),
                    _CollectionCard<MobileProfileWorkHistoryItem>(
                      title: 'Work history',
                      subtitle:
                          '${data.workHistoryCount} experience entries carried over from the profile bundle.',
                      emptyState:
                          'No work history added yet. This slot is ready for trust-building experience.',
                      items: data.workHistory.take(3).toList(),
                      itemBuilder: (entry) => _PreviewRow(
                        title: entry.roleTitle,
                        subtitle: entry.isCurrent
                            ? '${entry.companyName} / Current'
                            : entry.companyName,
                      ),
                    ),
                    const SizedBox(height: 14),
                    _CollectionCard<MobileProfileAvailabilityItem>(
                      title: 'Availability',
                      subtitle:
                          '${data.availabilityCount} schedule blocks synced for faster matching.',
                      emptyState:
                          'No detailed schedule yet. The profile still shows your overall availability.',
                      items: data.availability.take(3).toList(),
                      itemBuilder: (entry) => _PreviewRow(
                        title: entry.label,
                        subtitle: _availabilitySummary(entry),
                      ),
                    ),
                    const SizedBox(height: 14),
                    _CollectionCard<MobileProfilePaymentMethod>(
                      title: 'Payment methods',
                      subtitle:
                          '${data.paymentMethodCount} payout methods visible to the signed-in owner only.',
                      emptyState:
                          'No payout methods saved yet.',
                      items: data.paymentMethods.take(3).toList(),
                      itemBuilder: (entry) => _PreviewRow(
                        title: _humanize(entry.methodType),
                        subtitle: _paymentSummary(entry),
                      ),
                    ),
                    const SizedBox(height: 14),
                    _CollectionCard<MobileProfileReview>(
                      title: 'Reviews',
                      subtitle:
                          '${data.reviewCount} reviews and a ${data.averageRating.toStringAsFixed(1)} average now reach the app too.',
                      emptyState:
                          'No reviews yet. Completed jobs and follow-through will start building this section.',
                      items: data.reviews.take(3).toList(),
                      itemBuilder: (entry) => _PreviewRow(
                        title: '${entry.rating.toStringAsFixed(1)} stars',
                        subtitle: entry.comment.isEmpty
                            ? 'No written note'
                            : entry.comment,
                      ),
                    ),
                    const SizedBox(height: 14),
                    _SignInMethodsCard(
                      linkedProviders: data.linkedProviders,
                      hasGoogle: data.linkedProviders.contains('google'),
                      googleSubmitting: _googleSubmitting,
                      googleStatus: _googleStatus,
                      googleError: _googleError,
                      onLinkGoogle: _linkGoogle,
                    ),
                    const SizedBox(height: 14),
                    _PasswordCard(
                      formKey: _passwordFormKey,
                      passwordController: _passwordController,
                      confirmPasswordController:
                          _confirmPasswordController,
                      passwordSubmitting: _passwordSubmitting,
                      passwordStatus: _passwordStatus,
                      passwordError: _passwordError,
                      obscurePassword: _obscurePassword,
                      obscureConfirmPassword: _obscureConfirmPassword,
                      onTogglePassword: () {
                        setState(() {
                          _obscurePassword = !_obscurePassword;
                        });
                      },
                      onToggleConfirmPassword: () {
                        setState(() {
                          _obscureConfirmPassword =
                              !_obscureConfirmPassword;
                        });
                      },
                      onSubmit: _updatePassword,
                      validatePassword: _validatePassword,
                      validateConfirmation:
                          _validatePasswordConfirmation,
                    ),
                    const SizedBox(height: 14),
                    _AccountCard(
                      snapshot: data,
                      user: user,
                      onSignOut: () async {
                        await auth.signOut();
                      },
                    ),
                  ],
                ),
                loading: () => const _ProfileLoadingState(),
                error: (error, stackTrace) =>
                    _ProfileErrorState(error: error),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ProfileHero extends StatelessWidget {
  const _ProfileHero({required this.snapshot});

  final MobileProfileSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    final profile = snapshot.profile;
    final initials = _avatarFallback(
      profile.fullName.isEmpty ? snapshot.displayName : profile.fullName,
    );

    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: const LinearGradient(
          colors: [Color(0xFF0B1F33), Color(0xFF11466A), Color(0xFF0EA5A4)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                radius: 30,
                backgroundColor: Colors.white.withValues(alpha: 0.18),
                backgroundImage: profile.avatarUrl.isEmpty
                    ? null
                    : NetworkImage(profile.avatarUrl),
                child: profile.avatarUrl.isEmpty
                    ? Text(
                        initials,
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          color: Colors.white,
                        ),
                      )
                    : null,
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      snapshot.displayName,
                      style: Theme.of(context).textTheme.headlineSmall
                          ?.copyWith(color: Colors.white),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      profile.headline.isEmpty
                          ? snapshot.roleLabel
                          : profile.headline,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Colors.white.withValues(alpha: 0.84),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _HeroChip(label: snapshot.roleLabel),
              _HeroChip(label: '${snapshot.completionPercent}% complete'),
              _HeroChip(
                label: profile.location.isEmpty
                    ? 'Location pending'
                    : profile.location,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _HeroChip extends StatelessWidget {
  const _HeroChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelLarge?.copyWith(
          color: Colors.white,
        ),
      ),
    );
  }
}

class _MetricsGrid extends StatelessWidget {
  const _MetricsGrid({required this.snapshot});

  final MobileProfileSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    final items = [
      ('Trust', snapshot.trustScore.toString()),
      ('Reviews', snapshot.reviewCount.toString()),
      ('Services', snapshot.serviceCount.toString()),
      ('Products', snapshot.productCount.toString()),
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        const gap = 10.0;
        final tileWidth = (constraints.maxWidth - gap) / 2;

        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: items
              .map(
                (item) => SizedBox(
                  width: tileWidth,
                  child: SectionCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.$1,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          item.$2,
                          style: Theme.of(context).textTheme.headlineMedium,
                        ),
                      ],
                    ),
                  ),
                ),
              )
              .toList(),
        );
      },
    );
  }
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({required this.snapshot});

  final MobileProfileSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    final profile = snapshot.profile;

    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Profile summary', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 10),
          Text(
            profile.bio.isEmpty
                ? 'Your profile summary is still blank. Fill this in next so nearby buyers and providers know what makes you trustworthy.'
                : profile.bio,
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 14),
          _InfoRow(
            label: 'Availability',
            value: _humanize(profile.availability),
          ),
          _InfoRow(
            label: 'Verification',
            value: _humanize(profile.verificationLevel),
          ),
          _InfoRow(
            label: 'Phone',
            value: profile.phone.isEmpty ? 'Not added yet' : profile.phone,
          ),
          _InfoRow(
            label: 'Website',
            value: profile.website.isEmpty ? 'Not added yet' : profile.website,
          ),
          _InfoRow(
            label: 'Public profile',
            value: snapshot.publicPath.isEmpty
                ? 'Not ready yet'
                : snapshot.publicPath,
          ),
        ],
      ),
    );
  }
}

class _CollectionCard<T> extends StatelessWidget {
  const _CollectionCard({
    required this.title,
    required this.subtitle,
    required this.emptyState,
    required this.items,
    required this.itemBuilder,
  });

  final String title;
  final String subtitle;
  final String emptyState;
  final List<T> items;
  final Widget Function(T item) itemBuilder;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 14),
          if (items.isEmpty)
            Text(emptyState, style: Theme.of(context).textTheme.bodyMedium)
          else
            ...items.map(
              (item) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: itemBuilder(item),
              ),
            ),
        ],
      ),
    );
  }
}

class _PreviewRow extends StatelessWidget {
  const _PreviewRow({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 6),
          Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
        ],
      ),
    );
  }
}

class _SignInMethodsCard extends StatelessWidget {
  const _SignInMethodsCard({
    required this.linkedProviders,
    required this.hasGoogle,
    required this.googleSubmitting,
    required this.googleStatus,
    required this.googleError,
    required this.onLinkGoogle,
  });

  final List<String> linkedProviders;
  final bool hasGoogle;
  final bool googleSubmitting;
  final String? googleStatus;
  final String? googleError;
  final VoidCallback onLinkGoogle;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Sign-in methods',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 10),
          Text(
            'This is how existing web identity stays attached to the same data on mobile.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: linkedProviders
                .map((provider) => Chip(label: Text(_providerLabel(provider))))
                .toList(),
          ),
          const SizedBox(height: 16),
          if (!hasGoogle)
            OutlinedButton.icon(
              onPressed: googleSubmitting ? null : onLinkGoogle,
              icon: googleSubmitting
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.open_in_new_rounded),
              label: Text(
                googleSubmitting
                    ? 'Opening Google...'
                    : 'Link Google to this account',
              ),
            )
          else
            Text(
              'Google is already linked to this account.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          _ProfileMessage(
            successMessage: googleStatus,
            errorMessage: googleError,
          ),
        ],
      ),
    );
  }
}

class _PasswordCard extends StatelessWidget {
  const _PasswordCard({
    required this.formKey,
    required this.passwordController,
    required this.confirmPasswordController,
    required this.passwordSubmitting,
    required this.passwordStatus,
    required this.passwordError,
    required this.obscurePassword,
    required this.obscureConfirmPassword,
    required this.onTogglePassword,
    required this.onToggleConfirmPassword,
    required this.onSubmit,
    required this.validatePassword,
    required this.validateConfirmation,
  });

  final GlobalKey<FormState> formKey;
  final TextEditingController passwordController;
  final TextEditingController confirmPasswordController;
  final bool passwordSubmitting;
  final String? passwordStatus;
  final String? passwordError;
  final bool obscurePassword;
  final bool obscureConfirmPassword;
  final VoidCallback onTogglePassword;
  final VoidCallback onToggleConfirmPassword;
  final VoidCallback onSubmit;
  final String? Function(String?) validatePassword;
  final String? Function(String?) validateConfirmation;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Form(
        key: formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Create or update password',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 10),
            Text(
              'Best after your first email-code or magic-link login. It keeps the same ServiQ account history and makes repeat sign-ins faster.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: passwordController,
              obscureText: obscurePassword,
              textInputAction: TextInputAction.next,
              autofillHints: const [AutofillHints.newPassword],
              decoration: InputDecoration(
                labelText: 'New password',
                suffixIcon: IconButton(
                  onPressed: onTogglePassword,
                  icon: Icon(
                    obscurePassword
                        ? Icons.visibility_off_rounded
                        : Icons.visibility_rounded,
                  ),
                ),
              ),
              validator: validatePassword,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: confirmPasswordController,
              obscureText: obscureConfirmPassword,
              textInputAction: TextInputAction.done,
              autofillHints: const [AutofillHints.newPassword],
              decoration: InputDecoration(
                labelText: 'Confirm password',
                suffixIcon: IconButton(
                  onPressed: onToggleConfirmPassword,
                  icon: Icon(
                    obscureConfirmPassword
                        ? Icons.visibility_off_rounded
                        : Icons.visibility_rounded,
                  ),
                ),
              ),
              validator: validateConfirmation,
              onFieldSubmitted: (_) => onSubmit(),
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: passwordSubmitting ? null : onSubmit,
              icon: passwordSubmitting
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.lock_reset_rounded),
              label: Text(passwordSubmitting ? 'Saving...' : 'Save password'),
            ),
            _ProfileMessage(
              successMessage: passwordStatus,
              errorMessage: passwordError,
            ),
          ],
        ),
      ),
    );
  }
}

class _AccountCard extends StatelessWidget {
  const _AccountCard({
    required this.snapshot,
    required this.user,
    required this.onSignOut,
  });

  final MobileProfileSnapshot snapshot;
  final User? user;
  final VoidCallback onSignOut;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Account', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          _InfoRow(label: 'User ID', value: snapshot.userId),
          _InfoRow(
            label: 'Email',
            value: user?.email ?? snapshot.email,
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: onSignOut,
            icon: const Icon(Icons.logout_rounded),
            label: const Text('Sign out'),
          ),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
              color: const Color(0xFF64748B),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _ProfileLoadingState extends StatelessWidget {
  const _ProfileLoadingState();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(
        3,
        (index) => const Padding(
          padding: EdgeInsets.only(bottom: 14),
          child: SectionCard(
            child: SizedBox(
              height: 180,
              child: Center(child: CircularProgressIndicator()),
            ),
          ),
        ),
      ),
    );
  }
}

class _ProfileErrorState extends StatelessWidget {
  const _ProfileErrorState({required this.error});

  final Object error;

  @override
  Widget build(BuildContext context) {
    final message = switch (error) {
      ApiException apiError => apiError.message,
      _ => error.toString(),
    };

    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Unable to load your profile bundle',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 10),
          Text(message, style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 10),
          Text(
            'Pull to refresh after the session and API base URL are ready.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}

class _ProfileMessage extends StatelessWidget {
  const _ProfileMessage({this.successMessage, this.errorMessage});

  final String? successMessage;
  final String? errorMessage;

  @override
  Widget build(BuildContext context) {
    if (successMessage == null && errorMessage == null) {
      return const SizedBox.shrink();
    }

    final theme = Theme.of(context);
    final showingError = errorMessage != null;

    return Padding(
      padding: const EdgeInsets.only(top: 14),
      child: Text(
        errorMessage ?? successMessage ?? '',
        style: theme.textTheme.bodyMedium?.copyWith(
          color: showingError
              ? theme.colorScheme.error
              : const Color(0xFF0F766E),
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

String _availabilitySummary(MobileProfileAvailabilityItem entry) {
  final parts = <String>[
    _humanize(entry.availability),
    if (entry.daysOfWeek.isNotEmpty) entry.daysOfWeek.join(', '),
    if (entry.startTime.isNotEmpty && entry.endTime.isNotEmpty)
      '${entry.startTime} - ${entry.endTime}',
  ];

  return parts.join(' / ');
}

String _paymentSummary(MobileProfilePaymentMethod entry) {
  final parts = <String>[
    if (entry.providerName.isNotEmpty) entry.providerName,
    if (entry.accountLabel.isNotEmpty) entry.accountLabel,
    if (entry.isDefault) 'Default',
    if (entry.isVerified) 'Verified',
  ];

  return parts.isEmpty ? 'Configured' : parts.join(' / ');
}

String _formatPrice(double value) {
  if (value <= 0) {
    return 'Price on request';
  }

  return 'INR ${value.round()}';
}

String _avatarFallback(String value) {
  final words = value
      .split(' ')
      .map((part) => part.trim())
      .where((part) => part.isNotEmpty)
      .toList();
  if (words.isEmpty) {
    return 'S';
  }

  if (words.length == 1) {
    return words.first.characters.first.toUpperCase();
  }

  return '${words.first.characters.first}${words[1].characters.first}'
      .toUpperCase();
}

String _humanize(String raw) {
  final normalized = raw.trim().toLowerCase();
  if (normalized.isEmpty) {
    return '';
  }

  return normalized
      .split('_')
      .map(
        (segment) => segment.isEmpty
            ? segment
            : '${segment[0].toUpperCase()}${segment.substring(1)}',
      )
      .join(' ');
}

String _providerLabel(String provider) {
  return switch (provider) {
    'email' => 'Email',
    'google' => 'Google',
    _ => provider[0].toUpperCase() + provider.substring(1),
  };
}
