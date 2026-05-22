import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/error/app_error_mapper.dart';
import '../../../core/auth/auth_state_controller.dart';
import '../../../core/auth/mobile_auth_service.dart';
import '../../../core/constants/app_routes.dart';
import '../../../core/design_system/design_system.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/section_card.dart';
import '../../../shared/components/loading_shimmer.dart';
import '../../../shared/components/metric_tile.dart';
import '../../../shared/components/premium_primitives.dart';
import '../../../shared/components/trust_badge.dart';
import '../data/profile_repository.dart';
import '../domain/mobile_profile_snapshot.dart';

enum _ProfileSection {
  viewProfile,
  editProfile,
  businessSetup,
  listings,
  trust,
  settings;

  String get label {
    switch (this) {
      case _ProfileSection.viewProfile:
        return 'View Profile';
      case _ProfileSection.editProfile:
        return 'Edit Profile';
      case _ProfileSection.businessSetup:
        return 'Business Setup';
      case _ProfileSection.listings:
        return 'Listings';
      case _ProfileSection.trust:
        return 'Trust';
      case _ProfileSection.settings:
        return 'Settings';
    }
  }

  IconData get icon {
    return switch (this) {
      _ProfileSection.viewProfile => Icons.badge_outlined,
      _ProfileSection.editProfile => Icons.edit_outlined,
      _ProfileSection.businessSetup => Icons.auto_awesome_rounded,
      _ProfileSection.listings => Icons.inventory_2_outlined,
      _ProfileSection.trust => Icons.verified_user_outlined,
      _ProfileSection.settings => Icons.tune_rounded,
    };
  }
}

class ProfilePage extends ConsumerStatefulWidget {
  const ProfilePage({
    super.key,
    this.title = 'You',
    this.initialSection = 'hub',
    this.showCommandHub = true,
    this.snapshotOverride,
  });

  final String title;
  final String initialSection;
  final bool showCommandHub;
  final AsyncValue<MobileProfileSnapshot>? snapshotOverride;

  @override
  ConsumerState<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends ConsumerState<ProfilePage> {
  final _passwordFormKey = GlobalKey<FormState>();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  late _ProfileSection _selectedSection;
  bool _passwordSubmitting = false;
  String? _passwordStatus;
  String? _passwordError;
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;

  bool _googleSubmitting = false;
  String? _googleStatus;
  String? _googleError;

  @override
  void initState() {
    super.initState();
    _selectedSection = _sectionFromName(widget.initialSection);
  }

  @override
  void didUpdateWidget(covariant ProfilePage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialSection != widget.initialSection) {
      _selectedSection = _sectionFromName(widget.initialSection);
    }
  }

  @override
  void dispose() {
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  _ProfileSection _sectionFromName(String name) {
    return switch (name) {
      'editProfile' || 'edit' => _ProfileSection.editProfile,
      'businessSetup' || 'business' => _ProfileSection.businessSetup,
      'listings' => _ProfileSection.listings,
      'trust' => _ProfileSection.trust,
      'settings' => _ProfileSection.settings,
      _ => _ProfileSection.viewProfile,
    };
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
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
            children: [
              ServiqAsyncBody<MobileProfileSnapshot>(
                value: snapshot,
                errorTitle: 'Unable to load your profile bundle',
                errorMessageFor: (error, _) {
                  if (error is ApiException) {
                    return error.message;
                  }
                  return AppErrorMapper.toMessage(error);
                },
                onRetry: () {
                  _refresh();
                },
                loadingBuilder: () => const _ProfileLoadingState(),
                data: (data) {
                  if (widget.showCommandHub) {
                    return _ProfileCommandHub(
                      snapshot: data,
                      user: user,
                      onSignOut: () async {
                        await auth.signOut();
                      },
                    );
                  }

                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _ProfileHero(snapshot: data),
                      const SizedBox(height: 16),
                      _buildSection(
                        context,
                        snapshot: data,
                        user: user,
                        onSignOut: () async {
                          await auth.signOut();
                        },
                      ),
                    ],
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSection(
    BuildContext context, {
    required MobileProfileSnapshot snapshot,
    required User? user,
    required VoidCallback onSignOut,
  }) {
    switch (_selectedSection) {
      case _ProfileSection.viewProfile:
        return _ViewProfileSection(snapshot: snapshot);
      case _ProfileSection.editProfile:
        return _EditProfileSection(snapshot: snapshot);
      case _ProfileSection.businessSetup:
        return _BusinessSetupSection(snapshot: snapshot);
      case _ProfileSection.listings:
        return _ListingsSection(snapshot: snapshot);
      case _ProfileSection.trust:
        return _TrustSection(
          snapshot: snapshot,
          googleSubmitting: _googleSubmitting,
          googleStatus: _googleStatus,
          googleError: _googleError,
          onLinkGoogle: _linkGoogle,
          formKey: _passwordFormKey,
          passwordController: _passwordController,
          confirmPasswordController: _confirmPasswordController,
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
              _obscureConfirmPassword = !_obscureConfirmPassword;
            });
          },
          onSubmit: _updatePassword,
          validatePassword: _validatePassword,
          validateConfirmation: _validatePasswordConfirmation,
        );
      case _ProfileSection.settings:
        return _SettingsSection(
          snapshot: snapshot,
          user: user,
          onSignOut: onSignOut,
        );
    }
  }
}

class _ProfileCommandHub extends StatelessWidget {
  const _ProfileCommandHub({
    required this.snapshot,
    required this.user,
    required this.onSignOut,
  });

  final MobileProfileSnapshot snapshot;
  final User? user;
  final VoidCallback onSignOut;

