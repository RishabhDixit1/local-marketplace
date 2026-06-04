import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/auth/mobile_auth_service.dart';
import '../../../../core/services/analytics_service.dart';
import '../../data/onboarding_handoff.dart';

enum AuthTab { emailOtp, phoneOtp, password }

class AuthFormState {
  final bool isSubmitting;
  final String? errorMessage;
  final String? successMessage;
  final bool obscurePassword;
  final bool obscureConfirmPassword;
  final AuthTab activeTab;
  final bool otpSent;
  final String? otpDestination;

  const AuthFormState({
    this.isSubmitting = false,
    this.errorMessage,
    this.successMessage,
    this.obscurePassword = true,
    this.obscureConfirmPassword = true,
    this.activeTab = AuthTab.emailOtp,
    this.otpSent = false,
    this.otpDestination,
  });

  AuthFormState copyWith({
    bool? isSubmitting,
    String? errorMessage,
    String? successMessage,
    bool? obscurePassword,
    bool? obscureConfirmPassword,
    AuthTab? activeTab,
    bool? otpSent,
    String? otpDestination,
    bool clearError = false,
    bool clearSuccess = false,
    bool clearOtp = false,
  }) {
    return AuthFormState(
      isSubmitting: isSubmitting ?? this.isSubmitting,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      successMessage: clearSuccess ? null : (successMessage ?? this.successMessage),
      obscurePassword: obscurePassword ?? this.obscurePassword,
      obscureConfirmPassword: obscureConfirmPassword ?? this.obscureConfirmPassword,
      activeTab: activeTab ?? this.activeTab,
      otpSent: clearOtp ? false : (otpSent ?? this.otpSent),
      otpDestination: clearOtp ? null : (otpDestination ?? this.otpDestination),
    );
  }
}

class AuthNotifier extends Notifier<AuthFormState> {
  @override
  AuthFormState build() {
    _authService = ref.read(mobileAuthServiceProvider);
    _handoffController = ref.read(onboardingHandoffControllerProvider);
    _analyticsService = ref.read(analyticsServiceProvider);
    ref.onDispose(() {
      emailController.dispose();
      passwordController.dispose();
      confirmPasswordController.dispose();
      nameController.dispose();
      forgotEmailController.dispose();
      otpCodeController.dispose();
      phoneController.dispose();
      emailOtpController.dispose();
    });
    return const AuthFormState();
  }

  late final MobileAuthService _authService;
  late final OnboardingHandoffController _handoffController;
  late final AnalyticsService _analyticsService;

  final emailController = TextEditingController();
  final passwordController = TextEditingController();
  final confirmPasswordController = TextEditingController();
  final nameController = TextEditingController();
  final forgotEmailController = TextEditingController();
  final otpCodeController = TextEditingController();
  final phoneController = TextEditingController();
  final emailOtpController = TextEditingController();

  void setActiveTab(AuthTab tab) {
    state = state.copyWith(activeTab: tab, clearError: true, clearSuccess: true);
  }

  void togglePasswordVisibility() {
    state = state.copyWith(obscurePassword: !state.obscurePassword);
  }

  void toggleConfirmPasswordVisibility() {
    state = state.copyWith(obscureConfirmPassword: !state.obscureConfirmPassword);
  }

  void clearError() {
    state = state.copyWith(clearError: true);
  }

  void resetOtpFlow() {
    state = state.copyWith(
      clearOtp: true,
      clearError: true,
      clearSuccess: true,
    );
    otpCodeController.clear();
  }

  Future<void> sendEmailOtp(BuildContext context) async {
    final email = emailOtpController.text.trim();
    if (!_validateEmail(email)) return;

    state = state.copyWith(
      isSubmitting: true,
      clearError: true,
      clearSuccess: true,
    );

    await _handoffController.prepareForAuth(MobileAuthMethod.emailCode);
    _analyticsService.trackEvent(
      'mobile_auth_method_chosen',
      extras: _handoffController.analyticsExtras(method: MobileAuthMethod.emailCode),
    );

    try {
      await _authService.sendEmailCode(email);
      if (!context.mounted) return;
      state = state.copyWith(
        isSubmitting: false,
        otpSent: true,
        otpDestination: email,
        successMessage: 'Code sent to $email',
      );
    } catch (error) {
      if (!context.mounted) return;
      state = state.copyWith(
        isSubmitting: false,
        errorMessage: _authService.friendlyErrorMessage(
          error,
          fallbackPrefix: 'Unable to send code',
        ),
      );
      unawaited(_handoffController.completeAuthHandoff(clearStoredRoute: false));
    }
  }

