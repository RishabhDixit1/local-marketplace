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
    if (email.isEmpty) {
      return 'Enter an email address.';
    }

    final pattern = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');
    if (!pattern.hasMatch(email)) {
      return 'Enter a valid email address.';
    }

    return null;
  }

  String? _validateOtp(String? value) {
    final token = value?.trim() ?? '';
    if (token.isEmpty) {
      return 'Enter the 8-digit code from your email.';
    }

    if (!RegExp(r'^\d{8}$').hasMatch(token)) {
      return 'Use the 8-digit code from your email.';
    }

    return null;
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
    if (_passwordMode == _PasswordAuthMode.signIn) {
      return null;
    }

    if ((value ?? '').isEmpty) {
      return 'Re-enter the password.';
    }

    if (value != _passwordController.text) {
      return 'Passwords do not match.';
    }

    return null;
  }

  Future<void> _prepareAuthMethod(MobileAuthMethod method) async {
    final handoff = ref.read(onboardingHandoffControllerProvider);
    await handoff.prepareForAuth(method);
    ref
        .read(analyticsServiceProvider)
        .trackEvent(
          'mobile_auth_method_chosen',
          extras: handoff.analyticsExtras(method: method),
        );
  }

  Future<void> _sendEmailCode() async {
    if (!_emailFormKey.currentState!.validate()) {
      return;
    }

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

      if (!mounted) {
        return;
      }

      setState(() {
        _otpEmail = email;
        _otpController.clear();
        _emailCodeStatus =
            'Code sent to $email. Enter the 8-digit code from your email to continue.';
      });
    } catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _emailCodeError = authService.friendlyErrorMessage(
          error,
          fallbackPrefix: 'Unable to send email code',
        );
      });
      unawaited(
        ref.read(onboardingHandoffControllerProvider).completeAuthHandoff(),
      );
    } finally {
      if (mounted) {
        setState(() {
          _emailCodeSubmitting = false;
        });
      }
    }
  }

  Future<void> _sendMagicLink() async {
    if (!_emailFormKey.currentState!.validate()) {
      return;
    }

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

      if (!mounted) {
        return;
      }

      setState(() {
        _magicLinkStatus =
            'Magic link sent to $email. Open it on this phone and it will return to $resolvedRedirect.';
      });
    } catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _magicLinkError = authService.friendlyErrorMessage(
          error,
          fallbackPrefix: 'Unable to send magic link',
        );
      });
      unawaited(
        ref.read(onboardingHandoffControllerProvider).completeAuthHandoff(),
      );
    } finally {
      if (mounted) {
        setState(() {
          _magicLinkSubmitting = false;
        });
      }
    }
  }

  Future<void> _verifyEmailCode() async {
    if (!_otpFormKey.currentState!.validate()) {
      return;
    }

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

      if (!mounted) {
        return;
      }

      setState(() {
        _emailCodeStatus = 'Signed in. Redirecting...';
      });
      context.go(
        ref.read(onboardingHandoffControllerProvider).postAuthDestination,
      );
    } catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _emailCodeError = authService.friendlyErrorMessage(
          error,
          fallbackPrefix: 'Unable to verify email code',
        );
      });
    } finally {
      if (mounted) {
        setState(() {
          _emailCodeSubmitting = false;
        });
      }
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

      if (!mounted) {
        return;
      }

      setState(() {
        _googleStatus =
            'Google sign-in opened in your browser. Finish there and ServiQ should return you to the app automatically.';
      });
    } catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _googleError = authService.friendlyErrorMessage(
          error,
          fallbackPrefix: 'Unable to start Google sign-in',
        );
      });
      unawaited(
        ref.read(onboardingHandoffControllerProvider).completeAuthHandoff(),
      );
    } finally {
      if (mounted) {
        setState(() {
          _googleSubmitting = false;
        });
      }
    }
  }

  Future<void> _submitPasswordAuth() async {
    if (!_passwordFormKey.currentState!.validate()) {
      return;
    }

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

        if (!mounted) {
          return;
        }

        setState(() {
          _passwordStatus = 'Signed in. Redirecting...';
        });
        context.go(
          ref.read(onboardingHandoffControllerProvider).postAuthDestination,
        );
      } else {
        final response = await authService.signUpWithPassword(
          email: email,
          password: password,
        );

        if (!mounted) {
          return;
        }

        _passwordController.clear();
        _confirmPasswordController.clear();

        setState(() {
          _passwordStatus = response.session != null
              ? 'Account created. Redirecting into ServiQ...'
              : 'Account created. Check your email to confirm it, then sign in here or use the email code above.';
        });
        if (response.session != null) {
          context.go(
            ref.read(onboardingHandoffControllerProvider).postAuthDestination,
          );
        }
      }
    } catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _passwordError = authService.friendlyErrorMessage(
          error,
          fallbackPrefix: _passwordMode == _PasswordAuthMode.signIn
              ? 'Unable to sign in with password'
              : 'Unable to create password account',
        );
      });
      unawaited(
        ref.read(onboardingHandoffControllerProvider).completeAuthHandoff(),
      );
    } finally {
      if (mounted) {
        setState(() {
          _passwordSubmitting = false;
        });
      }
    }
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
        child: SafeArea(
          child: LayoutBuilder(
            builder: (context, constraints) {
              final compact = constraints.maxWidth < AppBreakpoints.compact;
              final horizontal = compact ? 14.0 : AppSpacing.pageInset;

              return ListView(
                padding: EdgeInsets.fromLTRB(
                  horizontal,
                  compact ? AppSpacing.sm : AppSpacing.md,
                  horizontal,
                  AppSpacing.xxl,
                ),
                children: [
                  const ServiqBrandLockup(),
                  SizedBox(height: compact ? AppSpacing.md : AppSpacing.lg),
                  if (handoff.hasStoredHandoff) ...[
                    _ResumeOnboardingCard(handoff: handoff),
                    const SizedBox(height: AppSpacing.md),
                  ],
                  _buildPrimaryAccessCard(compact: compact, handoff: handoff),
                  const SizedBox(height: AppSpacing.md),
                  const _TrustStrip(),
                  const SizedBox(height: AppSpacing.md),
                  _buildGoogleCard(),
                  const SizedBox(height: AppSpacing.md),
                  _buildPasswordCard(),
                  const SizedBox(height: AppSpacing.md),
                  _CallbackPanel(
                    callbackUrl: bootstrap.config.magicLinkRedirectUrl,
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  Text(
                    'ServiQ mobile uses the same account as the web app.',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }

  Widget _buildPrimaryAccessCard({
    required bool compact,
    required OnboardingHandoffController handoff,
  }) {
    final theme = Theme.of(context);
    final selectedIntent = handoff.selectedIntent;

    return PremiumSurface(
      padding: EdgeInsets.all(compact ? AppSpacing.md : AppSpacing.lg),
      shadows: AppShadows.floating,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: const [
              PremiumPill(
                label: 'Secure access',
                icon: Icons.shield_outlined,
                backgroundColor: AppColors.primarySoft,
                foregroundColor: AppColors.primaryDeep,
                borderColor: AppColors.primarySoft,
              ),
              PremiumPill(
                label: 'Web account ready',
                icon: Icons.sync_rounded,
                backgroundColor: AppColors.accentSoft,
                foregroundColor: AppColors.accentDeep,
                borderColor: AppColors.accentSoft,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Text('Welcome to ServiQ', style: theme.textTheme.headlineMedium),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Pick your intent now. We will use it to shape where code or password sign-in lands without splitting your account.',
            style: theme.textTheme.bodyMedium,
          ),
          const SizedBox(height: AppSpacing.md),
          _IntentSelector(
            selectedIntent: selectedIntent,
            onSelected: (intent) {
              unawaited(handoff.selectIntent(intent));
              setState(() {});
              ref
                  .read(analyticsServiceProvider)
                  .trackEvent(
                    'mobile_onboarding_intent_selected',
                    extras: handoff.analyticsExtras(),
                  );
            },
          ),
          const SizedBox(height: AppSpacing.lg),
          const Divider(),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: selectedIntent.color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(AppRadii.md),
                ),
                child: Icon(selectedIntent.icon, color: selectedIntent.color),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Continue with email code',
                      style: theme.textTheme.titleLarge,
                    ),
                    const SizedBox(height: AppSpacing.xxxs),
                    Text(
                      'Recommended for new and returning users.',
                      style: theme.textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Form(
            key: _emailFormKey,
            child: TextFormField(
              controller: _emailController,
              enabled:
                  _otpEmail == null &&
                  !_emailCodeSubmitting &&
                  !_magicLinkSubmitting,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.send,
              autofillHints: const [AutofillHints.email],
              decoration: const InputDecoration(
                labelText: 'Email address',
                hintText: 'you@example.com',
              ),
              validator: _validateEmail,
              onFieldSubmitted: (_) => _sendEmailCode(),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: _emailCodeSubmitting ? null : _sendEmailCode,
              icon: _emailCodeSubmitting
                  ? const _ButtonSpinner()
                  : const Icon(Icons.mark_email_read_rounded),
              label: _ButtonText(
                _emailCodeSubmitting
                    ? 'Sending...'
                    : _otpEmail == null
                    ? 'Send email code'
                    : 'Resend code',
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: _magicLinkSubmitting || _emailCodeSubmitting
                  ? null
                  : _sendMagicLink,
              icon: _magicLinkSubmitting
                  ? const _ButtonSpinner()
                  : const Icon(Icons.link_rounded),
              label: _ButtonText(
                _magicLinkSubmitting ? 'Sending link...' : 'Send magic link',
              ),
            ),
          ),
          if (_otpEmail != null) ...[
            const SizedBox(height: AppSpacing.md),
            Text('Code sent to $_otpEmail', style: theme.textTheme.labelLarge),
            const SizedBox(height: AppSpacing.sm),
            Form(
              key: _otpFormKey,
              child: TextFormField(
                controller: _otpController,
                keyboardType: TextInputType.number,
                textInputAction: TextInputAction.done,
                autofillHints: const [AutofillHints.oneTimeCode],
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                maxLength: 8,
                decoration: const InputDecoration(
                  labelText: '8-digit code',
                  hintText: '12345678',
                ),
                validator: _validateOtp,
                onFieldSubmitted: (_) => _verifyEmailCode(),
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _emailCodeSubmitting ? null : _verifyEmailCode,
                child: _ButtonText(
                  _emailCodeSubmitting ? 'Verifying...' : 'Verify code',
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            TextButton(
              onPressed: _emailCodeSubmitting ? null : _clearOtpFlow,
              child: const Text('Use a different email'),
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
    );
  }

  Widget _buildGoogleCard() {
    return PremiumSurface(
      key: const ValueKey('sign-in-google-card'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          PremiumTrustSignal(
            label: 'Continue with Google',
            caption:
                'Fast for new users. Matching emails stay connected to the same ServiQ account.',
            icon: Icons.open_in_new_rounded,
            color: AppColors.accent,
            backgroundColor: AppColors.accentSoft,
          ),
          const SizedBox(height: AppSpacing.md),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: _googleSubmitting ? null : _startGoogleSignIn,
              icon: _googleSubmitting
                  ? const _ButtonSpinner()
                  : const Icon(Icons.open_in_new_rounded),
              label: _ButtonText(
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
    );
  }

  Widget _buildPasswordCard() {
    final theme = Theme.of(context);

    return PremiumSurface(
      key: const ValueKey('sign-in-password-card'),
      child: Form(
        key: _passwordFormKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            PremiumTrustSignal(
              label: 'Email + password',
              caption:
                  'Use only when you already created a mobile password for this account.',
              icon: Icons.lock_outline_rounded,
              color: AppColors.warm,
              backgroundColor: AppColors.warmSoft,
            ),
            const SizedBox(height: AppSpacing.md),
            Wrap(
              spacing: AppSpacing.xs,
              runSpacing: AppSpacing.xs,
              children: [
                ChoiceChip(
                  label: const Text('Sign in'),
                  selected: _passwordMode == _PasswordAuthMode.signIn,
                  onSelected: _passwordSubmitting
                      ? null
                      : (selected) {
                          if (!selected) {
                            return;
                          }

                          setState(() {
                            _passwordMode = _PasswordAuthMode.signIn;
                            _passwordStatus = null;
                            _passwordError = null;
                          });
                        },
                ),
                ChoiceChip(
                  label: const Text('Create account'),
                  selected: _passwordMode == _PasswordAuthMode.signUp,
                  onSelected: _passwordSubmitting
                      ? null
                      : (selected) {
                          if (!selected) {
                            return;
                          }

                          setState(() {
                            _passwordMode = _PasswordAuthMode.signUp;
                            _passwordStatus = null;
                            _passwordError = null;
                          });
                        },
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              'If you already used email links on the web, start with the email code above.',
              style: theme.textTheme.bodySmall,
            ),
            const SizedBox(height: AppSpacing.md),
            TextFormField(
              controller: _passwordEmailController,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
              autofillHints: const [AutofillHints.username],
              decoration: const InputDecoration(
                labelText: 'Email address',
                hintText: 'you@example.com',
              ),
              validator: _validateEmail,
            ),
            const SizedBox(height: AppSpacing.sm),
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
              decoration: InputDecoration(
                labelText: 'Password',
                suffixIcon: IconButton(
                  onPressed: () {
                    setState(() {
                      _obscurePassword = !_obscurePassword;
                    });
                  },
                  icon: Icon(
                    _obscurePassword
                        ? Icons.visibility_off_rounded
                        : Icons.visibility_rounded,
                  ),
                ),
              ),
              validator: _validatePassword,
              onFieldSubmitted: (_) {
                if (_passwordMode == _PasswordAuthMode.signIn) {
                  _submitPasswordAuth();
                }
              },
            ),
            if (_passwordMode == _PasswordAuthMode.signUp) ...[
              const SizedBox(height: AppSpacing.sm),
              TextFormField(
                controller: _confirmPasswordController,
                obscureText: _obscureConfirmPassword,
                textInputAction: TextInputAction.done,
                autofillHints: const [AutofillHints.newPassword],
                decoration: InputDecoration(
                  labelText: 'Confirm password',
                  suffixIcon: IconButton(
                    onPressed: () {
                      setState(() {
                        _obscureConfirmPassword = !_obscureConfirmPassword;
                      });
                    },
                    icon: Icon(
                      _obscureConfirmPassword
                          ? Icons.visibility_off_rounded
                          : Icons.visibility_rounded,
                    ),
                  ),
                ),
                validator: _validatePasswordConfirmation,
                onFieldSubmitted: (_) => _submitPasswordAuth(),
              ),
            ],
            const SizedBox(height: AppSpacing.md),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _passwordSubmitting ? null : _submitPasswordAuth,
                icon: _passwordSubmitting
                    ? const _ButtonSpinner()
                    : Icon(
                        _passwordMode == _PasswordAuthMode.signIn
                            ? Icons.login_rounded
                            : Icons.person_add_alt_1_rounded,
                      ),
                label: _ButtonText(
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

    return PremiumSurface(
      padding: const EdgeInsets.all(AppSpacing.md),
      backgroundColor: AppColors.inkStrong,
      borderColor: AppColors.inkStrong,
      shadows: AppShadows.card,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.10),
              borderRadius: BorderRadius.circular(AppRadii.md),
            ),
            child: Icon(intent.icon, color: Colors.white, size: 20),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Continue where you left off',
                  style: theme.textTheme.labelLarge?.copyWith(
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: AppSpacing.xxxs),
                Text(
                  '${intent.title} -> ${intent.destinationLabel}',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: Colors.white.withValues(alpha: 0.72),
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

class _IntentSelector extends StatelessWidget {
  const _IntentSelector({
    required this.selectedIntent,
    required this.onSelected,
  });

  final MobileOnboardingIntent selectedIntent;
  final ValueChanged<MobileOnboardingIntent> onSelected;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (final intent in MobileOnboardingIntent.values) ...[
          PremiumIntentTile(
            title: intent.title,
            subtitle: intent.subtitle,
            icon: intent.icon,
            accentColor: intent.color,
            selected: selectedIntent == intent,
            onTap: () => onSelected(intent),
          ),
          if (intent != MobileOnboardingIntent.values.last)
            const SizedBox(height: AppSpacing.xs),
        ],
      ],
    );
  }
}

class _TrustStrip extends StatelessWidget {
  const _TrustStrip();

  @override
  Widget build(BuildContext context) {
    return const PremiumSurface(
      padding: EdgeInsets.all(AppSpacing.md),
      backgroundColor: AppColors.inkStrong,
      borderColor: AppColors.inkStrong,
      shadows: AppShadows.card,
      child: Column(
        children: [
          PremiumTrustSignal(
            label: 'Protected by account verification',
            caption:
                'Email, profile readiness, and trust status carry across web and mobile.',
            icon: Icons.verified_user_outlined,
            color: Colors.white,
            backgroundColor: Color(0x2211A08F),
          ),
          SizedBox(height: AppSpacing.sm),
          PremiumTrustSignal(
            label: 'Private until you choose to act',
            caption:
                'Location and provider details stay scoped to marketplace workflows.',
            icon: Icons.location_searching_rounded,
            color: Colors.white,
            backgroundColor: Color(0x223557D5),
          ),
        ],
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

    return PremiumSurface(
      padding: EdgeInsets.zero,
      shadows: const [],
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
          leading: const Icon(Icons.route_outlined),
          title: Text(
            'Current auth callback',
            style: theme.textTheme.titleMedium,
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
      child: Text(
        errorMessage ?? successMessage ?? '',
        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
          color: showingError ? AppColors.danger : AppColors.success,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _ButtonText extends StatelessWidget {
  const _ButtonText(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    return Text(label, maxLines: 1, overflow: TextOverflow.ellipsis);
  }
}

class _ButtonSpinner extends StatelessWidget {
  const _ButtonSpinner();

  @override
  Widget build(BuildContext context) {
    return const SizedBox(
      width: 16,
      height: 16,
      child: CircularProgressIndicator(strokeWidth: 2),
    );
  }
}