  @override
  Widget build(BuildContext context) {
    final isProvider = snapshot.roleFamily == 'provider';
    final displayName = snapshot.profile.fullName.isEmpty
        ? snapshot.displayName
        : snapshot.profile.fullName;
    final offerCount = snapshot.serviceCount + snapshot.productCount;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _ProfileHero(snapshot: snapshot),
        const SizedBox(height: 16),
        _ProfileTopActions(snapshot: snapshot),
        const SizedBox(height: 16),
        _HubSummaryGrid(snapshot: snapshot),
        const SizedBox(height: 16),
        _HubSectionTitle(
          title: isProvider ? 'Business cockpit' : 'Account cockpit',
          message: isProvider
              ? 'Manage setup, listings, leads, trust, orders, and profile quality from tappable pages.'
              : 'Move from profile basics into local discovery, orders, saved items, and account trust.',
        ),
        const SizedBox(height: 12),
        _HubTileGrid(
          tiles: [
            _HubTileData(
              key: 'profile-tile-business-control',
              icon: Icons.auto_awesome_rounded,
              title: 'Business Control',
              subtitle: isProvider
                  ? 'Setup, leads, listings, quote readiness'
                  : 'Start provider setup when you are ready',
              route: AppRoutes.profile,
              emphasized: isProvider,
            ),
            _HubTileData(
              key: 'profile-tile-public-profile',
              icon: Icons.visibility_outlined,
              title: 'Public Profile',
              subtitle: 'Preview what nearby people trust first',
              route: AppRoutes.profile,
            ),
            _HubTileData(
              key: 'profile-tile-edit-profile',
              icon: Icons.edit_outlined,
              title: 'Edit Profile',
              subtitle: 'Name, area, bio, contact, availability',
              route: AppRoutes.profile,
            ),
            _HubTileData(
              key: 'profile-tile-listings',
              icon: Icons.inventory_2_outlined,
              title: 'Listings',
              subtitle: '$offerCount services and products synced',
              route: AppRoutes.providerListings,
            ),
            _HubTileData(
              key: 'profile-tile-inbox',
              icon: Icons.chat_bubble_outline_rounded,
              title: 'Leads and Inbox',
              subtitle: 'Replies, quote follow-up, active threads',
              route: AppRoutes.chat,
            ),
            _HubTileData(
              key: 'profile-tile-orders',
              icon: Icons.receipt_long_outlined,
              title: 'Payments and Orders',
              subtitle: 'Checkout history and fulfillment status',
              route: AppRoutes.orders,
            ),
            _HubTileData(
              key: 'profile-tile-trust',
              icon: Icons.verified_user_outlined,
              title: 'Trust and Verification',
              subtitle:
                  '${snapshot.trustScore} trust score / ${snapshot.reviewCount} reviews',
              route: AppRoutes.profileTrust,
            ),
            _HubTileData(
              key: 'profile-tile-saved',
              icon: Icons.bookmark_border_rounded,
              title: 'Saved',
              subtitle: 'Saved providers, listings, and feed cards',
              route: AppRoutes.saved,
            ),
            _HubTileData(
              key: 'profile-tile-notifications',
              icon: Icons.notifications_none_rounded,
              title: 'Notifications',
              subtitle: 'Messages, tasks, orders, and system alerts',
              route: AppRoutes.notifications,
            ),
            _HubTileData(
              key: 'profile-tile-settings',
              icon: Icons.tune_rounded,
              title: 'Settings',
              subtitle: 'Sign-in, location, payout, and account',
              route: AppRoutes.profile,
            ),
          ],
        ),
        const SizedBox(height: 16),
        _LaunchReadinessCard(snapshot: snapshot),
        const SizedBox(height: 16),
        SectionCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Account', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 8),
              Text(
                displayName.isEmpty
                    ? 'Your ServiQ account controls profile, work, messages, and checkout history.'
                    : '$displayName controls profile, work, messages, and checkout history here.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 12),
              _InfoRow(label: 'Email', value: user?.email ?? snapshot.email),
              OutlinedButton.icon(
                onPressed: onSignOut,
                icon: const Icon(Icons.logout_rounded),
                label: const Text('Sign out'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ProfileTopActions extends StatelessWidget {
  const _ProfileTopActions({required this.snapshot});

  final MobileProfileSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    final isProvider = snapshot.roleFamily == 'provider';
    final actions = [
      (
        isProvider ? 'Business AI' : 'Business',
        Icons.auto_awesome_rounded,
        AppRoutes.profile,
      ),
      ('Edit Profile', Icons.edit_outlined, AppRoutes.profile),
      ('Inbox', Icons.chat_bubble_outline_rounded, AppRoutes.chat),
      ('Orders', Icons.receipt_long_outlined, AppRoutes.orders),
    ];

    return Row(
      children: [
        for (var index = 0; index < actions.length; index += 1) ...[
          Expanded(
            child: _TopActionButton(
              label: actions[index].$1,
              icon: actions[index].$2,
              onTap: () => context.push(actions[index].$3),
            ),
          ),
          if (index != actions.length - 1) const SizedBox(width: 8),
        ],
      ],
    );
  }
}

class _TopActionButton extends StatelessWidget {
  const _TopActionButton({
    required this.label,
    required this.icon,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(AppRadii.md),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.md),
        onTap: onTap,
        child: Container(
          constraints: const BoxConstraints(minHeight: 72),
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadii.md),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: AppColors.primary, size: 20),
              const SizedBox(height: 6),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.labelMedium,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HubSummaryGrid extends StatelessWidget {
  const _HubSummaryGrid({required this.snapshot});

  final MobileProfileSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    final offerCount = snapshot.serviceCount + snapshot.productCount;
    return LayoutBuilder(
      builder: (context, constraints) {
        const gap = 10.0;
        final tileWidth = constraints.maxWidth < 360
            ? constraints.maxWidth
            : (constraints.maxWidth - gap) / 2;
        final tiles = [
          (
            'Profile',
            '${snapshot.completionPercent}%',
            'Completion',
            Icons.person_outline_rounded,
          ),
          (
            'Live offers',
            offerCount.toString(),
            'Services and products',
            Icons.storefront_outlined,
          ),
          (
            'Trust',
            snapshot.trustScore.toString(),
            '${snapshot.reviewCount} reviews',
            Icons.verified_outlined,
          ),
          (
            'Availability',
            _humanize(snapshot.profile.availability),
            'Current mode',
            Icons.event_available_outlined,
          ),
        ];

        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: [
            for (final tile in tiles)
              SizedBox(
                width: tileWidth,
                child: MetricTile(
                  label: tile.$1,
                  value: tile.$2,
                  caption: tile.$3,
                  icon: tile.$4,
                ),
              ),
          ],
        );
      },
    );
  }
}

class _HubSectionTitle extends StatelessWidget {
  const _HubSectionTitle({required this.title, required this.message});

  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 6),
        Text(message, style: Theme.of(context).textTheme.bodyMedium),
      ],
    );
  }
}

