import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/auth/auth_state_controller.dart';
import '../../../core/auth/mobile_auth_service.dart';
import '../../../core/supabase/app_bootstrap.dart';
import '../../../core/widgets/section_card.dart';

class ProfilePage extends ConsumerStatefulWidget {
  const ProfilePage({super.key});

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
            'Google linking opened in your browser. Finish there and the linked sign-in method should return to this same account.';
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
    final bootstrap = ref.watch(appBootstrapProvider);
    final user = ref.watch(currentSessionProvider).asData?.value?.user;
    final isAuthenticated = user != null;
    final linkedProviders = _linkedProviders(user);
    final hasGoogle = linkedProviders.contains('google');

    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
          children: [
            Text(
              user?.email ?? 'ServiQ account',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            const SizedBox(height: 10),
            Text(
              'This tab now doubles as your account-control surface so existing users can safely add a password or Google without splitting their account history.',
              style: Theme.of(context).textTheme.bodyLarge,
            ),
            const SizedBox(height: 16),
            SectionCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Environment',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 12),
                  _ProfileField(
                    label: 'APP_ENV',
                    value: bootstrap.config.environment,
                  ),
                  _ProfileField(
                    label: 'API_BASE_URL',
                    value: bootstrap.config.apiBaseUrl.isEmpty
                        ? 'Not configured'
                        : bootstrap.config.apiBaseUrl,
                  ),
                  _ProfileField(
                    label: 'Auth callback',
                    value: bootstrap.config.magicLinkRedirectUrl,
                  ),
                  _ProfileField(
                    label: 'Supabase ready',
                    value: bootstrap.supabaseReady ? 'Yes' : 'No',
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            SectionCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Sign-in methods',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'If you first came in with an email code, this is the safest place to add Google later without creating a second account.',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 14),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: linkedProviders
                        .map(
                          (provider) =>
                              Chip(label: Text(_providerLabel(provider))),
                        )
                        .toList(),
                  ),
                  const SizedBox(height: 16),
                  if (!hasGoogle && isAuthenticated)
                    OutlinedButton.icon(
                      onPressed: _googleSubmitting ? null : _linkGoogle,
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
                            : 'Link Google to this account',
                      ),
                    )
                  else
                    Text(
                      hasGoogle
                          ? 'Google is already linked to this account.'
                          : 'Sign in first to manage linked providers.',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  _ProfileMessage(
                    successMessage: _googleStatus,
                    errorMessage: _googleError,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            if ((user?.email ?? '').isNotEmpty) ...[
              SectionCard(
                child: Form(
                  key: _passwordFormKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Create or update password',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 10),
                      Text(
                        'Best after your first email-code login. This saves a reusable password on the same ServiQ account for faster sign-ins next time.',
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                      const SizedBox(height: 14),
                      TextFormField(
                        controller: _passwordController,
                        obscureText: _obscurePassword,
                        textInputAction: TextInputAction.next,
                        autofillHints: const [AutofillHints.newPassword],
                        decoration: InputDecoration(
                          labelText: 'New password',
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
                      ),
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
                        onFieldSubmitted: (_) => _updatePassword(),
                      ),
                      const SizedBox(height: 16),
                      FilledButton.icon(
                        onPressed: _passwordSubmitting ? null : _updatePassword,
                        icon: _passwordSubmitting
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Icon(Icons.lock_reset_rounded),
                        label: Text(
                          _passwordSubmitting ? 'Saving...' : 'Save password',
                        ),
                      ),
                      _ProfileMessage(
                        successMessage: _passwordStatus,
                        errorMessage: _passwordError,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 14),
            ],
            SectionCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Account',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 12),
                  _ProfileField(
                    label: 'User ID',
                    value: user?.id ?? 'No active session',
                  ),
                  _ProfileField(
                    label: 'Email',
                    value: user?.email ?? 'No active session',
                  ),
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    onPressed: isAuthenticated
                        ? () async {
                            await auth.signOut();
                          }
                        : null,
                    icon: const Icon(Icons.logout_rounded),
                    label: const Text('Sign out'),
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

class _ProfileField extends StatelessWidget {
  const _ProfileField({required this.label, required this.value});

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
            ).textTheme.labelLarge?.copyWith(color: const Color(0xFF64748B)),
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

List<String> _linkedProviders(User? user) {
  final providers = <String>{};

  if ((user?.email ?? '').trim().isNotEmpty) {
    providers.add('email');
  }

  final appProviders = user?.appMetadata['providers'];
  if (appProviders is Iterable) {
    for (final provider in appProviders) {
      if (provider is String && provider.trim().isNotEmpty) {
        providers.add(provider.trim().toLowerCase());
      }
    }
  }

  for (final identity in user?.identities ?? const <UserIdentity>[]) {
    final provider = identity.provider.trim().toLowerCase();
    if (provider.isNotEmpty) {
      providers.add(provider);
    }
  }

  final orderedProviders = providers.toList();
  orderedProviders.sort((left, right) {
    final leftRank = switch (left) {
      'email' => 0,
      'google' => 1,
      _ => 9,
    };
    final rightRank = switch (right) {
      'email' => 0,
      'google' => 1,
      _ => 9,
    };

    if (leftRank != rightRank) {
      return leftRank.compareTo(rightRank);
    }

    return left.compareTo(right);
  });
  return orderedProviders;
}

String _providerLabel(String provider) {
  return switch (provider) {
    'email' => 'Email',
    'google' => 'Google',
    _ => provider[0].toUpperCase() + provider.substring(1),
  };
}
