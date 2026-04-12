import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/mobile_auth_service.dart';
import '../../../core/supabase/app_bootstrap.dart';
import '../../../core/widgets/section_card.dart';

enum _PasswordAuthMode { signIn, signUp }

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
      return 'Enter the 6-digit code from your email.';
    }

    if (!RegExp(r'^\d{6}$').hasMatch(token)) {
      return 'Use the 6-digit code from your email.';
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
    if (normalizedMessage.contains('network is unreachable') ||
        normalizedMessage.contains('connection failed') ||
        normalizedMessage.contains('os error: network is unreachable')) {
      return 'The device could not open a network connection to Supabase. '
          'Relaunch the Android app after the manifest update, then confirm '
          'the emulator itself has internet access.';
    }

    return 'Unable to send sign-in link: $rawMessage';
  }

  Future<void> _sendEmailCode() async {
    if (!_emailFormKey.currentState!.validate()) {
      return;
    }

    final authService = ref.read(mobileAuthServiceProvider);
    final email = _emailController.text.trim();
    FocusScope.of(context).unfocus();
    setState(() {
      _emailCodeSubmitting = true;
      _emailCodeError = null;
      _emailCodeStatus = null;
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
            'Code sent to $email. Enter the 6-digit code from your email to continue.';
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
    } finally {
      if (mounted) {
        setState(() {
          _emailCodeSubmitting = false;
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
    });
  }

  @override
  Widget build(BuildContext context) {
    final bootstrap = ref.watch(appBootstrapProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Sign in')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
          children: [
            Text(
              'Sign in to ServiQ mobile',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            const SizedBox(height: 12),
            Text(
              'Existing web users should use the same email they already used on the web. That keeps the same Supabase account and avoids duplicate-account confusion on mobile.',
              style: Theme.of(context).textTheme.bodyLarge,
            ),
            const SizedBox(height: 20),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: const [
                Chip(label: Text('Existing users: email code first')),
                Chip(label: Text('Same email keeps the same account')),
                Chip(label: Text('Brand-new users: Google is fastest')),
              ],
            ),
            const SizedBox(height: 20),
            SectionCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Continue with email code',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'Best option for anyone who already used ServiQ on the web. We will send a one-time code to that same email address.',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 14),
                  Form(
                    key: _emailFormKey,
                    child: TextFormField(
                      controller: _emailController,
                      enabled: _otpEmail == null && !_emailCodeSubmitting,
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
                  const SizedBox(height: 16),
                  FilledButton.icon(
                    onPressed: _emailCodeSubmitting ? null : _sendEmailCode,
                    icon: _emailCodeSubmitting
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.mark_email_read_rounded),
                    label: Text(
                      _emailCodeSubmitting
                          ? 'Sending...'
                          : _otpEmail == null
                          ? 'Send email code'
                          : 'Resend code',
                    ),
                  ),
                  if (_otpEmail != null) ...[
                    const SizedBox(height: 14),
                    Text(
                      'Code sent to $_otpEmail',
                      style: Theme.of(context).textTheme.labelLarge,
                    ),
                    const SizedBox(height: 10),
                    Form(
                      key: _otpFormKey,
                      child: TextFormField(
                        controller: _otpController,
                        keyboardType: TextInputType.number,
                        textInputAction: TextInputAction.done,
                        autofillHints: const [AutofillHints.oneTimeCode],
                        inputFormatters: [
                          FilteringTextInputFormatter.digitsOnly,
                        ],
                        maxLength: 6,
                        decoration: const InputDecoration(
                          labelText: '6-digit code',
                          hintText: '123456',
                        ),
                        validator: _validateOtp,
                        onFieldSubmitted: (_) => _verifyEmailCode(),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Expanded(
                          child: FilledButton(
                            onPressed: _emailCodeSubmitting
                                ? null
                                : _verifyEmailCode,
                            child: Text(
                              _emailCodeSubmitting
                                  ? 'Verifying...'
                                  : 'Verify code',
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    TextButton(
                      onPressed: _emailCodeSubmitting ? null : _clearOtpFlow,
                      child: const Text('Use a different email'),
                    ),
                  ],
                  _AuthMessage(
                    successMessage: _emailCodeStatus,
                    errorMessage: _emailCodeError,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            SectionCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Continue with Google',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'Fastest option for brand-new users. If your Google email exactly matches the email already on your ServiQ account, Supabase should keep it on the same user.',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'If you use a different Google email, that will become a separate account until you link it later.',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 16),
                  OutlinedButton.icon(
                    onPressed: _googleSubmitting ? null : _startGoogleSignIn,
                    icon: _googleSubmitting
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.open_in_new_rounded),
                    label: Text(
                      _googleSubmitting
                          ? 'Opening Google...'
                          : 'Continue with Google',
                    ),
                  ),
                  _AuthMessage(
                    successMessage: _googleStatus,
                    errorMessage: _googleError,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            SectionCard(
              child: Form(
                key: _passwordFormKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Email + password',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 10),
                    Text(
                      'If you already used email links on the web, do not create a new password account first. Use the email code above, then create or update a password from the Profile tab after you are signed in.',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: 14),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
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
                    const SizedBox(height: 16),
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
                    const SizedBox(height: 12),
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
                      const SizedBox(height: 12),
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
                                _obscureConfirmPassword =
                                    !_obscureConfirmPassword;
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
                    const SizedBox(height: 16),
                    FilledButton.icon(
                      onPressed: _passwordSubmitting
                          ? null
                          : _submitPasswordAuth,
                      icon: _passwordSubmitting
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : Icon(
                              _passwordMode == _PasswordAuthMode.signIn
                                  ? Icons.login_rounded
                                  : Icons.person_add_alt_1_rounded,
                            ),
                      label: Text(
                        _passwordSubmitting
                            ? 'Working...'
                            : _passwordMode == _PasswordAuthMode.signIn
                            ? 'Sign in with password'
                            : 'Create account with password',
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
            const SizedBox(height: 16),
            SectionCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Current auth callback',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 10),
                  Text(
                    bootstrap.config.magicLinkRedirectUrl,
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'Google OAuth, email confirmation, and any deep-link auth returns should use this exact callback. For email-code sign-in, make sure your Supabase email template uses `{{ .Token }}` so users receive a one-time code instead of only a magic link.',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ],
              ),
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