class _HubTileGrid extends StatelessWidget {
  const _HubTileGrid({required this.tiles});

  final List<_HubTileData> tiles;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (final tile in tiles)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _HubTile(data: tile),
          ),
      ],
    );
  }
}

class _HubTileData {
  const _HubTileData({
    required this.key,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.route,
    this.emphasized = false,
  });

  final String key;
  final IconData icon;
  final String title;
  final String subtitle;
  final String route;
  final bool emphasized;
}

class _HubTile extends StatelessWidget {
  const _HubTile({required this.data});

  final _HubTileData data;

  @override
  Widget build(BuildContext context) {
    final background = data.emphasized
        ? AppColors.primarySoft
        : AppColors.surface;
    final iconColor = data.emphasized ? AppColors.primary : AppColors.inkSubtle;

    return Material(
      key: ValueKey(data.key),
      color: background,
      borderRadius: BorderRadius.circular(AppRadii.md),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.md),
        onTap: () => context.push(data.route),
        child: Container(
          constraints: const BoxConstraints(minHeight: 82),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            border: Border.all(
              color: data.emphasized ? AppColors.primary : AppColors.border,
            ),
            borderRadius: BorderRadius.circular(AppRadii.md),
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(AppRadii.sm),
                ),
                child: Icon(data.icon, color: iconColor),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      data.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      data.subtitle,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              const Icon(
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

class _ViewProfileSection extends StatelessWidget {
  const _ViewProfileSection({required this.snapshot});

  final MobileProfileSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    return Column(
      key: const ValueKey('profile-view-profile'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _PublicProfilePreviewCard(snapshot: snapshot, prominent: true),
        const SizedBox(height: 16),
        _LaunchReadinessCard(snapshot: snapshot),
        const SizedBox(height: 16),
        _MetricsGrid(snapshot: snapshot),
        const SizedBox(height: 16),
        _CompletionCard(snapshot: snapshot),
        const SizedBox(height: 14),
        _ProofAndReviewsCard(snapshot: snapshot),
      ],
    );
  }
}

class _EditProfileSection extends ConsumerStatefulWidget {
  const _EditProfileSection({required this.snapshot});

  final MobileProfileSnapshot snapshot;

  @override
  ConsumerState<_EditProfileSection> createState() =>
      _EditProfileSectionState();
}

class _EditProfileSectionState extends ConsumerState<_EditProfileSection> {
  final _formKey = GlobalKey<FormState>();
  final _fullNameController = TextEditingController();
  final _locationController = TextEditingController();
  final _bioController = TextEditingController();
  final _phoneController = TextEditingController();
  final _websiteController = TextEditingController();
  final _avatarUrlController = TextEditingController();

  String _availability = 'available';
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _seedFields(widget.snapshot);
  }

  @override
  void didUpdateWidget(covariant _EditProfileSection oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.snapshot != widget.snapshot && !_saving) {
      _seedFields(widget.snapshot);
    }
  }

  @override
  void dispose() {
    _fullNameController.dispose();
    _locationController.dispose();
    _bioController.dispose();
    _phoneController.dispose();
    _websiteController.dispose();
    _avatarUrlController.dispose();
    super.dispose();
  }

  void _seedFields(MobileProfileSnapshot snapshot) {
    final profile = snapshot.profile;
    _fullNameController.text = profile.fullName.isNotEmpty
        ? profile.fullName
        : snapshot.displayName;
    _locationController.text = profile.location;
    _bioController.text = profile.bio;
    _phoneController.text = profile.phone;
    _websiteController.text = profile.website;
    _avatarUrlController.text = profile.avatarUrl;
    final availability = profile.availability.trim().toLowerCase();
    _availability = availability == 'busy' || availability == 'offline'
        ? availability
        : 'available';
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate() || _saving) {
      return;
    }

    FocusScope.of(context).unfocus();
    setState(() => _saving = true);
    try {
      await ref
          .read(profileRepositoryProvider)
          .saveProfileFields(
            widget.snapshot,
            fullName: _fullNameController.text.trim(),
            location: _locationController.text.trim(),
            bio: _bioController.text.trim(),
            phone: _phoneController.text.trim(),
            website: _websiteController.text.trim(),
            avatarUrl: _avatarUrlController.text.trim(),
            availability: _availability,
          );
      ref.invalidate(profileSnapshotProvider);
      if (!mounted) {
        return;
      }
      ServiqToast.show(
        context,
        message: 'Profile updated.',
        tone: ServiqToastTone.success,
      );
    } catch (error) {
      if (!mounted) {
        return;
      }
      ServiqToast.show(
        context,
        message: AppErrorMapper.toMessage(error),
        tone: ServiqToastTone.danger,
      );
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }

  String? _validateName(String? value) {
    final text = value?.trim() ?? '';
    if (text.isNotEmpty && text.length < 2) {
      return 'Use at least 2 characters.';
    }
    return null;
  }

  String? _validateLocation(String? value) {
    final text = value?.trim() ?? '';
    if (text.isNotEmpty && text.length < 2) {
      return 'Location is too short.';
    }
    if (RegExp(r'^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$').hasMatch(text)) {
      return 'Use a readable area, not raw GPS coordinates.';
    }
    return null;
  }

  String? _validatePhone(String? value) {
    final text = value?.trim() ?? '';
    if (text.isEmpty) {
      return null;
    }
    final digits = text.replaceAll(RegExp(r'\D'), '');
    if (digits.length != 10) {
      return 'Enter a 10-digit mobile number.';
    }
    return null;
  }

