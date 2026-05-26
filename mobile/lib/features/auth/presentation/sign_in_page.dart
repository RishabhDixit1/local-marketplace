import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/mobile_auth_service.dart';
import '../../../core/services/analytics_service.dart';
import '../../../core/supabase/app_bootstrap.dart';
import '../../../core/theme/app_theme.dart';
import '../data/onboarding_handoff.dart';
import '../../../shared/components/premium_primitives.dart';

enum _PasswordAuthMode { signIn, signUp }

extension _UserIntentContent on MobileOnboardingIntent {
  String get subtitle {
    return switch (this) {
      MobileOnboardingIntent.findHelp =>
        'Post a need and compare trusted responses.',
      MobileOnboardingIntent.earnNearby =>
        'See nearby work, quotes, and leads.',
      MobileOnboardingIntent.businessSetup =>
        'Launch listings with guided AI setup.',
    };
  }

  IconData get icon {
    return switch (this) {
      MobileOnboardingIntent.findHelp => Icons.search_rounded,
      MobileOnboardingIntent.earnNearby => Icons.work_outline_rounded,
      MobileOnboardingIntent.businessSetup => Icons.auto_awesome_rounded,
    };
  }

  Color get color {
    return switch (this) {
      MobileOnboardingIntent.findHelp => AppColors.primary,
      MobileOnboardingIntent.earnNearby => AppColors.warm,
      MobileOnboardingIntent.businessSetup => AppColors.accent,
    };
  }