  Future<void> verifyEmailOtp(BuildContext context) async {
    final email = state.otpDestination ?? emailOtpController.text.trim();
    final code = otpCodeController.text.trim();

    if (code.isEmpty) {
      state = state.copyWith(errorMessage: 'Enter the code sent to your email.');
      return;
    }

    state = state.copyWith(isSubmitting: true, clearError: true, clearSuccess: true);

    await _handoffController.prepareForAuth(MobileAuthMethod.emailCode);

    try {
      await _authService.verifyEmailCode(email: email, code: code);
      if (!context.mounted) return;
      state = state.copyWith(isSubmitting: false);
      context.go(_handoffController.postAuthDestination);
    } catch (error) {
      if (!context.mounted) return;
      state = state.copyWith(
        isSubmitting: false,
        errorMessage: _authService.friendlyErrorMessage(
          error,
          fallbackPrefix: 'Unable to verify code',
        ),
      );
    }
  }

  Future<void> sendPhoneOtp(BuildContext context) async {
    final phone = phoneController.text.trim();
    if (phone.isEmpty) {
      state = state.copyWith(errorMessage: 'Enter your phone number.');
      return;
    }

    state = state.copyWith(
      isSubmitting: true,
      clearError: true,
      clearSuccess: true,
    );

    await _handoffController.prepareForAuth(MobileAuthMethod.phoneSms);
    _analyticsService.trackEvent(
      'mobile_auth_method_chosen',
      extras: _handoffController.analyticsExtras(method: MobileAuthMethod.phoneSms),
    );

    try {
      await _authService.sendPhoneOtp(phone);
      if (!context.mounted) return;
      state = state.copyWith(
        isSubmitting: false,
        otpSent: true,
        otpDestination: phone,
        successMessage: 'Code sent to $phone',
      );
    } catch (error) {
      if (!context.mounted) return;
      state = state.copyWith(
        isSubmitting: false,
        errorMessage: _authService.friendlyErrorMessage(
          error,
          fallbackPrefix: 'Unable to send code',
        ),
      );
      unawaited(_handoffController.completeAuthHandoff(clearStoredRoute: false));
    }
  }

  Future<void> verifyPhoneOtp(BuildContext context) async {
    final phone = state.otpDestination ?? phoneController.text.trim();
    final code = otpCodeController.text.trim();

    if (code.isEmpty) {
      state = state.copyWith(errorMessage: 'Enter the code sent to your phone.');
      return;
    }

    state = state.copyWith(isSubmitting: true, clearError: true, clearSuccess: true);

    await _handoffController.prepareForAuth(MobileAuthMethod.phoneSms);

    try {
      await _authService.verifyPhoneOtp(phone: phone, code: code);
      if (!context.mounted) return;
      state = state.copyWith(isSubmitting: false);
      context.go(_handoffController.postAuthDestination);
    } catch (error) {
      if (!context.mounted) return;
      state = state.copyWith(
        isSubmitting: false,
        errorMessage: _authService.friendlyErrorMessage(
          error,
          fallbackPrefix: 'Unable to verify code',
        ),
      );
    }
  }

  Future<void> signInWithGoogle(BuildContext context) async {
    state = state.copyWith(isSubmitting: true, clearError: true, clearSuccess: true);

    await _handoffController.prepareForAuth(MobileAuthMethod.google);
    _analyticsService.trackEvent(
      'mobile_auth_method_chosen',
      extras: _handoffController.analyticsExtras(method: MobileAuthMethod.google),
    );

    try {
      await _authService.signInWithGoogle();
      state = state.copyWith(
        isSubmitting: false,
        successMessage: 'Google sign-in opened in your browser.',
      );
    } catch (error) {
      state = state.copyWith(
        isSubmitting: false,
        errorMessage: _authService.friendlyErrorMessage(
          error,
          fallbackPrefix: 'Unable to start Google sign-in',
        ),
      );
      unawaited(_handoffController.completeAuthHandoff(clearStoredRoute: false));
    }
  }

  Future<void> signInWithApple(BuildContext context) async {
    state = state.copyWith(isSubmitting: true, clearError: true, clearSuccess: true);

    try {
      await _authService.signInWithGoogle();
      state = state.copyWith(isSubmitting: false, successMessage: 'Apple sign-in opened.');
    } catch (error) {
      state = state.copyWith(
        isSubmitting: false,
        errorMessage: _authService.friendlyErrorMessage(
          error,
          fallbackPrefix: 'Unable to start Apple sign-in',
        ),
      );
    }
  }

