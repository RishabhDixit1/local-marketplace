import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/supabase/app_bootstrap.dart';
import '../../../core/theme/design_tokens.dart';
import '../../../core/widgets/section_card.dart';
import '../../../features/profile/data/profile_repository.dart';
import '../../../features/profile/domain/mobile_profile_snapshot.dart';
import '../../../shared/components/app_buttons.dart';

class PublicBusinessPage extends ConsumerStatefulWidget {
  const PublicBusinessPage({super.key});

  @override
  ConsumerState<PublicBusinessPage> createState() => _PublicBusinessPageState();
}

class _PublicBusinessPageState extends ConsumerState<PublicBusinessPage> {
  Future<void> _shareProfile() async {
    final snapshot = ref.read(profileSnapshotProvider).asData?.value;
    if (snapshot == null) return;

    final url = _publicUrl(snapshot.publicPath);
    try {
      await SharePlus.instance.share(
        ShareParams(
          text: 'Check out my profile on ServiQ: $url',
          subject: snapshot.displayName,
        ),
      );
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not open share sheet')),
        );
      }
    }
  }

  Future<void> _openInBrowser() async {
    final snapshot = ref.read(profileSnapshotProvider).asData?.value;
    if (snapshot == null) return;

    final uri = Uri.tryParse(_publicUrl(snapshot.publicPath));
    if (uri != null && await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not open browser')),
        );
      }
    }
  }

  String _publicUrl(String publicPath) {
    final config = ref.read(appBootstrapProvider).config;
    final base = config.apiBaseUrl.trim();
    final path = publicPath.startsWith('/') ? publicPath : '/$publicPath';
    return '$base$path';
  }

  @override
  Widget build(BuildContext context) {
    final profileAsync = ref.watch(profileSnapshotProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Public Business Page'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => context.pop(),
        ),
      ),
      body: profileAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.xl),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.cloud_off_rounded,
                    size: 48, color: AppColors.inkFaint),
                const SizedBox(height: AppSpacing.md),
                const Text(
                  'Could not load your profile',
                  style: TextStyle(fontSize: 16),
                ),
                const SizedBox(height: AppSpacing.md),
                SecondaryButton(
                  label: 'Try again',
                  onPressed: () => ref.invalidate(profileSnapshotProvider),
                  expanded: false,
                ),
              ],
            ),
          ),
        ),
        data: (snapshot) => _PublicBusinessContent(
          snapshot: snapshot,
          onShare: _shareProfile,
          onOpenBrowser: _openInBrowser,
        ),
      ),
    );
  }
}

class _PublicBusinessContent extends StatelessWidget {
  const _PublicBusinessContent({
    required this.snapshot,
    required this.onShare,
    required this.onOpenBrowser,
  });

  final MobileProfileSnapshot snapshot;
  final VoidCallback onShare;
  final VoidCallback onOpenBrowser;

  @override
  Widget build(BuildContext context) {
    final profile = snapshot.profile;
    final theme = Theme.of(context);

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.pageInset,
        AppSpacing.md,
        AppSpacing.pageInset,
        AppSpacing.xxxl,
      ),
      children: [
        _HeroSection(
          avatarUrl: profile.avatarUrl,
          fullName: profile.fullName.isNotEmpty
              ? profile.fullName
              : snapshot.displayName,
          headline: profile.headline,
          location: profile.location,
        ),
        const SizedBox(height: AppSpacing.lg),
        _StatsGrid(snapshot: snapshot),
        const SizedBox(height: AppSpacing.xl),
        if (profile.bio.trim().isNotEmpty) ...[
          SectionCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('About', style: theme.textTheme.titleMedium),
                const SizedBox(height: AppSpacing.xs),
                Text(profile.bio,
                    style: theme.textTheme.bodyMedium
                        ?.copyWith(color: AppColors.inkSubtle)),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.xl),
        ],
        PrimaryButton(
          label: 'Share Profile',
          icon: const Icon(Icons.ios_share_rounded),
          onPressed: onShare,
        ),
        const SizedBox(height: AppSpacing.sm),
        SecondaryButton(
          label: 'Open in Browser',
          icon: const Icon(Icons.open_in_new_rounded),
          onPressed: onOpenBrowser,
        ),
        const SizedBox(height: AppSpacing.md),
        Center(
          child: Text(
            _publicUrlDisplay(snapshot.publicPath),
            style: theme.textTheme.bodySmall
                ?.copyWith(color: AppColors.inkFaint),
            textAlign: TextAlign.center,
          ),
        ),
      ],
    );
  }

  String _publicUrlDisplay(String publicPath) {
    return 'serviqapp.com${publicPath.startsWith('/') ? publicPath : '/$publicPath'}';
  }
}

