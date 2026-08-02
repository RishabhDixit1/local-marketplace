import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/design_system/design_system.dart';
import '../../../../core/theme/design_tokens.dart';
import '../../../../core/constants/app_routes.dart';
import '../notifiers/auth_notifier.dart';
import '../widgets/auth_header.dart';
import '../widgets/social_auth_button.dart';
import '../widgets/auth_text_field.dart';
import '../widgets/auth_divider.dart';

class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage>
    with SingleTickerProviderStateMixin {
  late final AnimationController _fadeController;
  late final Animation<double> _fadeAnimation;
  late final Animation<Offset> _slideAnimation;

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
        child: Center(
          child: SingleChildScrollView(
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            physics: const BouncingScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: FadeTransition(
              opacity: _fadeAnimation,
              child: SlideTransition(
                position: _slideAnimation,
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const AuthHeader(
                      title: 'Welcome back',
                      subtitle: 'Sign in to your ServiQ account',
                    ),
                    const SizedBox(height: 28),

                    if (state.errorMessage != null)
                      _MessageBanner(message: state.errorMessage!, isError: true),
                    if (state.successMessage != null)
                      _MessageBanner(message: state.successMessage!, isError: false),

                    _GlassFormSection(
                      child: Column(
                        children: [
                          _buildSocialSection(notifier, state),
                          const SizedBox(height: 20),
                          const AuthDivider(),
                          const SizedBox(height: 20),
                          _buildTabBar(state),
                          const SizedBox(height: 20),
                          _buildTabContent(notifier, state),
                        ],
                      ),
                    ),

                    const SizedBox(height: 24),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          "Don't have an account? ",
                          style: Theme.of(context)
                              .textTheme
                              .bodyMedium
                              ?.copyWith(color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.45)),
                        ),
                        GestureDetector(
                          onTap: () => context.push(AppRoutes.signUp),
                          child: Text(
                            'Create one',
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
                    const SizedBox(height: 16),
                    Text(
                      'ServiQ mobile uses the same account as the web app.',
                      textAlign: TextAlign.center,
                      style: Theme.of(context)
                          .textTheme
                          .bodySmall
                          ?.copyWith(color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.45)),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
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

  Widget _buildTabBar(AuthFormState state) {
    final tabs = [
      (AuthTab.emailOtp, 'Email'),
      (AuthTab.phoneOtp, 'Phone'),
      (AuthTab.password, 'Password'),
    ];

    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(AppRadii.lg),
      ),
      padding: const EdgeInsets.all(4),
      child: Row(
        children: tabs.map((tab) {
          final selected = state.activeTab == tab.$1;
          return Expanded(
            child: GestureDetector(
              onTap: () {
                final notifier = ref.read(authNotifierProvider.notifier);
                notifier.setActiveTab(tab.$1);
              },
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  color: selected ? Theme.of(context).colorScheme.surface : Colors.transparent,
                  borderRadius: BorderRadius.circular(AppRadii.md),
                  boxShadow: selected ? AppShadows.card : null,
                ),
                child: Text(
                  tab.$2,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: selected ? Theme.of(context).colorScheme.onSurface : Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.45),
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildTabContent(AuthNotifier notifier, AuthFormState state) {
    switch (state.activeTab) {
      case AuthTab.emailOtp:
        return _buildEmailOtpForm(notifier, state);
      case AuthTab.phoneOtp:
        return _buildPhoneOtpForm(notifier, state);
      case AuthTab.password:
        return _buildPasswordForm(notifier, state);
    }
  }

  Widget _buildEmailOtpForm(AuthNotifier notifier, AuthFormState state) {
    if (state.otpSent) {
      return Form(
        child: Column(
          children: [
            AuthTextField(
              controller: notifier.otpCodeController,
              label: 'Enter code',
              hintText: '123456',
              keyboardType: TextInputType.number,
              textInputAction: TextInputAction.done,
              maxLength: 6,
              textAlign: TextAlign.center,
              autofillHints: const [AutofillHints.oneTimeCode],
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: state.isSubmitting
                    ? null
                    : () => notifier.verifyEmailOtp(context),
                child: state.isSubmitting
                    ? SizedBox(
                        width: 20, height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Theme.of(context).colorScheme.onPrimary),
                      )
                    : const Text('Verify code'),
              ),
            ),
            const SizedBox(height: 10),
            TextButton(
              onPressed: notifier.resetOtpFlow,
              child: const Text('Use a different email'),
            ),
            if (notifier.otpCooldownRemaining > 0)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  'Resend code in ${notifier.otpCooldownRemaining}s',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
          ],
        ),
      );
    }

    return Form(
      child: Column(
        children: [
          AuthTextField(
            controller: notifier.emailOtpController,
            label: 'Email address',
            hintText: 'you@example.com',
            prefixIcon: Icons.email_outlined,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.done,
            autofillHints: const [AutofillHints.email],
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: (state.isSubmitting || notifier.otpCooldownRemaining > 0)
                  ? null
                  : () => notifier.sendEmailOtp(context),
              child: state.isSubmitting
                  ? SizedBox(
                      width: 20, height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Theme.of(context).colorScheme.onPrimary),
                    )
                  : const Text('Send code'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPhoneOtpForm(AuthNotifier notifier, AuthFormState state) {
    if (state.otpSent) {
      return Form(
        child: Column(
          children: [
            AuthTextField(
              controller: notifier.otpCodeController,
              label: 'Enter code',
              hintText: '123456',
              keyboardType: TextInputType.number,
              textInputAction: TextInputAction.done,
              maxLength: 6,
              textAlign: TextAlign.center,
              autofillHints: const [AutofillHints.oneTimeCode],
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: state.isSubmitting
                    ? null
                    : () => notifier.verifyPhoneOtp(context),
                child: state.isSubmitting
                    ? SizedBox(
                        width: 20, height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Theme.of(context).colorScheme.onPrimary),
                      )
                    : const Text('Verify code'),
              ),
            ),
            const SizedBox(height: 10),
            TextButton(
              onPressed: notifier.resetOtpFlow,
              child: const Text('Use a different number'),
            ),
            if (notifier.otpCooldownRemaining > 0)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  'Resend code in ${notifier.otpCooldownRemaining}s',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
          ],
        ),
      );
    }

    return Form(
      child: Column(
        children: [
          AuthTextField(
            controller: notifier.phoneController,
            label: 'Phone number',
            hintText: '+91 98765 43210',
            prefixIcon: Icons.phone_rounded,
            keyboardType: TextInputType.phone,
            textInputAction: TextInputAction.done,
            autofillHints: const [AutofillHints.telephoneNumber],
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: (state.isSubmitting || notifier.otpCooldownRemaining > 0)
                  ? null
                  : () => notifier.sendPhoneOtp(context),
              child: state.isSubmitting
                  ? SizedBox(
                      width: 20, height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Theme.of(context).colorScheme.onPrimary),
                    )
                  : const Text('Send code'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPasswordForm(AuthNotifier notifier, AuthFormState state) {
    return Form(
      child: Column(
        children: [
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
            textInputAction: TextInputAction.done,
            autofillHints: const [AutofillHints.password],
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: state.isSubmitting
                  ? null
                  : () => notifier.signInWithPassword(context),
              child: state.isSubmitting
                  ? SizedBox(
                      width: 20, height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Theme.of(context).colorScheme.onPrimary),
                    )
                  : const Text('Sign in'),
            ),
          ),
          const SizedBox(height: 8),
          TextButton(
            onPressed: () => context.push(AppRoutes.forgotPassword),
            child: const Text('Forgot password?'),
          ),
        ],
      ),
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