  String? _validateUrl(String? value) {
    final text = value?.trim() ?? '';
    if (text.isEmpty) {
      return null;
    }
    final uri = Uri.tryParse(text);
    if (uri == null || !uri.hasScheme || uri.host.isEmpty) {
      return 'Enter a valid URL.';
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      key: const ValueKey('profile-edit-profile'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _SectionIntro(
          title: 'Edit Profile',
          message:
              'Update the public details people see before they message, hire, or buy from you.',
        ),
        const SizedBox(height: 14),
        SectionCard(
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Public details',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 12),
                _ProfileTextField(
                  controller: _fullNameController,
                  label: 'Public name',
                  icon: Icons.person_outline_rounded,
                  validator: _validateName,
                ),
                const SizedBox(height: 12),
                _ProfileTextField(
                  controller: _locationController,
                  label: 'Area or service location',
                  icon: Icons.location_on_outlined,
                  validator: _validateLocation,
                ),
                const SizedBox(height: 12),
                _ProfileTextField(
                  controller: _bioController,
                  label: 'Bio',
                  icon: Icons.notes_outlined,
                  maxLines: 4,
                ),
                const SizedBox(height: 12),
                _ProfileTextField(
                  controller: _phoneController,
                  label: 'Phone',
                  icon: Icons.phone_outlined,
                  keyboardType: TextInputType.phone,
                  validator: _validatePhone,
                ),
                const SizedBox(height: 12),
                _ProfileTextField(
                  controller: _websiteController,
                  label: 'Website',
                  icon: Icons.language_rounded,
                  keyboardType: TextInputType.url,
                  validator: _validateUrl,
                ),
                const SizedBox(height: 12),
                _ProfileTextField(
                  controller: _avatarUrlController,
                  label: 'Avatar image URL',
                  icon: Icons.image_outlined,
                  keyboardType: TextInputType.url,
                  validator: _validateUrl,
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: _availability,
                  decoration: const InputDecoration(
                    labelText: 'Availability',
                    prefixIcon: Icon(Icons.event_available_outlined),
                  ),
                  items: const [
                    DropdownMenuItem(
                      value: 'available',
                      child: Text('Available'),
                    ),
                    DropdownMenuItem(value: 'busy', child: Text('Busy')),
                    DropdownMenuItem(value: 'offline', child: Text('Offline')),
                  ],
                  onChanged: _saving
                      ? null
                      : (value) {
                          if (value == null) {
                            return;
                          }
                          setState(() => _availability = value);
                        },
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: _saving ? null : _save,
                    icon: _saving
                        ? const SizedBox.square(
                            dimension: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.save_outlined),
                    label: Text(_saving ? 'Saving...' : 'Save profile'),
                  ),
                ),
                const SizedBox(height: 8),
                _ActionRow(
                  icon: Icons.auto_awesome_rounded,
                  label: 'Open Business AI Launchpad',
                  onTap: () => context.push(AppRoutes.providerLaunchpad),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 14),
        _EditableProfileCard(snapshot: widget.snapshot),
      ],
    );
  }
}

class _ProfileTextField extends StatelessWidget {
  const _ProfileTextField({
    required this.controller,
    required this.label,
    required this.icon,
    this.maxLines = 1,
    this.keyboardType,
    this.validator,
  });

  final TextEditingController controller;
  final String label;
  final IconData icon;
  final int maxLines;
  final TextInputType? keyboardType;
  final FormFieldValidator<String>? validator;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      maxLines: maxLines,
      keyboardType: keyboardType,
      validator: validator,
      decoration: InputDecoration(labelText: label, prefixIcon: Icon(icon)),
    );
  }
}

class _BusinessSetupSection extends StatelessWidget {
  const _BusinessSetupSection({required this.snapshot});

  final MobileProfileSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    return Column(
      key: const ValueKey('profile-business-setup'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _BusinessSetupReadinessCard(snapshot: snapshot),
        const SizedBox(height: 14),
        _LaunchpadConnectionCard(snapshot: snapshot),
        const SizedBox(height: 14),
        const _MarketplaceActionsCard(),
      ],
    );
  }
}

class _ListingsSection extends StatelessWidget {
  const _ListingsSection({required this.snapshot});

  final MobileProfileSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    return Column(
      key: const ValueKey('profile-listings'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _ListingsSummaryCard(snapshot: snapshot),
        const SizedBox(height: 14),
        _SectionIntro(
          title: 'Published listings',
          message:
              'Services and products published from the web profile or Business AI setup are visible together here.',
        ),
        const SizedBox(height: 14),
        _CollectionCard<MobileProfileService>(
          title: 'Services',
          subtitle:
              '${snapshot.serviceCount} live services from the web profile now available on mobile.',
          emptyState:
              'No services added yet. The provider storefront is ready for the next listing.',
          items: snapshot.services.take(4).toList(),
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
              '${snapshot.productCount} product listings synced into the mobile account view.',
          emptyState:
              'No products yet. Once the web catalog grows, it will appear here too.',
          items: snapshot.products.take(4).toList(),
          itemBuilder: (product) => _PreviewRow(
            title: product.title,
            subtitle:
                '${_formatPrice(product.price)} / ${product.stock} in stock',
          ),
        ),
        const SizedBox(height: 14),
        _CollectionCard<MobileProfileAvailabilityItem>(
          title: 'Availability',
          subtitle:
              '${snapshot.availabilityCount} schedule blocks synced for faster local matching.',
          emptyState:
              'No detailed schedule yet. The profile still shows your overall availability.',
          items: snapshot.availability.take(4).toList(),
          itemBuilder: (entry) => _PreviewRow(
            title: entry.label,
            subtitle: _availabilitySummary(entry),
          ),
        ),
      ],
    );
  }
}

class _PublicProfilePreviewCard extends StatelessWidget {
  const _PublicProfilePreviewCard({
    required this.snapshot,
    this.prominent = false,
  });

  final MobileProfileSnapshot snapshot;
  final bool prominent;

