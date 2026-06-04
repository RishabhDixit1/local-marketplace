import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/design_tokens.dart';
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
      begin: const Offset(0, 0.08),
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

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => context.pop(),
        ),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFFF7F8F4), Color(0xFFE6F7F4), Color(0xFFFFF7E8)],
            begin: Alignment.topCenter,
            end: Alignment.bottomRight,
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              physics: const BouncingScrollPhysics(),
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
              child: FadeTransition(
                opacity: _fadeAnimation,
                child: SlideTransition(
                  position: _slideAnimation,
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

                      _buildSignUpForm(notifier, state),
                      const SizedBox(height: 20),

                      const AuthDivider(),
                      const SizedBox(height: 20),

                      _buildSocialSection(notifier, state),
                      const SizedBox(height: 32),

                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            'Already have an account? ',
                            style: Theme.of(context)
                                .textTheme
                                .bodyMedium
                                ?.copyWith(color: AppColors.inkFaint),
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
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSignUpForm(AuthNotifier notifier, AuthFormState state) {
    final theme = Theme.of(context);
    return Form(
      child: Column(
        children: [
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
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.inkStrong,
                foregroundColor: Colors.white,
                disabledBackgroundColor: AppColors.surfacePressed,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppRadii.md),
                ),
              ),
              child: state.isSubmitting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : Text(
                      'Create account',
                      style: theme.textTheme.labelLarge?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
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

class _MessageBanner extends StatelessWidget {
  const _MessageBanner({
    required this.message,
    required this.isError,
  });

  final String message;
  final bool isError;

  @override
  Widget build(BuildContext context) {
    final color = isError ? AppColors.danger : AppColors.success;
    final bgColor = isError ? AppColors.dangerSoft : AppColors.successSoft;
    final icon = isError
        ? Icons.error_outline_rounded
        : Icons.check_circle_rounded;

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