  Gradient get gradient {
    return switch (this) {
      MobileOnboardingIntent.findHelp => LinearGradient(
        colors: [AppColors.primary, AppColors.primaryDeep],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      MobileOnboardingIntent.earnNearby => LinearGradient(
        colors: [AppColors.warm, AppColors.warmDeep],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      MobileOnboardingIntent.businessSetup => LinearGradient(
        colors: [AppColors.accent, AppColors.accentDeep],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
    };
  }
}

class SignInPage extends ConsumerStatefulWidget {
  const SignInPage({super.key});

  @override
  ConsumerState<SignInPage> createState() => _SignInPageState();
}

class _SignInPageState extends ConsumerState<SignInPage> {
  final _emailFormKey = GlobalKey<FormState>();
  final _otpFormKey = GlobalKey<FormState>();
  final _passwordFormKey = GlobalKey<FormState>();

  final _emailController = TextEditingController();
  final _otpController = TextEditingController();
  final _passwordEmailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  _PasswordAuthMode _passwordMode = _PasswordAuthMode.signIn;
  String? _otpEmail;

  bool _emailCodeSubmitting = false;
  String? _emailCodeStatus;
  String? _emailCodeError;

  bool _magicLinkSubmitting = false;
  String? _magicLinkStatus;
  String? _magicLinkError;

  bool _googleSubmitting = false;
  String? _googleStatus;
  String? _googleError;

  bool _passwordSubmitting = false;
  String? _passwordStatus;
  String? _passwordError;
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;

  @override
  void dispose() {
    _emailController.dispose();
    _otpController.dispose();
    _passwordEmailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  String? _validateEmail(String? value) {
    final email = value?.trim() ?? '';
    if (email.isEmpty) return 'Enter an email address.';
    final pattern = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');
    if (!pattern.hasMatch(email)) return 'Enter a valid email address.';
    return null;
  }

  String? _validateOtp(String? value) {
    final token = value?.trim() ?? '';
    if (token.isEmpty) return 'Enter the 8-digit code from your email.';
    if (!RegExp(r'^\d{8}$').hasMatch(token)) {
      return 'Use the 8-digit code from your email.';
    }
    return null;
  }

  String? _validatePassword(String? value) {
    final password = value ?? '';
    if (password.length < 8) return 'Use at least 8 characters.';
    final hasLetter = RegExp(r'[A-Za-z]').hasMatch(password);
    final hasNumber = RegExp(r'\d').hasMatch(password);
    if (!hasLetter || !hasNumber) {
      return 'Use letters and at least one number.';
    }
    return null;
  }

  String? _validatePasswordConfirmation(String? value) {
    if (_passwordMode == _PasswordAuthMode.signIn) return null;
    if ((value ?? '').isEmpty) return 'Re-enter the password.';
    if (value != _passwordController.text) return 'Passwords do not match.';
    return null;
  }

  Future<void> _prepareAuthMethod(MobileAuthMethod method) async {
    final handoff = ref.read(onboardingHandoffControllerProvider);
    await handoff.prepareForAuth(method);
    ref.read(analyticsServiceProvider).trackEvent(
      'mobile_auth_method_chosen',
      extras: handoff.analyticsExtras(method: method),
    );
  }

  Future<void> _sendEmailCode() async {
    if (!_emailFormKey.currentState!.validate()) return;
    final authService = ref.read(mobileAuthServiceProvider);
    final email = _emailController.text.trim();
    FocusScope.of(context).unfocus();
    await _prepareAuthMethod(MobileAuthMethod.emailCode);
    setState(() {
      _emailCodeSubmitting = true;
      _emailCodeError = null;
      _emailCodeStatus = null;
      _magicLinkError = null;
      _magicLinkStatus = null;
    });

    try {
      await authService.sendEmailCode(email);
      if (!mounted) return;
      setState(() {
        _otpEmail = email;
        _otpController.clear();
        _emailCodeStatus = 'Code sent to $email';
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _emailCodeError = authService.friendlyErrorMessage(
          error,
          fallbackPrefix: 'Unable to send email code',
        );
      });
      unawaited(
        ref.read(onboardingHandoffControllerProvider)
            .completeAuthHandoff(clearStoredRoute: false),
      );
    } finally {
      if (mounted) setState(() => _emailCodeSubmitting = false);
    }
  }

  Future<void> _sendMagicLink() async {
    if (!_emailFormKey.currentState!.validate()) return;
    final authService = ref.read(mobileAuthServiceProvider);
    final email = _emailController.text.trim();
    FocusScope.of(context).unfocus();
    await _prepareAuthMethod(MobileAuthMethod.magicLink);
    setState(() {
      _magicLinkSubmitting = true;
      _magicLinkError = null;
      _magicLinkStatus = null;
      _emailCodeError = null;
    });

    try {
      final resolvedRedirect = await authService.sendMagicLink(email);
      if (!mounted) return;
      setState(() {
        _magicLinkStatus = resolvedRedirect;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _magicLinkError = authService.friendlyErrorMessage(
          error,
          fallbackPrefix: 'Unable to send magic link',
        );
      });
      unawaited(
        ref.read(onboardingHandoffControllerProvider)
            .completeAuthHandoff(clearStoredRoute: false),
      );
    } finally {
      if (mounted) setState(() => _magicLinkSubmitting = false);
    }
  }

  Future<void> _verifyEmailCode() async {
    if (!_otpFormKey.currentState!.validate()) return;
    final otpEmail = _otpEmail;
    if (otpEmail == null) {
      setState(() {
        _emailCodeError = 'Send a code first, then enter it here.';
        _emailCodeStatus = null;
      });
      return;
    }

    final authService = ref.read(mobileAuthServiceProvider);
    FocusScope.of(context).unfocus();
    setState(() {
      _emailCodeSubmitting = true;
      _emailCodeError = null;
      _emailCodeStatus = null;
    });

    try {
      await authService.verifyEmailCode(
        email: otpEmail,
        code: _otpController.text.trim(),
      );
      if (!mounted) return;
      setState(() => _emailCodeStatus = 'Signed in. Redirecting...');
      context.go(
        ref.read(onboardingHandoffControllerProvider).postAuthDestination,
      );
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _emailCodeError = authService.friendlyErrorMessage(
          error,
          fallbackPrefix: 'Unable to verify email code',
        );
      });
    } finally {
      if (mounted) setState(() => _emailCodeSubmitting = false);
    }
  }

  Future<void> _startGoogleSignIn() async {
    final authService = ref.read(mobileAuthServiceProvider);
    FocusScope.of(context).unfocus();
    await _prepareAuthMethod(MobileAuthMethod.google);
    setState(() {
      _googleSubmitting = true;
      _googleError = null;
      _googleStatus = null;
    });

    try {
      await authService.signInWithGoogle();
      if (!mounted) return;
      setState(() => _googleStatus = 'Google sign-in opened in your browser.');
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _googleError = authService.friendlyErrorMessage(
          error,
          fallbackPrefix: 'Unable to start Google sign-in',
        );
      });
      unawaited(
        ref.read(onboardingHandoffControllerProvider)
            .completeAuthHandoff(clearStoredRoute: false),
      );
    } finally {
      if (mounted) setState(() => _googleSubmitting = false);
    }
  }