  @override
  Widget build(BuildContext context) {
    final profile = snapshot.profile;
    final displayName = profile.fullName.isEmpty
        ? snapshot.displayName
        : profile.fullName;
    final headline = profile.headline.isEmpty
        ? snapshot.roleLabel
        : profile.headline;
    final firstService = snapshot.services.isEmpty
        ? null
        : snapshot.services.first.title;
    final firstProduct = snapshot.products.isEmpty
        ? null
        : snapshot.products.first.title;
    final previewOffer = firstService ?? firstProduct ?? 'Listings pending';

    return PremiumSurface(
      key: const ValueKey('profile-public-preview'),
      padding: EdgeInsets.all(prominent ? 18 : 16),
      backgroundColor: AppColors.surface,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: const [
              PremiumPill(
                label: 'Public profile preview',
                icon: Icons.visibility_outlined,
                backgroundColor: AppColors.primarySoft,
                foregroundColor: AppColors.primary,
              ),
              PremiumPill(
                label: 'Mobile-ready',
                icon: Icons.phone_iphone_rounded,
                backgroundColor: AppColors.accentSoft,
                foregroundColor: AppColors.accent,
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                radius: prominent ? 34 : 28,
                backgroundColor: AppColors.primarySoft,
                foregroundImage: profile.avatarUrl.isEmpty
                    ? null
                    : NetworkImage(profile.avatarUrl),
                onForegroundImageError: profile.avatarUrl.isEmpty
                    ? null
                    : (_, _) {},
                child: Text(
                  _avatarFallback(displayName),
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      displayName,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 5),
                    Text(
                      headline,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: AppColors.inkSubtle,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            profile.bio.isEmpty
                ? 'Profile copy is pending. Launchpad can draft a clearer public summary next.'
                : profile.bio,
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              TrustBadge(
                label: _humanize(profile.verificationLevel),
                icon: Icons.verified_user_outlined,
                backgroundColor: AppColors.successSoft,
                foregroundColor: AppColors.success,
              ),
              TrustBadge(
                label: profile.location.isEmpty
                    ? 'Location private'
                    : profile.location,
                icon: Icons.location_on_outlined,
                backgroundColor: AppColors.surfaceMuted,
                foregroundColor: AppColors.ink,
              ),
              TrustBadge(
                label: previewOffer,
                icon: Icons.storefront_outlined,
                backgroundColor: AppColors.warningSoft,
                foregroundColor: AppColors.warning,
              ),
            ],
          ),
          const SizedBox(height: 14),
          _InfoRow(
            label: 'Public path',
            value: snapshot.publicPath.isEmpty
                ? 'Created when profile is published'
                : snapshot.publicPath,
          ),
        ],
      ),
    );
  }
}

class _EditableProfileCard extends ConsumerWidget {
  const _EditableProfileCard({required this.snapshot});

  final MobileProfileSnapshot snapshot;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = snapshot.profile;
    final rows = [
      (
        'Public name',
        profile.fullName.isNotEmpty || snapshot.displayName.isNotEmpty,
        profile.fullName.isEmpty ? snapshot.displayName : profile.fullName,
      ),
      ('Headline', profile.headline.isNotEmpty, profile.headline),
      ('Bio', profile.bio.isNotEmpty, profile.bio),
      ('Location', profile.location.isNotEmpty, profile.location),
      ('Phone', profile.phone.isNotEmpty, profile.phone),
      ('Website', profile.website.isNotEmpty, profile.website),
    ];

    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Profile fields', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          Text(
            'Use this as the owner-side checklist before editing copy in Launchpad or web profile tools.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 14),
          for (final row in rows)
            _ReadinessRow(
              label: row.$1,
              detail: row.$2 ? row.$3 : 'Missing',
              done: row.$2,
            ),
          const SizedBox(height: 14),
          FilledButton.tonal(
            onPressed: () async {
              try {
                await ref
                    .read(profileRepositoryProvider)
                    .saveProfileFromSnapshot(snapshot);
                ref.invalidate(profileSnapshotProvider);
                if (!context.mounted) {
                  return;
                }
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Profile saved to server.')),
                );
              } catch (error) {
                if (!context.mounted) {
                  return;
                }
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text(AppErrorMapper.toMessage(error))),
                );
              }
            },
            child: const Text('Sync fields to server'),
          ),
          const SizedBox(height: 10),
          _ActionRow(
            icon: Icons.auto_awesome_rounded,
            label: 'Open Business AI Launchpad',
            onTap: () => context.push(AppRoutes.providerLaunchpad),
          ),
        ],
      ),
    );
  }
}

class _BusinessSetupReadinessCard extends StatelessWidget {
  const _BusinessSetupReadinessCard({required this.snapshot});

  final MobileProfileSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    final profile = snapshot.profile;
    final hasListings = snapshot.serviceCount + snapshot.productCount > 0;
    final rows = [
      (
        'Business identity',
        profile.fullName.isNotEmpty && profile.headline.isNotEmpty,
        profile.headline.isEmpty
            ? 'Name and headline need review'
            : profile.headline,
      ),
      (
        'Service area',
        profile.location.isNotEmpty,
        profile.location.isEmpty ? 'Add a public location' : profile.location,
      ),
      (
        'Offer catalog',
        hasListings,
        hasListings
            ? '${snapshot.serviceCount} services / ${snapshot.productCount} products'
            : 'Add at least one service or product',
      ),
      (
        'Contact readiness',
        profile.phone.isNotEmpty || profile.website.isNotEmpty,
        profile.phone.isNotEmpty
            ? 'Phone available'
            : profile.website.isNotEmpty
            ? 'Website available'
            : 'Add phone or website',
      ),
    ];

    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Business Setup', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          Text(
            'Launchpad publishes into this profile, so readiness now checks the profile destination and live listing inventory.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 16),
          LinearProgressIndicator(
            value: (snapshot.completionPercent / 100).clamp(0.0, 1.0),
            minHeight: 10,
            borderRadius: BorderRadius.circular(AppRadii.pill),
          ),
          const SizedBox(height: 14),
          for (final row in rows)
            _ReadinessRow(label: row.$1, detail: row.$3, done: row.$2),
        ],
      ),
    );
  }
}

class _LaunchpadConnectionCard extends StatelessWidget {
  const _LaunchpadConnectionCard({required this.snapshot});

  final MobileProfileSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Launchpad output destination',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 8),
          Text(
            'AI-generated profile copy, listings, and trust language should land in the public profile preview before deeper marketplace surfaces reuse them.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 14),
          _InfoRow(
            label: 'Current public path',
            value: snapshot.publicPath.isEmpty
                ? 'Created when profile is published'
                : snapshot.publicPath,
          ),
          _InfoRow(
            label: 'Published inventory',
            value:
                '${snapshot.serviceCount} services / ${snapshot.productCount} products',
          ),
          _ActionRow(
            icon: Icons.fact_check_outlined,
            label: 'View publish readiness',
            onTap: () => context.push(AppRoutes.providerLaunchpadReview),
          ),
          _ActionRow(
            icon: Icons.rocket_launch_outlined,
            label: 'Continue Business AI setup',
            onTap: () => context.push(AppRoutes.providerLaunchpad),
          ),
        ],
      ),
    );
  }
}