  Future<void> signInWithPassword(BuildContext context) async {
    final email = emailController.text.trim();
    final password = passwordController.text;

    if (!_validateEmail(email)) return;
    if (!_validatePassword(password)) return;

    state = state.copyWith(isSubmitting: true, clearError: true, clearSuccess: true);

    await _handoffController.prepareForAuth(MobileAuthMethod.password);
    _analyticsService.trackEvent(
      'mobile_auth_method_chosen',
      extras: _handoffController.analyticsExtras(method: MobileAuthMethod.password),
    );

    try {
      await _authService.signInWithPassword(email: email, password: password);
      if (!context.mounted) return;
      state = state.copyWith(isSubmitting: false);
      context.go(_handoffController.postAuthDestination);
    } catch (error) {
      state = state.copyWith(
        isSubmitting: false,
        errorMessage: _authService.friendlyErrorMessage(
          error,
          fallbackPrefix: 'Unable to sign in',
        ),
      );
      unawaited(_handoffController.completeAuthHandoff(clearStoredRoute: false));
    }
  }

  Future<void> signUp(BuildContext context) async {
    final name = nameController.text.trim();
    final email = emailController.text.trim();
    final password = passwordController.text;
    final confirmPassword = confirmPasswordController.text;

    if (name.isEmpty) {
      state = state.copyWith(errorMessage: 'Enter your full name.');
      return;
    }
    if (!_validateEmail(email)) return;
    if (!_validatePassword(password)) return;
    if (password != confirmPassword) {
      state = state.copyWith(errorMessage: 'Passwords do not match.');
      return;
    }

    state = state.copyWith(isSubmitting: true, clearError: true, clearSuccess: true);

    await _handoffController.prepareForAuth(MobileAuthMethod.passwordSignUp);
    _analyticsService.trackEvent(
      'mobile_auth_method_chosen',
      extras: _handoffController.analyticsExtras(method: MobileAuthMethod.passwordSignUp),
    );

    try {
      final response = await _authService.signUpWithPassword(email: email, password: password);
      if (!context.mounted) return;

      passwordController.clear();
      confirmPasswordController.clear();

      if (response.session != null) {
        state = state.copyWith(isSubmitting: false);
        context.go(_handoffController.postAuthDestination);
      } else {
        state = state.copyWith(
          isSubmitting: false,
          successMessage: 'Account created. Check your email to confirm.',
        );
      }
    } catch (error) {
      state = state.copyWith(
        isSubmitting: false,
        errorMessage: _authService.friendlyErrorMessage(error, fallbackPrefix: 'Unable to create account'),
      );
      unawaited(_handoffController.completeAuthHandoff(clearStoredRoute: false));
    }
  }

  Future<void> sendForgotPasswordEmail(BuildContext context) async {
    final email = forgotEmailController.text.trim();
    if (!_validateEmail(email)) return;

    state = state.copyWith(isSubmitting: true, clearError: true, clearSuccess: true);

    try {
      await _authService.sendPasswordResetEmail(email);
      if (!context.mounted) return;
      state = state.copyWith(
        isSubmitting: false,
        successMessage: 'Password reset link sent to $email',
      );
    } catch (error) {
      state = state.copyWith(
        isSubmitting: false,
        errorMessage: _authService.friendlyErrorMessage(error, fallbackPrefix: 'Unable to send reset email'),
      );
    }
  }

  bool _validateEmail(String email) {
    if (email.isEmpty) {
      state = state.copyWith(errorMessage: 'Enter your email address.');
      return false;
    }
    final pattern = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');
    if (!pattern.hasMatch(email)) {
      state = state.copyWith(errorMessage: 'Enter a valid email address.');
      return false;
    }
    return true;
  }

  bool _validatePassword(String password) {
    if (password.length < 8) {
      state = state.copyWith(errorMessage: 'Password must be at least 8 characters.');
      return false;
    }
    if (!RegExp(r'[A-Za-z]').hasMatch(password) || !RegExp(r'\d').hasMatch(password)) {
      state = state.copyWith(errorMessage: 'Password must contain letters and at least one number.');
      return false;
    }
    return true;
  }
}

final authNotifierProvider = NotifierProvider<AuthNotifier, AuthFormState>(
  AuthNotifier.new,
);
