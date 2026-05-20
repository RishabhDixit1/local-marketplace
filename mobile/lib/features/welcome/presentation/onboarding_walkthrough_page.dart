import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/theme/app_theme.dart';

const _onboardingCompleteKey = 'serviq_onboarding_complete';

final onboardingCompleteProvider = FutureProvider<bool>((ref) async {
  final prefs = await SharedPreferences.getInstance();
  return prefs.getBool(_onboardingCompleteKey) ?? false;
});

Future<bool> isOnboardingComplete() async {
  final prefs = await SharedPreferences.getInstance();
  return prefs.getBool(_onboardingCompleteKey) ?? false;
}

Future<void> markOnboardingComplete() async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.setBool(_onboardingCompleteKey, true);
}

class OnboardingWalkthroughPage extends ConsumerStatefulWidget {
  const OnboardingWalkthroughPage({super.key});

  @override
  ConsumerState<OnboardingWalkthroughPage> createState() =>
      _OnboardingWalkthroughPageState();
}

class _OnboardingWalkthroughPageState
    extends ConsumerState<OnboardingWalkthroughPage> {
  final _pageController = PageController();
  int _currentPage = 0;

  final _pages = const [
    _OnboardingPageData(
      icon: Icons.electric_bolt_rounded,
      title: 'Welcome to ServiQ',
      headline: 'Your Local Marketplace',
      subtitle:
          'Find trusted providers, post needs, and get work done in your neighborhood.',
      gradientColors: [Color(0xFF10262B), Color(0xFF115E57), Color(0xFF14B8A6)],
    ),
    _OnboardingPageData(
      icon: Icons.search_rounded,
      title: 'Find Help Nearby',
      headline: 'Find Help Nearby',
      subtitle:
          'Browse verified providers, compare prices, and read real reviews from your community.',
      gradientColors: [Color(0xFF1E3A5F), Color(0xFF3557D5), Color(0xFF5B7DEF)],
    ),
    _OnboardingPageData(
      icon: Icons.edit_note_rounded,
      title: 'Post What You Need',
      headline: 'Post What You Need',
      subtitle:
          'Describe your task, set your budget, and let nearby providers respond with quotes.',
      gradientColors: [Color(0xFF7A4313), Color(0xFFB66B1E), Color(0xFFF59E0B)],
    ),
    _OnboardingPageData(
      icon: Icons.verified_user_rounded,
      title: 'Trust & Safety',
      headline: 'Trust & Safety',
      subtitle:
          'Every provider is verified. Payments are protected. Your data stays private.',
      gradientColors: [Color(0xFF1E3B5C), Color(0xFF2563EB), Color(0xFF60A5FA)],
    ),
  ];

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _onNext() {
    if (_currentPage < _pages.length - 1) {
      _pageController.nextPage(
        duration: AppDurations.standard,
        curve: Curves.easeInOut,
      );
    }
  }

  Future<void> _onSkip() async {
    await markOnboardingComplete();
    ref.invalidate(onboardingCompleteProvider);
    if (!mounted) return;
    context.go('/');
  }

  Future<void> _onGetStarted() async {
    await markOnboardingComplete();
    ref.invalidate(onboardingCompleteProvider);
    if (!mounted) return;
    context.go('/');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            _buildTopBar(),
            Expanded(
              child: PageView.builder(
                controller: _pageController,
                itemCount: _pages.length,
                onPageChanged: (index) {
                  setState(() => _currentPage = index);
                },
                itemBuilder: (context, index) {
                  return _WalkthroughPageContent(
                    data: _pages[index],
                    isLastPage: index == _pages.length - 1,
                  );
                },
              ),
            ),
            _buildBottomBar(),
          ],
        ),
      ),
    );
  }

  Widget _buildTopBar() {
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.lg,
        vertical: AppSpacing.sm,
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          if (_currentPage < _pages.length - 1)
            TextButton(
              onPressed: _onSkip,
              child: const Text(
                'Skip',
                style: TextStyle(
                  color: AppColors.inkSubtle,
                  fontWeight: FontWeight.w500,
                ),
              ),
            )
          else
            const SizedBox(width: 64),
        ],
      ),
    );
  }

  Widget _buildBottomBar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.xl,
        AppSpacing.md,
        AppSpacing.xl,
        AppSpacing.xxl,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _buildPageIndicator(),
          const SizedBox(height: AppSpacing.xxl),
          SizedBox(
            width: double.infinity,
            height: AppTouchTargets.buttonHeight,
            child: FilledButton(
              onPressed:
                  _currentPage == _pages.length - 1
                      ? _onGetStarted
                      : _onNext,
              child: Text(
                _currentPage == _pages.length - 1
                    ? 'Get Started'
                    : 'Next',
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPageIndicator() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(_pages.length, (index) {
        final isActive = index == _currentPage;
        return AnimatedContainer(
          duration: AppDurations.fast,
          margin: const EdgeInsets.symmetric(horizontal: 4),
          width: isActive ? 24 : 8,
          height: 8,
          decoration: BoxDecoration(
            color: isActive ? AppColors.primary : AppColors.border,
            borderRadius: BorderRadius.circular(4),
          ),
        );
      }),
    );
  }
}

class _OnboardingPageData {
  const _OnboardingPageData({
    required this.icon,
    required this.title,
    required this.headline,
    required this.subtitle,
    required this.gradientColors,
  });

  final IconData icon;
  final String title;
  final String headline;
  final String subtitle;
  final List<Color> gradientColors;
}

class _WalkthroughPageContent extends StatelessWidget {
  const _WalkthroughPageContent({
    required this.data,
    required this.isLastPage,
  });

  final _OnboardingPageData data;
  final bool isLastPage;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _buildIllustration(),
          const SizedBox(height: AppSpacing.xxxl + 8),
          Text(
            data.headline,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.bold,
              color: AppColors.inkStrong,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            data.subtitle,
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
              color: AppColors.inkSubtle,
              height: 1.4,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildIllustration() {
    return Container(
      width: 200,
      height: 200,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: data.gradientColors,
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(40),
        boxShadow: AppShadows.floating,
      ),
      child: Icon(
        data.icon,
        size: 80,
        color: Colors.white.withValues(alpha: 0.9),
      ),
    );
  }
}