class _ListingsSummaryCard extends StatelessWidget {
  const _ListingsSummaryCard({required this.snapshot});

  final MobileProfileSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final narrow = constraints.maxWidth < 360;
        final tileWidth = narrow
            ? constraints.maxWidth
            : (constraints.maxWidth - 10) / 2;

        return Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [
            SizedBox(
              width: tileWidth,
              child: MetricTile(
                label: 'Live services',
                value: snapshot.serviceCount.toString(),
                caption: 'Visible from profile and discovery',
                icon: Icons.design_services_outlined,
              ),
            ),
            SizedBox(
              width: tileWidth,
              child: MetricTile(
                label: 'Live products',
                value: snapshot.productCount.toString(),
                caption: 'Catalog items ready for buyers',
                icon: Icons.inventory_2_outlined,
              ),
            ),
          ],
        );
      },
    );
  }
}

class _ProofAndReviewsCard extends StatelessWidget {
  const _ProofAndReviewsCard({required this.snapshot});

  final MobileProfileSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _CollectionCard<MobileProfilePortfolioItem>(
          title: 'Public proof',
          subtitle:
              '${snapshot.portfolioCount} portfolio items and ${snapshot.workHistoryCount} experience entries support the public profile.',
          emptyState:
              'No proof added yet. Add showcased work after the profile foundation is stable.',
          items: snapshot.portfolio.take(3).toList(),
          itemBuilder: (entry) =>
              _PreviewRow(title: entry.title, subtitle: entry.category),
        ),
        const SizedBox(height: 14),
        _CollectionCard<MobileProfileReview>(
          title: 'Reviews',
          subtitle:
              '${snapshot.reviewCount} reviews and a ${snapshot.averageRating.toStringAsFixed(1)} average now reach the app too.',
          emptyState:
              'No reviews yet. Completed jobs and follow-through will start building this section.',
          items: snapshot.reviews.take(3).toList(),
          itemBuilder: (entry) => _PreviewRow(
            title: '${entry.rating.toStringAsFixed(1)} stars',
            subtitle: entry.comment.isEmpty ? 'No written note' : entry.comment,
          ),
        ),
      ],
    );
  }
}

class _ReadinessRow extends StatelessWidget {
  const _ReadinessRow({
    required this.label,
    required this.detail,
    required this.done,
  });

