import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/supabase/app_bootstrap.dart';
import '../../../core/widgets/section_card.dart';

class SignInPage extends ConsumerStatefulWidget {
  const SignInPage({super.key});

  @override
  ConsumerState<SignInPage> createState() => _SignInPageState();
}

class _SignInPageState extends ConsumerState<SignInPage> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  bool _submitting = false;
  String? _statusMessage;
  String? _errorMessage;

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  String _friendlyErrorMessage(Object error, AppBootstrap bootstrap) {
    final rawMessage = error.toString();
    final normalizedMessage = rawMessage.toLowerCase();

    if (bootstrap.config.usesPlaceholderSupabaseConfig ||
        normalizedMessage.contains('example.supabase.co') ||
        normalizedMessage.contains('your-project.supabase.co')) {
      return 'This mobile app is still using placeholder Supabase values. '
          'Restart it with the real SUPABASE_URL and SUPABASE_ANON_KEY.';
    }

    if (normalizedMessage.contains('failed host lookup')) {
      return 'The phone could not reach Supabase. Double-check the mobile '
          'SUPABASE_URL value and confirm the device has internet access.';
    }

    if (normalizedMessage.contains('network is unreachable') ||
        normalizedMessage.contains('connection failed') ||
        normalizedMessage.contains('os error: network is unreachable')) {
      return 'The device could not open a network connection to Supabase. '
          'Relaunch the Android app after the manifest update, then confirm '
          'the emulator itself has internet access.';
    }

    return 'Unable to send sign-in link: $rawMessage';
  }

  Future<void> _sendMagicLink() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    final bootstrap = ref.read(appBootstrapProvider);
    final client = bootstrap.client;
    if (bootstrap.config.usesPlaceholderSupabaseConfig) {
      setState(() {
        _errorMessage =
            'This app is still running with placeholder Supabase values. '
            'Restart it with the real SUPABASE_URL and SUPABASE_ANON_KEY.';
        _statusMessage = null;
      });
      return;
    }

    if (client == null) {
      setState(() {
        _errorMessage =
            'Supabase is not ready yet. Finish setup before trying to sign in.';
        _statusMessage = null;
      });
      return;
    }

    FocusScope.of(context).unfocus();
    setState(() {
      _submitting = true;
      _errorMessage = null;
      _statusMessage = null;
    });

    try {
      await client.auth.signInWithOtp(
        email: _emailController.text.trim(),
        emailRedirectTo: bootstrap.config.magicLinkRedirectUrl,
        shouldCreateUser: true,
      );

      if (!mounted) {
        return;
      }

      setState(() {
        _statusMessage =
            'Magic link sent. Open the email on your device and the native callback should return you to ServiQ if your Supabase redirect URL matches this app callback.';
      });
    } on AuthException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _errorMessage = error.message;
      });
    } catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _errorMessage = _friendlyErrorMessage(error, bootstrap);
      });
    } finally {
      if (mounted) {
        setState(() {
          _submitting = false;
        });
      }
    }
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
              'Welcome to ServiQ mobile',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            const SizedBox(height: 12),
            Text(
              'We are keeping auth native to Supabase here. The app now registers the default mobile callback, so this same flow can return directly into ServiQ once Supabase is configured with the matching redirect URL.',
              style: Theme.of(context).textTheme.bodyLarge,
            ),
            const SizedBox(height: 20),
            SectionCard(
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Email magic link',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 10),
                    TextFormField(
                      controller: _emailController,
                      keyboardType: TextInputType.emailAddress,
                      autofillHints: const [AutofillHints.email],
                      decoration: const InputDecoration(
                        labelText: 'Email address',
                        hintText: 'you@example.com',
                      ),
                      validator: (value) {
                        final email = value?.trim() ?? '';
                        if (email.isEmpty) {
                          return 'Enter an email address.';
                        }
                        final pattern = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');
                        if (!pattern.hasMatch(email)) {
                          return 'Enter a valid email address.';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),
                    FilledButton.icon(
                      onPressed: _submitting ? null : _sendMagicLink,
                      icon: _submitting
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.send_rounded),
                      label: Text(
                        _submitting ? 'Sending...' : 'Send magic link',
                      ),
                    ),
                    if (_statusMessage != null) ...[
                      const SizedBox(height: 14),
                      Text(
                        _statusMessage!,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: const Color(0xFF0F766E),
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                    if (_errorMessage != null) ...[
                      const SizedBox(height: 14),
                      Text(
                        _errorMessage!,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Theme.of(context).colorScheme.error,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
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
                    'If the link still opens only in the browser, double-check that Supabase Additional Redirect URLs includes this exact callback and that your run command is using the same scheme and host.',
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
