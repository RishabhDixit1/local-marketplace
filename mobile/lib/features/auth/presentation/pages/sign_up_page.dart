import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/design_system/design_system.dart';
import '../../../../core/theme/design_tokens.dart';
import '../../data/onboarding_handoff.dart';
import '../notifiers/auth_notifier.dart';
import '../widgets/auth_header.dart';
import '../widgets/social_auth_button.dart';
import '../widgets/auth_text_field.dart';
import '../widgets/auth_divider.dart';
import '../widgets/password_strength_indicator.dart';

class SignUpPage extends ConsumerStatefulWidget {
  const SignUpPage({super.key});

  @override
  ConsumerState<SignUpPage> createState() => _SignUpPageState();
}

class _SignUpPageState extends ConsumerState<SignUpPage>
    with SingleTickerProviderStateMixin {
  late final AnimationController _fadeController;
  late final Animation<double> _fadeAnimation;
  late final Animation<Offset> _slideAnimation;
  MobileOnboardingIntent? _selectedIntent;

  @override
  void initState() {
    super.initState();
    _fadeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _fadeAnimation = CurvedAnimation(
      parent: _fadeController,
      curve: Curves.easeOutCubic,
    );
    _slideAnimation = Tween<Offset>(
      begin: Offset(0, 0.08),
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: _fadeController,
      curve: Curves.easeOutCubic,
    ));
    _fadeController.forward();
  }

  @override
  void dispose() {
    _fadeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final notifier = ref.watch(authNotifierProvider.notifier);
    final state = ref.watch(authNotifierProvider);

    return ServiqScaffold(
      gradient: Theme.of(context)
          .extension<ServiqThemeTokens>()!
          .authGradient,
      body: SafeArea(
        child: SingleChildScrollView(
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          physics: const BouncingScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          child: FadeTransition(
            opacity: _fadeAnimation,
            child: SlideTransition(
              position: _slideAnimation,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back_rounded),
                    onPressed: () => context.pop(),
                  ),
                  Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const AuthHeader(
                          title: 'Create account',
                          subtitle: 'Join ServiQ and start connecting with your community',
                        ),
                        const SizedBox(height: 32),

                        if (state.errorMessage != null)
                          _MessageBanner(
                            message: state.errorMessage!,
                            isError: true,
                          ),
                        if (state.successMessage != null)
                          _MessageBanner(
                            message: state.successMessage!,
                            isError: false,
                          ),

                        _GlassFormSection(
                          child: Column(
                            children: [
                              _buildSignUpForm(notifier, state),
                              const SizedBox(height: 20),
                              const AuthDivider(),
                              const SizedBox(height: 20),
                              _buildSocialSection(notifier, state),
                            ],
                          ),
                        ),

                        const SizedBox(height: 32),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              'Already have an account? ',
                              style: Theme.of(context)
                                  .textTheme
                                  .bodyMedium
                                  ?.copyWith(color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.45)),
                            ),
                            GestureDetector(
                              onTap: () => context.pop(),
                              child: Text(
                                'Sign in',
                                style: Theme.of(context)
                                    .textTheme
                                    .bodyMedium
                                    ?.copyWith(
                                      color: AppColors.primary,
                                      fontWeight: FontWeight.w800,
                                    ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSignUpForm(AuthNotifier notifier, AuthFormState state) {
    return Form(
      child: Column(
        children: [
          _IntentSelector(
            selected: _selectedIntent,
            onSelect: (intent) {
              setState(() => _selectedIntent = intent);
              ref
                  .read(onboardingHandoffControllerProvider)
                  .selectIntent(intent);
            },
          ),
          const SizedBox(height: 20),
          AuthTextField(
            controller: notifier.nameController,
            label: 'Full name',
            hintText: 'John Doe',
            prefixIcon: Icons.person_outline_rounded,
            textInputAction: TextInputAction.next,
            autofillHints: const [AutofillHints.name],
          ),
          const SizedBox(height: 14),
          AuthTextField(
            controller: notifier.emailController,
            label: 'Email address',
            hintText: 'you@example.com',
            prefixIcon: Icons.email_outlined,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.next,
            autofillHints: const [AutofillHints.email],
          ),
          const SizedBox(height: 14),
          PasswordField(
            controller: notifier.passwordController,
            label: 'Password',
            obscureText: state.obscurePassword,
            onToggleVisibility: notifier.togglePasswordVisibility,
            textInputAction: TextInputAction.next,
            autofillHints: const [AutofillHints.newPassword],
          ),
          PasswordStrengthIndicator(
            password: notifier.passwordController.text,
          ),
          const SizedBox(height: 14),
          PasswordField(
            controller: notifier.confirmPasswordController,
            label: 'Confirm password',
            obscureText: state.obscureConfirmPassword,
            onToggleVisibility: notifier.toggleConfirmPasswordVisibility,
            textInputAction: TextInputAction.done,
            autofillHints: const [AutofillHints.newPassword],
          ),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: state.isSubmitting
                  ? null
                  : () => notifier.signUp(context),
              child: state.isSubmitting
                  ? SizedBox(
                      width: 20, height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Theme.of(context).colorScheme.onPrimary),
                    )
                  : const Text('Create account'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSocialSection(AuthNotifier notifier, AuthFormState state) {
    return Column(
      children: [
        SocialAuthButton(
          provider: SocialAuthProvider.google,
          isLoading: state.isSubmitting,
          onPressed: () => notifier.signInWithGoogle(context),
        ),
        const SizedBox(height: 12),
        SocialAuthButton(
          provider: SocialAuthProvider.apple,
          isLoading: state.isSubmitting,
          onPressed: () => notifier.signInWithApple(context),
        ),
      ],
    );
  }
}

class _GlassFormSection extends StatelessWidget {
  const _GlassFormSection({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadii.xl),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
        child: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [
                Theme.of(context).colorScheme.surface.withValues(alpha: 0.7),
                Theme.of(context).colorScheme.surface.withValues(alpha: 0.4),
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(AppRadii.xl),
            border: Border.all(
              color: AppColors.primary.withValues(alpha: 0.08),
            ),
          ),
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: child,
        ),
      ),
    );
  }
}

class _MessageBanner extends StatelessWidget {
  const _MessageBanner({required this.message, required this.isError});
  final String message;
  final bool isError;

  @override
  Widget build(BuildContext context) {
    final color = isError ? AppColors.danger : AppColors.success;
    final bgColor = isError ? AppColors.dangerSoft : AppColors.successSoft;
    final icon = isError ? Icons.error_outline_rounded : Icons.check_circle_rounded;

    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(AppRadii.md),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Row(
          children: [
            Icon(icon, color: color, size: 18),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                message,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: color,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _IntentSelector extends StatelessWidget {
  const _IntentSelector({required this.selected, required this.onSelect});

  final MobileOnboardingIntent? selected;
  final ValueChanged<MobileOnboardingIntent> onSelect;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Who are you using ServiQ for?',
          style: Theme.of(
            context,
          ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 4),
        Text(
          'Pick a path and we will tailor your home. You can switch anytime.',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.55),
          ),
        ),
        const SizedBox(height: 12),
        for (final option in _intentOptions) ...[
          _IntentOptionRow(
            option: option,
            isSelected: selected == option.intent,
            onTap: () => onSelect(option.intent),
          ),
          if (option != _intentOptions.last) const SizedBox(height: 10),
        ],
      ],
    );
  }
}

class _IntentOptionRow extends StatelessWidget {
  const _IntentOptionRow({
    required this.option,
    required this.isSelected,
    required this.onTap,
  });

  final _IntentOption option;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadii.lg),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        decoration: BoxDecoration(
          color: isSelected
              ? AppColors.primarySoft.withValues(alpha: 0.55)
              : Theme.of(
                  context,
                ).colorScheme.surfaceContainerHighest.withValues(alpha: 0.3),
          borderRadius: BorderRadius.circular(AppRadii.lg),
          border: Border.all(
            color: isSelected
                ? AppColors.primary.withValues(alpha: 0.55)
                : Theme.of(context).colorScheme.outline.withValues(alpha: 0.4),
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: isSelected
                    ? AppColors.primary
                    : AppColors.primary.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(AppRadii.md),
              ),
              child: Icon(
                option.icon,
                size: 18,
                color: isSelected ? Colors.white : AppColors.primary,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    option.title,
                    style: Theme.of(
                      context,
                    ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 1),
                  Text(
                    option.subtitle,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Theme.of(
                        context,
                      ).colorScheme.onSurface.withValues(alpha: 0.55),
                    ),
                  ),
                ],
              ),
            ),
            if (isSelected)
              const Icon(Icons.check_circle_rounded, size: 18, color: AppColors.primary),
          ],
        ),
      ),
    );
  }
}

class _IntentOption {
  const _IntentOption({
    required this.intent,
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final MobileOnboardingIntent intent;
  final IconData icon;
  final String title;
  final String subtitle;
}

const _intentOptions = [
  _IntentOption(
    intent: MobileOnboardingIntent.findHelp,
    icon: Icons.manage_search_rounded,
    title: 'Find help',
    subtitle: 'Post needs and hire nearby professionals',
  ),
  _IntentOption(
    intent: MobileOnboardingIntent.earnNearby,
    icon: Icons.work_outline_rounded,
    title: 'Earn nearby',
    subtitle: 'Take on local work and grow your income',
  ),
  _IntentOption(
    intent: MobileOnboardingIntent.businessSetup,
    icon: Icons.storefront_outlined,
    title: 'Set up my business',
    subtitle: 'List your services, team, and availability',
  ),
];