  final String label;
  final String detail;
  final bool done;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            done ? Icons.check_circle_rounded : Icons.radio_button_off_rounded,
            color: done ? AppColors.success : AppColors.inkMuted,
            size: 20,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: Theme.of(context).textTheme.labelLarge),
                const SizedBox(height: 3),
                Text(
                  detail.isEmpty ? 'Missing' : detail,
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: AppColors.inkSubtle),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _TrustSection extends StatelessWidget {
  const _TrustSection({
    required this.snapshot,
    required this.googleSubmitting,
    required this.googleStatus,
    required this.googleError,
    required this.onLinkGoogle,
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

  final MobileProfileSnapshot snapshot;
  final bool googleSubmitting;
  final String? googleStatus;
  final String? googleError;
  final VoidCallback onLinkGoogle;
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
    return Column(
      key: const ValueKey('profile-trust'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _TrustSummaryCard(snapshot: snapshot),
        const SizedBox(height: 14),
        _VerificationChecklistCard(snapshot: snapshot),
        const SizedBox(height: 14),
        _SignInMethodsCard(
          linkedProviders: snapshot.linkedProviders,
          hasGoogle: snapshot.linkedProviders.contains('google'),
          googleSubmitting: googleSubmitting,
          googleStatus: googleStatus,
          googleError: googleError,
          onLinkGoogle: onLinkGoogle,
        ),
        const SizedBox(height: 14),
        _PasswordCard(
          formKey: formKey,
          passwordController: passwordController,
          confirmPasswordController: confirmPasswordController,
          passwordSubmitting: passwordSubmitting,
          passwordStatus: passwordStatus,
          passwordError: passwordError,
          obscurePassword: obscurePassword,
          obscureConfirmPassword: obscureConfirmPassword,
          onTogglePassword: onTogglePassword,
          onToggleConfirmPassword: onToggleConfirmPassword,
          onSubmit: onSubmit,
          validatePassword: validatePassword,
          validateConfirmation: validateConfirmation,
        ),
      ],
    );
  }
}

class _SettingsSection extends StatelessWidget {
  const _SettingsSection({
    required this.snapshot,
    required this.user,
    required this.onSignOut,
  });

  final MobileProfileSnapshot snapshot;
  final User? user;
  final VoidCallback onSignOut;

  @override
  Widget build(BuildContext context) {
    return Column(
      key: const ValueKey('profile-settings'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _LocationCard(snapshot: snapshot),
        const SizedBox(height: 14),
        _CollectionCard<MobileProfilePaymentMethod>(
          title: 'Payment methods',
          subtitle:
              '${snapshot.paymentMethodCount} payout methods visible to the signed-in owner only.',
          emptyState: 'No payout methods saved yet.',
          items: snapshot.paymentMethods.take(4).toList(),
          itemBuilder: (entry) => _PreviewRow(
            title: _humanize(entry.methodType),
            subtitle: _paymentSummary(entry),
          ),
        ),
        const SizedBox(height: 14),
        _AccountCard(snapshot: snapshot, user: user, onSignOut: onSignOut),
      ],
    );
  }
}

class _SectionIntro extends StatelessWidget {
  const _SectionIntro({required this.title, required this.message});

  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          Text(message, style: Theme.of(context).textTheme.bodyMedium),
        ],
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
    final displayName = profile.fullName.isEmpty
        ? snapshot.displayName
        : profile.fullName;
    final initials = _avatarFallback(displayName);

    return PremiumSurface(
      padding: const EdgeInsets.all(18),
      backgroundColor: AppColors.surface,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const PremiumPill(
            label: 'Profile Hub',
            icon: Icons.dashboard_customize_outlined,
            backgroundColor: AppColors.surfaceAlt,
          ),
          const SizedBox(height: 14),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                radius: 30,
                backgroundColor: AppColors.primarySoft,
                foregroundImage: profile.avatarUrl.isEmpty
                    ? null
                    : NetworkImage(profile.avatarUrl),
                onForegroundImageError: profile.avatarUrl.isEmpty
                    ? null
                    : (_, _) {},
                child: Text(
                  initials,
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      displayName,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      profile.headline.isEmpty
                          ? snapshot.roleLabel
                          : profile.headline,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: AppColors.inkSubtle,
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
              _HeroChip(label: '${snapshot.trustScore} trust score'),
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

class _LaunchReadinessCard extends StatelessWidget {
  const _LaunchReadinessCard({required this.snapshot});

  final MobileProfileSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    final profile = snapshot.profile;
    final isProvider = snapshot.roleFamily == 'provider';
    final hasIdentity =
        profile.fullName.isNotEmpty && profile.headline.isNotEmpty;
    final hasLocation = profile.location.isNotEmpty;
    final hasTrust =
        snapshot.trustScore >= 50 ||
        snapshot.linkedProviders.isNotEmpty ||
        profile.verificationLevel.isNotEmpty;
    final hasOfferCatalog = snapshot.serviceCount + snapshot.productCount > 0;
    final hasProof =
        snapshot.portfolioCount +
            snapshot.workHistoryCount +
            snapshot.reviewCount >
        0;
    final hasAvailability =
        snapshot.availabilityCount > 0 ||
        profile.availability.trim().isNotEmpty;
    final providerRows = [
      (
        'Public identity',
        hasIdentity,
        hasIdentity ? profile.headline : 'Add name and headline',
      ),
      (
        'Offer catalog',
        hasOfferCatalog,
        hasOfferCatalog
            ? '${snapshot.serviceCount} services / ${snapshot.productCount} products'
            : 'Publish at least one service or product',
      ),
      (
        'Availability',
        hasAvailability,
        hasAvailability
            ? _humanize(profile.availability)
            : 'Add schedule or availability',
      ),
      (
        'Trust proof',
        hasProof,
        hasProof
            ? '${snapshot.portfolioCount + snapshot.workHistoryCount} proof items'
            : 'Add work proof or reviews',
      ),
    ];
    final seekerRows = [
      (
        'Profile identity',
        profile.fullName.isNotEmpty || snapshot.displayName.isNotEmpty,
        profile.fullName.isEmpty ? snapshot.displayName : profile.fullName,
      ),
      (
        'Local area',
        hasLocation,
        hasLocation ? profile.location : 'Add your city or neighbourhood',
      ),
      (
        'Trusted sign-in',
        hasTrust,
        hasTrust
            ? '${snapshot.trustScore} trust score'
            : 'Link a sign-in method',
      ),
      (
        'Request readiness',
        snapshot.completionPercent >= 50,
        snapshot.completionPercent >= 50
            ? '${snapshot.completionPercent}% complete'
            : 'Complete basics before posting',
      ),
    ];
    final rows = isProvider ? providerRows : seekerRows;
    final completed = rows.where((row) => row.$2).length;
    final progress = completed / rows.length;

    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: AppColors.primarySoft,
                  borderRadius: BorderRadius.circular(AppRadii.md),
                ),
                child: Icon(
                  isProvider
                      ? Icons.storefront_rounded
                      : Icons.flag_circle_outlined,
                  color: AppColors.primary,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      isProvider
                          ? 'Provider launch readiness'
                          : 'Account readiness',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '$completed of ${rows.length} essentials complete',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          LinearProgressIndicator(
            value: progress,
            minHeight: 10,
            borderRadius: BorderRadius.circular(AppRadii.pill),
          ),
          const SizedBox(height: 14),
          for (final row in rows)
            _ReadinessRow(label: row.$1, detail: row.$3, done: row.$2),
          const SizedBox(height: 8),
          if (isProvider) ...[
            _ActionRow(
              icon: Icons.rocket_launch_outlined,
              label: 'Continue launch setup',
              onTap: () => context.push(AppRoutes.providerLaunchpad),
            ),
            _ActionRow(
              icon: Icons.inventory_2_outlined,
              label: 'Manage listings',
              onTap: () => context.push(AppRoutes.providerListings),
            ),
          ] else ...[
            _ActionRow(
              icon: Icons.add_circle_outline_rounded,
              label: 'Post a Need',
              onTap: () => context.push(AppRoutes.createNeed),
            ),
            _ActionRow(
              icon: Icons.person_search_outlined,
              label: 'Find nearby help',
              onTap: () => context.push(AppRoutes.people),
            ),
          ],
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
        color: AppColors.surfaceAlt,
        borderRadius: BorderRadius.circular(AppRadii.pill),
        border: Border.all(color: AppColors.border),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelLarge?.copyWith(
          color: AppColors.ink,
          fontWeight: FontWeight.w800,
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
      (
        'Trust score',
        snapshot.trustScore.toString(),
        'Reputation built across requests and follow-through',
        Icons.verified_outlined,
      ),
      (
        'Reviews',
        snapshot.reviewCount.toString(),
        '${snapshot.averageRating.toStringAsFixed(1)} average rating',
        Icons.star_outline_rounded,
      ),
      (
        'Services',
        snapshot.serviceCount.toString(),
        'Live offerings visible nearby',
        Icons.design_services_outlined,
      ),
      (
        'Products',
        snapshot.productCount.toString(),
        'Catalog currently synced to mobile',
        Icons.inventory_2_outlined,
      ),
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
                  child: MetricTile(
                    label: item.$1,
                    value: item.$2,
                    caption: item.$3,
                    icon: item.$4,
                  ),
                ),
              )
              .toList(),
        );
      },
    );
  }
}

class _CompletionCard extends StatelessWidget {
  const _CompletionCard({required this.snapshot});