class _HeroSection extends StatelessWidget {
  const _HeroSection({
    required this.avatarUrl,
    required this.fullName,
    required this.headline,
    required this.location,
  });

  final String avatarUrl;
  final String fullName;
  final String headline;
  final String location;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      children: [
        Container(
          width: 88,
          height: 88,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: AppColors.border, width: 2),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(44),
            child: avatarUrl.trim().isNotEmpty
                ? CachedNetworkImage(
                    imageUrl: avatarUrl,
                    fit: BoxFit.cover,
                    errorWidget: (_, _, _) => const Icon(
                      Icons.person_rounded,
                      size: 44,
                      color: AppColors.inkFaint,
                    ),
                  )
                : const Icon(
                    Icons.person_rounded,
                    size: 44,
                    color: AppColors.inkFaint,
                  ),
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        Text(
          fullName,
          style: theme.textTheme.headlineSmall
              ?.copyWith(fontWeight: FontWeight.w700),
          textAlign: TextAlign.center,
        ),
        if (headline.trim().isNotEmpty) ...[
          const SizedBox(height: AppSpacing.xxs),
          Text(
            headline,
            style: theme.textTheme.bodyLarge
                ?.copyWith(color: AppColors.inkSubtle),
            textAlign: TextAlign.center,
          ),
        ],
        if (location.trim().isNotEmpty) ...[
          const SizedBox(height: AppSpacing.xxs),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.location_on_outlined,
                  size: 16, color: AppColors.inkFaint),
              const SizedBox(width: AppSpacing.xxs),
              Text(
                location,
                style: theme.textTheme.bodySmall
                    ?.copyWith(color: AppColors.inkFaint),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

class _StatsGrid extends StatelessWidget {
  const _StatsGrid({required this.snapshot});

  final MobileProfileSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Row(
        children: [
          Expanded(
            child: _StatCell(
              label: 'Rating',
              value: snapshot.averageRating > 0
                  ? snapshot.averageRating.toStringAsFixed(1)
                  : '--',
              icon: Icons.star_rounded,
            ),
          ),
          _verticalDivider(),
          Expanded(
            child: _StatCell(
              label: 'Reviews',
              value: _formatCount(snapshot.reviewCount),
              icon: Icons.rate_review_outlined,
            ),
          ),
          _verticalDivider(),
          Expanded(
            child: _StatCell(
              label: 'Services',
              value: _formatCount(snapshot.serviceCount),
              icon: Icons.work_outline,
            ),
          ),
          _verticalDivider(),
          Expanded(
            child: _StatCell(
              label: 'Trust',
              value: '${snapshot.trustScore}%',
              icon: Icons.verified_outlined,
            ),
          ),
        ],
      ),
    );
  }

  Widget _verticalDivider() {
    return Container(
      width: 1,
      height: 48,
      color: AppColors.border,
    );
  }

  String _formatCount(int count) {
    if (count >= 1000) {
      return '${(count / 1000).toStringAsFixed(1)}k';
    }
    return count.toString();
  }
}

class _StatCell extends StatelessWidget {
  const _StatCell({
    required this.label,
    required this.value,
    required this.icon,
  });

  final String label;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 20, color: AppColors.primary),
        const SizedBox(height: AppSpacing.xxs),
        Text(
          value,
          style: theme.textTheme.titleLarge
              ?.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: theme.textTheme.bodySmall
              ?.copyWith(color: AppColors.inkFaint),
        ),
      ],
    );
  }
}