  Future<void> _submitPasswordAuth() async {
    if (!_passwordFormKey.currentState!.validate()) return;
    final authService = ref.read(mobileAuthServiceProvider);
    final email = _passwordEmailController.text.trim();
    final password = _passwordController.text;
    FocusScope.of(context).unfocus();
    await _prepareAuthMethod(
      _passwordMode == _PasswordAuthMode.signIn
          ? MobileAuthMethod.password
          : MobileAuthMethod.passwordSignUp,
    );

    setState(() {
      _passwordSubmitting = true;
      _passwordError = null;
      _passwordStatus = null;
    });

    try {
      if (_passwordMode == _PasswordAuthMode.signIn) {
        await authService.signInWithPassword(email: email, password: password);
        if (!mounted) return;
        setState(() => _passwordStatus = 'Signed in. Redirecting...');
        context.go(
          ref.read(onboardingHandoffControllerProvider).postAuthDestination,
        );
      } else {
        final response = await authService.signUpWithPassword(
          email: email,
          password: password,
        );
        if (!mounted) return;
        _passwordController.clear();
        _confirmPasswordController.clear();
        setState(() {
          _passwordStatus = response.session != null
              ? 'Account created. Redirecting...'
              : 'Account created. Check your email to confirm it.';
        });
        if (response.session != null) {
          context.go(
            ref.read(onboardingHandoffControllerProvider).postAuthDestination,
          );
        }
      }
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _passwordError = authService.friendlyErrorMessage(
          error,
          fallbackPrefix: _passwordMode == _PasswordAuthMode.signIn
              ? 'Unable to sign in with password'
              : 'Unable to create password account',
        );
      });
      unawaited(
        ref.read(onboardingHandoffControllerProvider)
            .completeAuthHandoff(clearStoredRoute: false),
      );
    } finally {
      if (mounted) setState(() => _passwordSubmitting = false);
    }
  }

  void _showForgotPasswordSheet() {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (_) => _ForgotPasswordSheet(
        authService: ref.read(mobileAuthServiceProvider),
      ),
    );
  }

  void _clearOtpFlow() {
    setState(() {
      _otpEmail = null;
      _otpController.clear();
      _emailCodeStatus = null;
      _emailCodeError = null;
      _magicLinkStatus = null;
      _magicLinkError = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final bootstrap = ref.watch(appBootstrapProvider);
    final handoff = ref.watch(onboardingHandoffControllerProvider);

    return Scaffold(
      body: PremiumScaffold(
        padding: EdgeInsets.zero,
        child: Stack(
          children: [
            _AnimatedBackground(),
            SafeArea(
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final compact = constraints.maxWidth < AppBreakpoints.compact;
                  final horizontal = compact ? 16.0 : 24.0;

                  return ListView(
                    physics: const BouncingScrollPhysics(),
                    padding: EdgeInsets.fromLTRB(
                      horizontal,
                      compact ? 12 : 20,
                      horizontal,
                      40,
                    ),
                    children: [
                      _buildHeader(compact: compact),
                      SizedBox(height: compact ? 20 : 28),
                      if (handoff.hasStoredHandoff) ...[
                        _ResumeOnboardingCard(handoff: handoff),
                        SizedBox(height: compact ? 14 : 18),
                      ],
                      _buildIntentSection(compact: compact, handoff: handoff),
                      SizedBox(height: compact ? 18 : 24),
                      _buildAuthCard(compact: compact, handoff: handoff),
                      SizedBox(height: compact ? 18 : 24),
                      _buildGoogleCard(compact: compact),
                      SizedBox(height: compact ? 18 : 24),
                      _buildPasswordCard(compact: compact),
                      SizedBox(height: compact ? 18 : 24),
                      _buildTrustStrip(),
                      SizedBox(height: compact ? 18 : 24),
                      _CallbackPanel(
                        callbackUrl: bootstrap.config.magicLinkRedirectUrl,
                      ),
                      SizedBox(height: 16),
                      Text(
                        'ServiQ mobile uses the same account as the web app.',
                        textAlign: TextAlign.center,
                        style: Theme.of(context)
                            .textTheme
                            .bodySmall
                            ?.copyWith(color: AppColors.inkFaint),
                      ),
                      SizedBox(height: 24),
                    ],
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader({required bool compact}) {
    final theme = Theme.of(context);
    return Column(
      children: [
        SizedBox(height: compact ? 4 : 8),
        ServiqBrandLockup(
          compact: compact,
          foregroundColor: AppColors.ink,
          subtleColor: AppColors.inkFaint,
        ),
        SizedBox(height: compact ? 14 : 20),
        Text(
          'Your local marketplace',
          style: theme.textTheme.headlineMedium?.copyWith(
            fontSize: compact ? 22 : 26,
          ),
        ),
        SizedBox(height: compact ? 4 : 6),
        Padding(
          padding: EdgeInsets.symmetric(horizontal: compact ? 8 : 24),
          child: Text(
            'Choose how you want to use ServiQ, then sign in with your email.',
            textAlign: TextAlign.center,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: AppColors.inkFaint,
              height: 1.4,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildIntentSection({
    required bool compact,
    required OnboardingHandoffController handoff,
  }) {
    final selectedIntent = handoff.selectedIntent;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsets.only(bottom: compact ? 10 : 14),
          child: Text(
            'I want to...',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: AppColors.ink,
            ),
          ),
        ),
        ...List.generate(MobileOnboardingIntent.values.length, (i) {
          final intent = MobileOnboardingIntent.values[i];
          final isSelected = selectedIntent == intent;
          return Padding(
            padding: EdgeInsets.only(bottom: i < MobileOnboardingIntent.values.length - 1 ? 8 : 0),
            child: _buildIntentCard(
              intent: intent,
              isSelected: isSelected,
              onTap: () {
                unawaited(handoff.selectIntent(intent));
                setState(() {});
                ref.read(analyticsServiceProvider).trackEvent(
                  'mobile_onboarding_intent_selected',
                  extras: handoff.analyticsExtras(),
                );
              },
            ),
          );
        }),
      ],
    );
  }

  Widget _buildIntentCard({
    required MobileOnboardingIntent intent,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    final theme = Theme.of(context);
    return AnimatedContainer(
      duration: const Duration(milliseconds: 250),
      curve: Curves.easeOutCubic,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(
          color: isSelected ? intent.color : AppColors.border,
          width: isSelected ? 1.5 : 1,
        ),
        boxShadow: isSelected ? [
          BoxShadow(
            color: intent.color.withValues(alpha: 0.15),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ] : [],
      ),
      child: Material(
        color: isSelected
            ? intent.color.withValues(alpha: 0.06)
            : AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(AppRadii.lg),
          child: AnimatedPadding(
            duration: const Duration(milliseconds: 200),
            padding: EdgeInsets.all(isSelected ? 14 : 12),
            child: Row(
              children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 250),
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    gradient: isSelected ? intent.gradient : null,
                    color: isSelected ? null : intent.color.withValues(alpha: 0.10),
                    borderRadius: BorderRadius.circular(AppRadii.md),
                  ),
                  child: Icon(
                    intent.icon,
                    color: isSelected ? Colors.white : intent.color,
                    size: 20,
                  ),
                ),
                SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        intent.title,
                        style: theme.textTheme.labelLarge?.copyWith(
                          color: AppColors.ink,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      SizedBox(height: 2),
                      Text(
                        intent.subtitle,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: AppColors.inkFaint,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
                AnimatedContainer(
                  duration: const Duration(milliseconds: 250),
                  width: 22,
                  height: 22,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: isSelected ? intent.color : Colors.transparent,
                    border: Border.all(
                      color: isSelected ? intent.color : AppColors.border,
                      width: isSelected ? 0 : 2,
                    ),
                  ),
                  child: isSelected
                      ? const Icon(Icons.check, size: 14, color: Colors.white)
                      : null,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildAuthCard({
    required bool compact,
    required OnboardingHandoffController handoff,
  }) {
    final theme = Theme.of(context);
    final selectedIntent = handoff.selectedIntent;

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(color: AppColors.border),
        boxShadow: AppShadows.card,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: EdgeInsets.fromLTRB(
              compact ? 14 : 20,
              compact ? 14 : 18,
              compact ? 14 : 20,
              compact ? 10 : 14,
            ),
            decoration: BoxDecoration(
              border: Border(
                bottom: BorderSide(color: AppColors.border),
              ),
            ),
            child: Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    gradient: selectedIntent.gradient,
                    borderRadius: BorderRadius.circular(AppRadii.sm),
                  ),
                  child: Icon(
                    selectedIntent.icon,
                    color: Colors.white,
                    size: 18,
                  ),
                ),
                SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Sign in with email',
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      Text(
                        'Secure code sent to your inbox',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: AppColors.inkFaint,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: EdgeInsets.all(compact ? 14 : 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(height: compact ? 14 : 18),
                Form(
                  key: _emailFormKey,
                  child: TextFormField(
                    controller: _emailController,
                    enabled: _otpEmail == null &&
                        !_emailCodeSubmitting &&
                        !_magicLinkSubmitting,
                    keyboardType: TextInputType.emailAddress,
                    textInputAction: TextInputAction.send,
                    autofillHints: const [AutofillHints.email],
                    style: theme.textTheme.bodyLarge?.copyWith(
                      color: AppColors.ink,
                      fontWeight: FontWeight.w600,
                    ),
                    decoration: InputDecoration(
                      labelText: 'Email address',
                      hintText: 'you@example.com',
                      prefixIcon: Icon(
                        Icons.email_outlined,
                        color: AppColors.inkFaint,
                        size: 20,
                      ),
                      filled: true,
                      fillColor: AppColors.surfaceAlt,
                      contentPadding: EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: compact ? 14 : 16,
                      ),
                    ),
                    validator: _validateEmail,
                    onFieldSubmitted: (_) => _sendEmailCode(),
                  ),
                ),
                SizedBox(height: compact ? 12 : 14),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: _emailCodeSubmitting ? null : _sendEmailCode,
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.inkStrong,
                      foregroundColor: Colors.white,
                      disabledBackgroundColor: AppColors.surfacePressed,
                      padding: EdgeInsets.symmetric(
                        vertical: compact ? 14 : 15,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(AppRadii.md),
                      ),
                    ),
                    icon: _emailCodeSubmitting
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : Icon(
                            Icons.mark_email_read_rounded,
                            size: 20,
                          ),
                    label: Text(
                      _emailCodeSubmitting
                          ? 'Sending...'
                          : _otpEmail == null
                              ? 'Send email code'
                              : 'Resend code',
                      style: theme.textTheme.labelLarge?.copyWith(
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),
                SizedBox(height: 8),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: _magicLinkSubmitting || _emailCodeSubmitting
                        ? null
                        : _sendMagicLink,
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.accentDeep,
                      side: BorderSide(color: AppColors.accentSoft),
                      padding: EdgeInsets.symmetric(
                        vertical: compact ? 13 : 14,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(AppRadii.md),
                      ),
                    ),
                    icon: _magicLinkSubmitting
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.link_rounded, size: 20),
                    label: Text(
                      _magicLinkSubmitting
                          ? 'Sending link...'
                          : 'Send magic link instead',
                    ),
                  ),
                ),
                if (_otpEmail != null) ...[
                  SizedBox(height: compact ? 16 : 18),
                  Container(
                    width: double.infinity,
                    padding: EdgeInsets.all(compact ? 12 : 14),
                    decoration: BoxDecoration(
                      color: AppColors.successSoft,
                      borderRadius: BorderRadius.circular(AppRadii.md),
                      border: Border.all(
                        color: AppColors.success.withValues(alpha: 0.2),
                      ),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          Icons.check_circle_rounded,
                          color: AppColors.success,
                          size: 18,
                        ),
                        SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Code sent to $_otpEmail',
                            style: theme.textTheme.bodyMedium?.copyWith(
                              color: AppColors.success,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  SizedBox(height: compact ? 14 : 16),
                  Form(
                    key: _otpFormKey,
                    child: TextFormField(
                      controller: _otpController,
                      keyboardType: TextInputType.number,
                      textInputAction: TextInputAction.done,
                      autofillHints: const [AutofillHints.oneTimeCode],
                      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                      maxLength: 8,
                      style: theme.textTheme.headlineSmall?.copyWith(
                        letterSpacing: 4,
                        color: AppColors.ink,
                      ),
                      textAlign: TextAlign.center,
                      decoration: InputDecoration(
                        labelText: '8-digit code',
                        hintText: '12345678',
                        counterText: '',
                        filled: true,
                        fillColor: AppColors.surfaceAlt,
                        contentPadding: EdgeInsets.symmetric(
                          vertical: compact ? 14 : 18,
                        ),
                      ),
                      validator: _validateOtp,
                      onFieldSubmitted: (_) => _verifyEmailCode(),
                    ),
                  ),
                  SizedBox(height: compact ? 12 : 14),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: _emailCodeSubmitting ? null : _verifyEmailCode,
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        padding: EdgeInsets.symmetric(
                          vertical: compact ? 14 : 15,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(AppRadii.md),
                        ),
                      ),
                      child: Text(
                        _emailCodeSubmitting
                            ? 'Verifying...'
                            : 'Verify code',
                        style: theme.textTheme.labelLarge?.copyWith(
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
                  SizedBox(height: 6),
                  Center(
                    child: TextButton(
                      onPressed: _emailCodeSubmitting ? null : _clearOtpFlow,
                      child: Text(
                        'Use a different email',
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: AppColors.inkFaint,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                ],
                _AuthMessage(
                  successMessage: _emailCodeStatus,
                  errorMessage: _emailCodeError,
                ),
                _AuthMessage(
                  successMessage: _magicLinkStatus,
                  errorMessage: _magicLinkError,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildGoogleCard({required bool compact}) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(color: AppColors.border),
        boxShadow: AppShadows.card,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: EdgeInsets.fromLTRB(
              compact ? 14 : 20,
              compact ? 14 : 18,
              compact ? 14 : 20,
              compact ? 10 : 14,
            ),
            decoration: BoxDecoration(
              border: Border(
                bottom: BorderSide(color: AppColors.border),
              ),
            ),
            child: Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: AppColors.accentSoft,
                    borderRadius: BorderRadius.circular(AppRadii.sm),
                  ),
                  child: Icon(
                    Icons.open_in_new_rounded,
                    color: AppColors.accent,
                    size: 18,
                  ),
                ),
                SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Continue with Google',
                        style: Theme.of(context)
                            .textTheme
                            .titleMedium
                            ?.copyWith(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                            ),
                      ),
                      Text(
                        'One tap if you already have a Google account',
                        style: Theme.of(context)
                            .textTheme
                            .bodySmall
                            ?.copyWith(
                              color: AppColors.inkFaint,
                              fontWeight: FontWeight.w500,
                            ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: EdgeInsets.all(compact ? 14 : 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: _googleSubmitting ? null : _startGoogleSignIn,
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.ink,
                      side: BorderSide(color: AppColors.border),
                      padding: EdgeInsets.symmetric(
                        vertical: compact ? 13 : 14,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(AppRadii.md),
                      ),
                    ),
                    icon: _googleSubmitting
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.open_in_new_rounded, size: 20),
                    label: Text(
                      _googleSubmitting
                          ? 'Opening Google...'
                          : 'Continue with Google',
                    ),
                  ),
                ),
                _AuthMessage(
                  successMessage: _googleStatus,
                  errorMessage: _googleError,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPasswordCard({required bool compact}) {
    final theme = Theme.of(context);
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(color: AppColors.border),
        boxShadow: AppShadows.card,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: EdgeInsets.fromLTRB(
              compact ? 14 : 20,
              compact ? 14 : 18,
              compact ? 14 : 20,
              compact ? 10 : 14,
            ),
            decoration: BoxDecoration(
              border: Border(
                bottom: BorderSide(color: AppColors.border),
              ),
            ),
            child: Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: AppColors.warmSoft,
                    borderRadius: BorderRadius.circular(AppRadii.sm),
                  ),
                  child: Icon(
                    Icons.lock_outline_rounded,
                    color: AppColors.warm,
                    size: 18,
                  ),
                ),
                SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Email + password',
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      Text(
                        'For existing accounts with a password set',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: AppColors.inkFaint,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: EdgeInsets.all(compact ? 14 : 20),
            child: Form(
              key: _passwordFormKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    spacing: 8,
                    runSpacing: 6,
                    children: [
                      _PasswordModeChip(
                        label: 'Sign in',
                        selected: _passwordMode == _PasswordAuthMode.signIn,
                        onTap: _passwordSubmitting ? null : () {
                          setState(() {
                            _passwordMode = _PasswordAuthMode.signIn;
                            _passwordStatus = null;
                            _passwordError = null;
                          });
                        },
                      ),
                      _PasswordModeChip(
                        label: 'Create account',
                        selected: _passwordMode == _PasswordAuthMode.signUp,
                        onTap: _passwordSubmitting ? null : () {
                          setState(() {
                            _passwordMode = _PasswordAuthMode.signUp;
                            _passwordStatus = null;
                            _passwordError = null;
                          });
                        },
                      ),
                    ],
                  ),
                  SizedBox(height: compact ? 14 : 16),
                  TextFormField(
                    controller: _passwordEmailController,
                    keyboardType: TextInputType.emailAddress,
                    textInputAction: TextInputAction.next,
                    autofillHints: const [AutofillHints.username],
                    style: theme.textTheme.bodyLarge?.copyWith(
                      color: AppColors.ink,
                      fontWeight: FontWeight.w600,
                    ),
                    decoration: InputDecoration(
                      labelText: 'Email address',
                      hintText: 'you@example.com',
                      prefixIcon: Icon(
                        Icons.email_outlined,
                        color: AppColors.inkFaint,
                        size: 20,
                      ),
                      filled: true,
                      fillColor: AppColors.surfaceAlt,
                      contentPadding: EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: compact ? 14 : 16,
                      ),
                    ),
                    validator: _validateEmail,
                  ),
                  SizedBox(height: compact ? 10 : 12),
                  TextFormField(
                    controller: _passwordController,
                    obscureText: _obscurePassword,
                    textInputAction: _passwordMode == _PasswordAuthMode.signIn
                        ? TextInputAction.done
                        : TextInputAction.next,
                    autofillHints: [
                      _passwordMode == _PasswordAuthMode.signIn
                          ? AutofillHints.password
                          : AutofillHints.newPassword,
                    ],
                    style: theme.textTheme.bodyLarge?.copyWith(
                      color: AppColors.ink,
                      fontWeight: FontWeight.w600,
                    ),
                    decoration: InputDecoration(
                      labelText: 'Password',
                      prefixIcon: Icon(
                        Icons.lock_outline_rounded,
                        color: AppColors.inkFaint,
                        size: 20,
                      ),
                      suffixIcon: IconButton(
                        onPressed: () => setState(() {
                          _obscurePassword = !_obscurePassword;
                        }),
                        icon: Icon(
                          _obscurePassword
                              ? Icons.visibility_off_rounded
                              : Icons.visibility_rounded,
                          size: 20,
                        ),
                      ),
                      filled: true,
                      fillColor: AppColors.surfaceAlt,
                      contentPadding: EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: compact ? 14 : 16,
                      ),
                    ),
                    validator: _validatePassword,
                    onFieldSubmitted: (_) {
                      if (_passwordMode == _PasswordAuthMode.signIn) {
                        _submitPasswordAuth();
                      }
                    },
                  ),
                  if (_passwordMode == _PasswordAuthMode.signIn)
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton(
                        onPressed: _passwordSubmitting
                            ? null
                            : _showForgotPasswordSheet,
                        style: TextButton.styleFrom(
                          padding: EdgeInsets.symmetric(
                            horizontal: 4,
                            vertical: 8,
                          ),
                        ),
                        child: Text(
                          'Forgot password?',
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: AppColors.accentDeep,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                  if (_passwordMode == _PasswordAuthMode.signUp) ...[
                    SizedBox(height: compact ? 10 : 12),
                    TextFormField(
                      controller: _confirmPasswordController,
                      obscureText: _obscureConfirmPassword,
                      textInputAction: TextInputAction.done,
                      autofillHints: const [AutofillHints.newPassword],
                      style: theme.textTheme.bodyLarge?.copyWith(
                        color: AppColors.ink,
                        fontWeight: FontWeight.w600,
                      ),
                      decoration: InputDecoration(
                        labelText: 'Confirm password',
                        prefixIcon: Icon(
                          Icons.lock_outline_rounded,
                          color: AppColors.inkFaint,
                          size: 20,
                        ),
                        suffixIcon: IconButton(
                          onPressed: () => setState(() {
                            _obscureConfirmPassword = !_obscureConfirmPassword;
                          }),
                          icon: Icon(
                            _obscureConfirmPassword
                                ? Icons.visibility_off_rounded
                                : Icons.visibility_rounded,
                            size: 20,
                          ),
                        ),
                        filled: true,
                        fillColor: AppColors.surfaceAlt,
                        contentPadding: EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: compact ? 14 : 16,
                        ),
                      ),
                      validator: _validatePasswordConfirmation,
                      onFieldSubmitted: (_) => _submitPasswordAuth(),
                    ),
                  ],
                  SizedBox(height: compact ? 14 : 16),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: _passwordSubmitting ? null : _submitPasswordAuth,
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.inkStrong,
                        foregroundColor: Colors.white,
                        disabledBackgroundColor: AppColors.surfacePressed,
                        padding: EdgeInsets.symmetric(
                          vertical: compact ? 14 : 15,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(AppRadii.md),
                        ),
                      ),
                      icon: _passwordSubmitting
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : Icon(
                              _passwordMode == _PasswordAuthMode.signIn
                                  ? Icons.login_rounded
                                  : Icons.person_add_alt_1_rounded,
                              size: 20,
                            ),
                      label: Text(
                        _passwordSubmitting
                            ? 'Working...'
                            : _passwordMode == _PasswordAuthMode.signIn
                                ? 'Sign in with password'
                                : 'Create account',
                      ),
                    ),
                  ),
                  _AuthMessage(
                    successMessage: _passwordStatus,
                    errorMessage: _passwordError,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTrustStrip() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.inkStrong,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(color: AppColors.inkStrong),
        boxShadow: AppShadows.card,
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(AppRadii.sm),
                ),
                child: Icon(
                  Icons.verified_user_outlined,
                  color: Colors.white.withValues(alpha: 0.8),
                  size: 16,
                ),
              ),
              SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Protected by account verification',
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    SizedBox(height: 1),
                    Text(
                      'Email, profile readiness, and trust status carry across web and mobile.',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Colors.white.withValues(alpha: 0.6),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          SizedBox(height: 10),
          Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(AppRadii.sm),
                ),
                child: Icon(
                  Icons.location_searching_rounded,
                  color: Colors.white.withValues(alpha: 0.8),
                  size: 16,
                ),
              ),
              SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Private until you choose to act',
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    SizedBox(height: 1),
                    Text(
                      'Location and provider details stay scoped to marketplace workflows.',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Colors.white.withValues(alpha: 0.6),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ResumeOnboardingCard extends StatelessWidget {
  const _ResumeOnboardingCard({required this.handoff});

  final OnboardingHandoffController handoff;

  @override
  Widget build(BuildContext context) {
    final intent = handoff.selectedIntent;
    final theme = Theme.of(context);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.inkStrong,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(color: AppColors.inkStrong),
        boxShadow: AppShadows.card,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.10),
              borderRadius: BorderRadius.circular(AppRadii.md),
            ),
            child: Icon(intent.icon, color: Colors.white, size: 18),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Continue where you left off',
                  style: theme.textTheme.labelMedium?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '${intent.title} -> ${intent.destinationLabel}',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: Colors.white.withValues(alpha: 0.65),
                    fontWeight: FontWeight.w600,
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

class _PasswordModeChip extends StatelessWidget {
  const _PasswordModeChip({
    required this.label,
    required this.selected,
    this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? AppColors.primarySoft : AppColors.surfaceAlt,
          borderRadius: BorderRadius.circular(AppRadii.pill),
          border: Border.all(
            color: selected ? AppColors.primary : AppColors.border,
          ),
        ),
        child: Text(
          label,
          style: Theme.of(context).textTheme.labelMedium?.copyWith(
            color: selected ? AppColors.primaryDeep : AppColors.inkSubtle,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}

class _AnimatedBackground extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      height: double.infinity,
      decoration: BoxDecoration(
        gradient: ServiqThemeTokens.light.authGradient,
      ),
      child: Stack(
        children: [
          Positioned(
            top: -20,
            right: -40,
            child: _buildBlob(160, AppColors.primary.withValues(alpha: 0.06)),
          ),
          Positioned(
            top: 80,
            left: -30,
            child: _buildBlob(120, AppColors.accent.withValues(alpha: 0.05)),
          ),
          Positioned(
            bottom: 80,
            right: 10,
            child: _buildBlob(100, AppColors.warm.withValues(alpha: 0.04)),
          ),
        ],
      ),
    );
  }

  Widget _buildBlob(double size, Color color) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: color,
      ),
    );
  }
}

class _CallbackPanel extends StatelessWidget {
  const _CallbackPanel({required this.callbackUrl});

  final String callbackUrl;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadii.md),
        border: Border.all(color: AppColors.border),
      ),
      child: Theme(
        data: theme.copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          tilePadding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.xs,
          ),
          childrenPadding: const EdgeInsets.fromLTRB(
            AppSpacing.md,
            0,
            AppSpacing.md,
            AppSpacing.md,
          ),
          leading: Icon(Icons.route_outlined, color: AppColors.inkFaint),
          title: Text(
            'Current auth callback',
            style: theme.textTheme.titleMedium?.copyWith(
              fontSize: 14,
              fontWeight: FontWeight.w700,
            ),
          ),
          children: [
            Align(
              alignment: Alignment.centerLeft,
              child: Text(
                callbackUrl,
                style: theme.textTheme.bodyLarge?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Google OAuth, email confirmation, and deep-link auth returns should use this callback.',
              style: theme.textTheme.bodyMedium,
            ),
          ],
        ),
      ),
    );
  }
}

class _ForgotPasswordSheet extends StatefulWidget {
  const _ForgotPasswordSheet({required this.authService});

  final MobileAuthService authService;

  @override
  State<_ForgotPasswordSheet> createState() => _ForgotPasswordSheetState();
}

class _ForgotPasswordSheetState extends State<_ForgotPasswordSheet> {
  final _emailController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _submitting = false;
  bool _success = false;
  String? _error;

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  String? _validateEmail(String? value) {
    final email = value?.trim() ?? '';
    if (email.isEmpty) return 'Enter an email address.';
    final pattern = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');
    if (!pattern.hasMatch(email)) return 'Enter a valid email address.';
    return null;
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      await widget.authService.sendPasswordResetEmail(
        _emailController.text.trim(),
      );
      if (!mounted) return;
      setState(() {
        _success = true;
        _submitting = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = widget.authService.friendlyErrorMessage(
          error,
          fallbackPrefix: 'Unable to send reset link',
        );
        _submitting = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.md,
        0,
        AppSpacing.md,
        MediaQuery.of(context).viewInsets.bottom + AppSpacing.lg,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.primarySoft,
              borderRadius: BorderRadius.circular(AppRadii.md),
            ),
            child: Icon(
              Icons.lock_reset_rounded,
              color: AppColors.primary,
              size: 20,
            ),
          ),
          SizedBox(height: AppSpacing.md),
          Text('Reset your password', style: theme.textTheme.titleLarge),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Enter your email to receive a password reset link.',
            style: theme.textTheme.bodyMedium,
          ),
          const SizedBox(height: AppSpacing.md),
          if (_success)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: AppColors.successSoft,
                borderRadius: BorderRadius.circular(AppRadii.md),
                border: Border.all(
                  color: AppColors.success.withValues(alpha: 0.16),
                ),
              ),
              child: Row(
                children: [
                  Icon(Icons.check_circle_rounded, color: AppColors.success, size: 18),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Check your email for the password reset link.',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: AppColors.success,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            )
          else ...[
            Form(
              key: _formKey,
              child: TextFormField(
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.done,
                autofillHints: const [AutofillHints.email],
                style: theme.textTheme.bodyLarge?.copyWith(
                  color: AppColors.ink,
                  fontWeight: FontWeight.w600,
                ),
                decoration: InputDecoration(
                  labelText: 'Email address',
                  hintText: 'you@example.com',
                  prefixIcon: Icon(
                    Icons.email_outlined,
                    color: AppColors.inkFaint,
                    size: 20,
                  ),
                  filled: true,
                  fillColor: AppColors.surfaceAlt,
                ),
                validator: _validateEmail,
                onFieldSubmitted: (_) => _submit(),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _submitting ? null : _submit,
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.inkStrong,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppRadii.md),
                  ),
                ),
                child: Text(
                  _submitting ? 'Sending...' : 'Send reset link',
                  style: theme.textTheme.labelLarge?.copyWith(
                    color: Colors.white,
                  ),
                ),
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(AppSpacing.sm),
                decoration: BoxDecoration(
                  color: AppColors.dangerSoft,
                  borderRadius: BorderRadius.circular(AppRadii.md),
                  border: Border.all(
                    color: AppColors.danger.withValues(alpha: 0.16),
                  ),
                ),
                child: Row(
                  children: [
                    Icon(Icons.error_outline_rounded, color: AppColors.danger, size: 16),
                    SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        _error!,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: AppColors.danger,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
          const SizedBox(height: AppSpacing.md),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: () => Navigator.of(context).pop(),
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppRadii.md),
                ),
              ),
              child: const Text('Done'),
            ),
          ),
        ],
      ),
    );
  }
}

class _AuthMessage extends StatelessWidget {
  const _AuthMessage({this.successMessage, this.errorMessage});

  final String? successMessage;
  final String? errorMessage;

  @override
  Widget build(BuildContext context) {
    if (successMessage == null && errorMessage == null) {
      return const SizedBox.shrink();
    }

    final showingError = errorMessage != null;

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: AppSpacing.md),
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: showingError ? AppColors.dangerSoft : AppColors.successSoft,
        borderRadius: BorderRadius.circular(AppRadii.md),
        border: Border.all(
          color: showingError
              ? AppColors.danger.withValues(alpha: 0.16)
              : AppColors.success.withValues(alpha: 0.16),
        ),
      ),
      child: Row(
        children: [
          Icon(
            showingError ? Icons.error_outline_rounded : Icons.check_circle_rounded,
            color: showingError ? AppColors.danger : AppColors.success,
            size: 16,
          ),
          SizedBox(width: 6),
          Expanded(
            child: Text(
              errorMessage ?? successMessage ?? '',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: showingError ? AppColors.danger : AppColors.success,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