  final MobileProfileSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    final completionValue = (snapshot.completionPercent / 100).clamp(0.0, 1.0);

    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Profile completion',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 10),
          Text(
            'A more complete profile improves trust, faster replies, and higher intent from nearby users.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 16),
          LinearProgressIndicator(
            value: completionValue,
            minHeight: 10,
            borderRadius: BorderRadius.circular(999),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              TrustBadge(
                label: '${snapshot.completionPercent}% complete',
                icon: Icons.checklist_rounded,
                backgroundColor: AppColors.primarySoft,
                foregroundColor: AppColors.primary,
              ),
              TrustBadge(
                label: _humanize(snapshot.profile.verificationLevel),
                icon: Icons.verified_user_outlined,
                backgroundColor: AppColors.accentSoft,
                foregroundColor: AppColors.accent,
              ),
              if (snapshot.profile.location.isNotEmpty)
                TrustBadge(
                  label: snapshot.profile.location,
                  icon: Icons.location_on_outlined,
                  backgroundColor: AppColors.surfaceMuted,
                  foregroundColor: AppColors.ink,
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _MarketplaceActionsCard extends StatelessWidget {
  const _MarketplaceActionsCard();

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Marketplace controls',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 10),
          Text(
            'Move from Business AI setup into listings, orders, and provider operations without losing the profile context.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 14),
          _ActionRow(
            icon: Icons.rocket_launch_outlined,
            label: 'Business AI Launchpad',
            onTap: () => context.push(AppRoutes.providerLaunchpad),
          ),
          _ActionRow(
            icon: Icons.inventory_2_outlined,
            label: 'Listing manager',
            onTap: () => context.push(AppRoutes.providerListings),
          ),
          _ActionRow(
            icon: Icons.shopping_bag_outlined,
            label: 'Orders',
            onTap: () => context.push(AppRoutes.orders),
          ),
        ],
      ),
    );
  }
}

class _ActionRow extends StatelessWidget {
  const _ActionRow({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.sm),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          decoration: BoxDecoration(
            color: AppColors.surfaceMuted,
            borderRadius: BorderRadius.circular(AppRadii.sm),
          ),
          child: Row(
            children: [
              Icon(icon, color: AppColors.primary),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  label,
                  style: Theme.of(context).textTheme.labelLarge,
                ),
              ),
              const Icon(
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

class _TrustSummaryCard extends StatelessWidget {
  const _TrustSummaryCard({required this.snapshot});

  final MobileProfileSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    final profile = snapshot.profile;

    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Trust and completion',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 10),
          Text(
            'This is the part of your profile that affects credibility, repeat sign-in confidence, and how comfortably people reach out.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              TrustBadge(
                label: '${snapshot.trustScore} trust score',
                icon: Icons.shield_outlined,
                backgroundColor: AppColors.primarySoft,
                foregroundColor: AppColors.primary,
              ),
              TrustBadge(
                label: '${snapshot.reviewCount} reviews',
                icon: Icons.star_outline_rounded,
                backgroundColor: AppColors.warningSoft,
                foregroundColor: AppColors.warning,
              ),
              TrustBadge(
                label: _humanize(profile.verificationLevel),
                icon: Icons.verified_user_outlined,
                backgroundColor: AppColors.accentSoft,
                foregroundColor: AppColors.accent,
              ),
            ],
          ),
          const SizedBox(height: 16),
          _InfoRow(
            label: 'Average rating',
            value: snapshot.averageRating <= 0
                ? 'No rating yet'
                : snapshot.averageRating.toStringAsFixed(1),
          ),
          _InfoRow(
            label: 'Linked sign-in methods',
            value: snapshot.linkedProviders.isEmpty
                ? 'Email'
                : snapshot.linkedProviders.map(_providerLabel).join(', '),
          ),
        ],
      ),
    );
  }
}

class _VerificationChecklistCard extends StatelessWidget {
  const _VerificationChecklistCard({required this.snapshot});

  final MobileProfileSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    final profile = snapshot.profile;
    final linkedProviders = snapshot.linkedProviders;
    final hasPaymentVerification = snapshot.paymentMethods.any(
      (method) => method.isVerified,
    );

    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Verification meaning',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 8),
          Text(
            'These signals explain what is already trusted and what still needs attention before more people rely on this profile.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 14),
          _ReadinessRow(
            label: 'Email identity',
            detail: snapshot.email.isEmpty
                ? 'Email missing'
                : 'Email attached to this account',
            done:
                snapshot.email.isNotEmpty || linkedProviders.contains('email'),
          ),
          _ReadinessRow(
            label: 'Google sign-in',
            detail: linkedProviders.contains('google')
                ? 'Google is linked'
                : 'Optional link for faster trusted sign-in',
            done: linkedProviders.contains('google'),
          ),
          _ReadinessRow(
            label: 'Public identity',
            detail: profile.fullName.isNotEmpty && profile.headline.isNotEmpty
                ? 'Name and headline are visible'
                : 'Add name and headline',
            done: profile.fullName.isNotEmpty && profile.headline.isNotEmpty,
          ),
          _ReadinessRow(
            label: 'Location privacy',
            detail: profile.location.isEmpty
                ? 'Exact location stays private until added'
                : 'Public location is ${profile.location}',
            done: profile.location.isNotEmpty,
          ),
          _ReadinessRow(
            label: 'Payment trust',
            detail: hasPaymentVerification
                ? 'Verified payout method available'
                : 'No verified payout method shown yet',
            done: hasPaymentVerification,
          ),
        ],
      ),
    );
  }
}

class _LocationCard extends StatelessWidget {
  const _LocationCard({required this.snapshot});

  final MobileProfileSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    final profile = snapshot.profile;

    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Settings and location',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 10),
          Text(
            'Keep your contact details and service area clear so the mobile experience stays grounded in local intent.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 14),
          _InfoRow(
            label: 'Location',
            value: profile.location.isEmpty
                ? 'Not added yet'
                : profile.location,
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
            label: 'Availability mode',
            value: _humanize(profile.availability),
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
        color: AppColors.background,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border),
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
          _InfoRow(label: 'Email', value: user?.email ?? snapshot.email),
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
            style: Theme.of(
              context,
            ).textTheme.labelLarge?.copyWith(color: AppColors.inkSubtle),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: Theme.of(
              context,
            ).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w700),
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
        (index) => Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: SectionCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                LoadingShimmer(height: 22, width: 180),
                SizedBox(height: 12),
                LoadingShimmer(height: 14),
                SizedBox(height: 10),
                LoadingShimmer(height: 14, width: 220),
                SizedBox(height: 16),
                LoadingShimmer(height: 120),
              ],
            ),
          ),
        ),
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
          color: showingError ? theme.colorScheme.error : AppColors.primary,
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
