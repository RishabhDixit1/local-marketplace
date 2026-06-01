import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/constants/app_routes.dart';
import '../../../core/constants/categories.dart';
import '../../../core/design_system/design_system.dart';
import '../../../core/error/app_error_mapper.dart';
import '../../../core/services/analytics_service.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/section_card.dart';
import '../../../shared/components/app_buttons.dart';
import '../../../shared/components/empty_state_view.dart';
import '../../../shared/components/error_state_view.dart';
import '../../../shared/components/loading_shimmer.dart';
import '../../../shared/components/metric_tile.dart';
import '../../../shared/components/premium_primitives.dart';
import '../data/launchpad_repository.dart';
import '../data/provider_listing_repository.dart';
import '../domain/launchpad_models.dart';
import '../../profile/data/profile_repository.dart';

enum _LaunchpadStep { basics, offers, aiDraft, publish }

extension _LaunchpadStepDetails on _LaunchpadStep {
  String get analyticsValue {
    return switch (this) {
      _LaunchpadStep.basics => 'basics',
      _LaunchpadStep.offers => 'offers',
      _LaunchpadStep.aiDraft => 'ai_draft',
      _LaunchpadStep.publish => 'publish_readiness',
    };
  }

  String get label {
    return switch (this) {
      _LaunchpadStep.basics => 'Basics',
      _LaunchpadStep.offers => 'Offers',
      _LaunchpadStep.aiDraft => 'AI Draft',
      _LaunchpadStep.publish => 'Publish',
    };
  }

  IconData get icon {
    return switch (this) {
      _LaunchpadStep.basics => Icons.storefront_outlined,
      _LaunchpadStep.offers => Icons.inventory_2_outlined,
      _LaunchpadStep.aiDraft => Icons.auto_awesome_rounded,
      _LaunchpadStep.publish => Icons.rocket_launch_outlined,
    };
  }
}

class ProviderLaunchpadPage extends ConsumerStatefulWidget {
  const ProviderLaunchpadPage({super.key});

  @override
  ConsumerState<ProviderLaunchpadPage> createState() =>
      _ProviderLaunchpadPageState();
}

class _ProviderLaunchpadPageState extends ConsumerState<ProviderLaunchpadPage> {
  final _formKey = GlobalKey<FormState>();
  final _businessNameController = TextEditingController();
  final _locationController = TextEditingController();
  final _serviceAreaController = TextEditingController();
  final _radiusController = TextEditingController(text: '5');
  final _descriptionController = TextEditingController();
  final _offeringsController = TextEditingController();
  final _catalogController = TextEditingController();
  final _pricingController = TextEditingController();
  final _hoursController = TextEditingController();
  final _phoneController = TextEditingController();
  final _websiteController = TextEditingController();

  _LaunchpadStep _step = _LaunchpadStep.basics;
  String _offeringType = 'services';
  String _brandTone = 'friendly';
  String _businessType = '';
  String _primaryCategory = '';
  double? _latitude;
  double? _longitude;
  bool _locatingGps = false;
  String? _loadedDraftId;
  bool _saving = false;
  bool _autosaving = false;
  bool _publishing = false;
  bool _hydrating = false;
  Timer? _autosaveTimer;
  String? _statusMessage;
  String _draftStatus = 'Draft ready';
  final Set<String> _trackedSteps = <String>{};
  bool _trackedAiReview = false;
  bool _trackedPublishReady = false;

  List<TextEditingController> get _controllers => [
    _businessNameController,
    _locationController,
    _serviceAreaController,
    _radiusController,
    _descriptionController,
    _offeringsController,
    _catalogController,
    _pricingController,
    _hoursController,
    _phoneController,
    _websiteController,
  ];

  @override
  void initState() {
    super.initState();
    for (final controller in _controllers) {
      controller.addListener(_handleDraftChanged);
    }
  }

  @override
  void dispose() {
    _autosaveTimer?.cancel();
    for (final controller in _controllers) {
      controller.removeListener(_handleDraftChanged);
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _refresh() async {
    ref.invalidate(launchpadWorkspaceProvider);
    await ref.read(launchpadWorkspaceProvider.future);
  }

  void _hydrate(MobileLaunchpadWorkspace workspace) {
    final draft = workspace.draft;
    final id = draft?.id ?? 'empty';
    if (_loadedDraftId == id) {
      _trackCurrentStepAfterFrame();
      return;
    }
    _loadedDraftId = id;

    final answers = draft?.answers ?? MobileLaunchpadAnswers.empty();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) {
        return;
      }
      _hydrating = true;
      _businessNameController.text = answers.businessName;
      _locationController.text = answers.location;
      _serviceAreaController.text = answers.serviceArea;
      _radiusController.text = answers.serviceRadiusKm.toString();
      _descriptionController.text = answers.shortDescription;
      _offeringsController.text = answers.coreOfferings;
      _catalogController.text = answers.catalogText;
      _pricingController.text = answers.pricingNotes;
      _hoursController.text = answers.hours;
      _phoneController.text = answers.phone;
      _websiteController.text = answers.website;
      setState(() {
        _offeringType = _validOfferingType(answers.offeringType);
        _brandTone = _validBrandTone(answers.brandTone);
        _businessType = _validBusinessType(answers.businessType);
        _primaryCategory = _validCategory(answers.primaryCategory);
        _latitude = answers.latitude;
        _longitude = answers.longitude;
        _draftStatus = draft == null ? 'Draft ready' : 'Loaded saved draft';
      });
      _hydrating = false;
      _trackStepViewed(_step);
    });
  }

  void _trackCurrentStepAfterFrame() {
    if (_trackedSteps.contains(_step.analyticsValue)) {
      return;
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        _trackStepViewed(_step);
      }
    });
  }

  MobileLaunchpadAnswers _readAnswers() {
    return MobileLaunchpadAnswers(
      businessName: _businessNameController.text.trim(),
      businessType: _businessType.trim().isEmpty
          ? 'local_service'
          : _businessType.trim(),
      offeringType: _offeringType,
      primaryCategory: _primaryCategory.trim(),
      location: _locationController.text.trim(),
      serviceArea: _serviceAreaController.text.trim(),
      serviceRadiusKm: int.tryParse(_radiusController.text.trim()) ?? 5,
      shortDescription: _descriptionController.text.trim(),
      coreOfferings: _offeringsController.text.trim(),
      catalogText: _catalogController.text.trim(),
      pricingNotes: _pricingController.text.trim(),
      hours: _hoursController.text.trim(),
      phone: _phoneController.text.trim(),
      website: _websiteController.text.trim(),
      brandTone: _brandTone,
      latitude: _latitude,
      longitude: _longitude,
    );
  }

  bool get _hasDraftContent {
    return _controllers.any((controller) => controller.text.trim().isNotEmpty);
  }

  _PublishReadiness get _readiness => _PublishReadiness.from(_readAnswers());

  void _handleDraftChanged() {
    if (_hydrating) {
      return;
    }

    _autosaveTimer?.cancel();
    if (mounted) {
      setState(() => _draftStatus = 'Unsaved changes');
    }
    _autosaveTimer = Timer(const Duration(milliseconds: 1200), () {
      if (mounted && _hasDraftContent && !_saving && !_publishing) {
        unawaited(_saveDraft(quiet: true, validate: false));
      }
    });
  }

  Future<void> _handleGps() async {
    setState(() => _locatingGps = true);
    try {
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          distanceFilter: 0,
        ),
      );
      if (!mounted) return;
      setState(() {
        _latitude = position.latitude;
        _longitude = position.longitude;
      });
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Unable to get GPS location: ${AppErrorMapper.toMessage(error)}')),
      );
    } finally {
      if (mounted) setState(() => _locatingGps = false);
    }
  }

  void _handleDropdownChanged(VoidCallback update) {
    setState(update);
    _handleDraftChanged();
  }

  Future<MobileLaunchpadDraft?> _saveDraft({
    bool quiet = false,
    bool validate = false,
  }) async {
    if (validate && !(_formKey.currentState?.validate() ?? false)) {
      return null;
    }
    if (!_hasDraftContent) {
      return null;
    }

    FocusScope.of(context).unfocus();
    setState(() {
      if (quiet) {
        _autosaving = true;
        _draftStatus = 'Autosaving...';
      } else {
        _saving = true;
        _statusMessage = null;
      }
    });

    try {
      final draft = await ref
          .read(launchpadRepositoryProvider)
          .saveDraft(_readAnswers());
      ref.invalidate(profileSnapshotProvider);
      if (!quiet) {
        ref.invalidate(launchpadWorkspaceProvider);
      }
      if (!mounted) {
        return draft;
      }
      setState(() {
        _loadedDraftId = draft.id;
        _draftStatus = quiet ? 'Autosaved just now' : 'Draft saved';
        if (!quiet) {
          _statusMessage = 'Draft saved on your provider profile.';
        }
      });
      return draft;
    } on ApiException catch (error) {
      if (!mounted) {
        return null;
      }
      if (quiet) {
        setState(() => _draftStatus = 'Autosave paused');
      } else {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.message)));
      }
      return null;
    } catch (error) {
      if (!mounted) {
        return null;
      }
      if (quiet) {
        setState(() => _draftStatus = 'Autosave paused');
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(AppErrorMapper.toMessage(error))),
        );
      }
      return null;
    } finally {
      if (mounted) {
        setState(() {
          if (quiet) {
            _autosaving = false;
          } else {
            _saving = false;
          }
        });
      }
    }
  }

  Future<void> _publish() async {
    final readiness = _readiness;
    if (!readiness.ready) {
      setState(() {
        _statusMessage =
            'Complete basics and at least one offer before publishing.';
        _step = readiness.firstIncompleteStep;
      });
      _trackStepViewed(_step);
      return;
    }

    ref
        .read(analyticsServiceProvider)
        .trackEvent('launchpad_publish_attempted', extras: _analyticsExtras());

    final draft = await _saveDraft(quiet: true, validate: false);
    if (draft == null) {
      return;
    }

    setState(() {
      _publishing = true;
      _statusMessage = null;
      _draftStatus = 'Publishing...';
    });

    try {
      final result = await ref
          .read(launchpadRepositoryProvider)
          .publish(draftId: draft.id);
      ref.invalidate(launchpadWorkspaceProvider);
      ref.invalidate(profileSnapshotProvider);
      ref.invalidate(providerListingsProvider);
      if (!mounted) {
        return;
      }
      HapticFeedback.mediumImpact();
      setState(() {
        _draftStatus = 'Published';
        _statusMessage =
            'Published ${result.publishedServices} services and ${result.publishedProducts} products.';
      });
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.message)));
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(AppErrorMapper.toMessage(error))),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _publishing = false);
      }
    }
  }

  void _trackStepViewed(_LaunchpadStep step) {
    if (!_trackedSteps.add(step.analyticsValue)) {
      return;
    }
    ref
        .read(analyticsServiceProvider)
        .trackEvent(
          'launchpad_step_viewed',
          extras: _analyticsExtras(step: step),
        );
  }

  void _trackAiReviewStarted() {
    if (_trackedAiReview) {
      return;
    }
    _trackedAiReview = true;
    ref
        .read(analyticsServiceProvider)
        .trackEvent('launchpad_ai_review_started', extras: _analyticsExtras());
  }

  void _trackPublishReadyIfNeeded() {
    if (_trackedPublishReady || !_readiness.ready) {
      return;
    }
    _trackedPublishReady = true;
    ref
        .read(analyticsServiceProvider)
        .trackEvent('launchpad_publish_ready', extras: _analyticsExtras());
  }

  Map<String, Object> _analyticsExtras({_LaunchpadStep? step}) {
    final answers = _readAnswers();
    return {
      'step': (step ?? _step).analyticsValue,
      'offering_type': _offeringType,
      'tone': _brandTone,
      'has_business_name': answers.businessName.isNotEmpty,
      'has_category': answers.primaryCategory.isNotEmpty,
      'has_location': answers.location.isNotEmpty,
      'has_offerings': answers.coreOfferings.isNotEmpty,
    };
  }

  bool _validateCurrentStep() {
    return _formKey.currentState?.validate() ?? true;
  }

  void _goToStep(_LaunchpadStep step) {
    if (step == _step) {
      return;
    }
    setState(() => _step = step);
    _trackStepViewed(step);
    if (step == _LaunchpadStep.aiDraft) {
      _trackAiReviewStarted();
    }
    if (step == _LaunchpadStep.publish) {
      _trackPublishReadyIfNeeded();
    }
  }

  void _continue() {
    if (!_validateCurrentStep()) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Fill in all required fields to continue.')),
      );
      return;
    }
    switch (_step) {
      case _LaunchpadStep.basics:
        _goToStep(_LaunchpadStep.offers);
      case _LaunchpadStep.offers:
        _goToStep(_LaunchpadStep.aiDraft);
      case _LaunchpadStep.aiDraft:
        _goToStep(_LaunchpadStep.publish);
      case _LaunchpadStep.publish:
        unawaited(_publish());
    }
  }

  void _back() {
    if (_step == _LaunchpadStep.basics && _hasDraftContent) {
      _showDiscardDialog();
      return;
    }
    switch (_step) {
      case _LaunchpadStep.basics:
        _goBackOrHome();
      case _LaunchpadStep.offers:
        _goToStep(_LaunchpadStep.basics);
      case _LaunchpadStep.aiDraft:
        _goToStep(_LaunchpadStep.offers);
      case _LaunchpadStep.publish:
        _goToStep(_LaunchpadStep.aiDraft);
    }
  }

  void _goBackOrHome() {
    final router = GoRouter.of(context);
    if (router.canPop()) {
      router.pop();
    } else {
      router.go(AppRoutes.home);
    }
  }

  Future<void> _showDiscardDialog() {
    final router = GoRouter.of(context);
    return showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Discard changes?'),
        content: const Text(
          'You have unsaved changes to your business profile. '
          'Are you sure you want to discard them?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Keep editing'),
          ),
          TextButton(
            onPressed: () => router.go(AppRoutes.home),
            child: const Text('Discard'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final workspaceAsync = ref.watch(launchpadWorkspaceProvider);

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) {
          _back();
        }
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Business AI setup'),
          automaticallyImplyLeading: false,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_rounded),
            onPressed: _back,
          ),
        ),
        body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _refresh,
          child: ServiqAsyncBody<MobileLaunchpadWorkspace>(
            value: workspaceAsync,
            errorTitle: 'Unable to load launchpad',
            errorMessageFor: (error, _) => AppErrorMapper.toMessage(error),
            onRetry: _refresh,
            loadingBuilder: () => const _LaunchpadLoading(),
            errorBuilder: (error, stackTrace) => ListView(
              padding: const EdgeInsets.all(16),
              children: [
                SectionCard(
                  child: ErrorStateView(
                    title: 'Unable to load launchpad',
                    message: AppErrorMapper.toMessage(error),
                    onRetry: _refresh,
                  ),
                ),
              ],
            ),
            data: (workspace) {
              _hydrate(workspace);
              return ListView(
                keyboardDismissBehavior:
                    ScrollViewKeyboardDismissBehavior.onDrag,
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
                children: [
                  _LaunchpadHero(
                    workspace: workspace,
                    draftStatus: _draftStatus,
                    autosaving: _autosaving,
                  ),
                  const SizedBox(height: 16),
                  _LaunchpadStepper(currentStep: _step, onTap: _goToStep),
                  const SizedBox(height: 16),
                  _LaunchpadMetrics(
                    workspace: workspace,
                    readiness: _readiness,
                  ),
                  const SizedBox(height: 16),
                  Form(
                    key: _formKey,
                    child: _CurrentStepCard(
                      step: _step,
                      workspace: workspace,
                      answers: _readAnswers(),
                      readiness: _readiness,
                      businessNameController: _businessNameController,
                      locationController: _locationController,
                      serviceAreaController: _serviceAreaController,
                      radiusController: _radiusController,
                      descriptionController: _descriptionController,
                      offeringsController: _offeringsController,
                      catalogController: _catalogController,
                      pricingController: _pricingController,
                      hoursController: _hoursController,
                      phoneController: _phoneController,
                      websiteController: _websiteController,
                      offeringType: _offeringType,
                      brandTone: _brandTone,
                      businessType: _businessType,
                      primaryCategory: _primaryCategory,
                      latitude: _latitude,
                      longitude: _longitude,
                      locatingGps: _locatingGps,
                      onOfferingTypeChanged: (value) =>
                          _handleDropdownChanged(() => _offeringType = value),
                      onBrandToneChanged: (value) =>
                          _handleDropdownChanged(() => _brandTone = value),
                      onBusinessTypeChanged: (value) =>
                          _handleDropdownChanged(() => _businessType = value),
                      onCategoryChanged: (value) =>
                          _handleDropdownChanged(() => _primaryCategory = value),
                      onGps: _handleGps,
                      onAiReviewStarted: _trackAiReviewStarted,
                    ),
                  ),
                  if ((_statusMessage ?? '').isNotEmpty) ...[
                    const SizedBox(height: 12),
                    _StatusPanel(message: _statusMessage!),
                  ],
                  const SizedBox(height: 16),
                  _LaunchpadActions(
                    step: _step,
                    saving: _saving,
                    publishing: _publishing,
                    onBack: _back,
                    onContinue: _continue,
                    onSave: _saving || _publishing
                        ? null
                        : () => _saveDraft(quiet: false, validate: false),
                  ),
                ],
              );
            },
          ),
        ),
        ),
      ),
    );
  }
}

class _LaunchpadHero extends StatelessWidget {
  const _LaunchpadHero({
    required this.workspace,
    required this.draftStatus,
    required this.autosaving,
  });

  final MobileLaunchpadWorkspace workspace;
  final String draftStatus;
  final bool autosaving;

  @override
  Widget build(BuildContext context) {
    final draft = workspace.draft;

    return PremiumSurface(
      gradient: Theme.of(context).extension<ServiqThemeTokens>()?.heroGradient,
      borderColor: Colors.white.withValues(alpha: 0.18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const PremiumPill(
            label: 'Guided Business AI',
            icon: Icons.auto_awesome_rounded,
            backgroundColor: Color(0x22FFFFFF),
            foregroundColor: Colors.white,
            borderColor: Color(0x33FFFFFF),
          ),
          const SizedBox(height: 14),
          Text(
            draft == null
                ? 'Build your public business profile'
                : 'Review your Business AI setup',
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(color: Colors.white),
          ),
          const SizedBox(height: 8),
          Text(
            'Move step by step from basics to offers, AI review, and publish readiness.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: Colors.white.withValues(alpha: 0.84),
            ),
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              PremiumPill(
                label: autosaving ? 'Autosaving...' : draftStatus,
                icon: autosaving
                    ? Icons.sync_rounded
                    : Icons.cloud_done_outlined,
                backgroundColor: Colors.white.withValues(alpha: 0.12),
                foregroundColor: Colors.white,
                borderColor: Colors.white.withValues(alpha: 0.18),
              ),
              PremiumPill(
                label: draft?.status ?? 'Not started',
                icon: Icons.edit_note_rounded,
                backgroundColor: Colors.white.withValues(alpha: 0.12),
                foregroundColor: Colors.white,
                borderColor: Colors.white.withValues(alpha: 0.18),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _LaunchpadStepper extends StatelessWidget {
  const _LaunchpadStepper({required this.currentStep, required this.onTap});

  final _LaunchpadStep currentStep;
  final ValueChanged<_LaunchpadStep> onTap;

  @override
  Widget build(BuildContext context) {
    return ServiqStepper<_LaunchpadStep>(
      value: currentStep,
      onChanged: onTap,
      steps: _LaunchpadStep.values
          .map(
            (step) => ServiqStepItem<_LaunchpadStep>(
              key: ValueKey('launchpad-step-${step.analyticsValue}'),
              value: step,
              label: step.label,
              icon: step.icon,
            ),
          )
          .toList(),
    );
  }
}

class _LaunchpadMetrics extends StatelessWidget {
  const _LaunchpadMetrics({required this.workspace, required this.readiness});

  final MobileLaunchpadWorkspace workspace;
  final _PublishReadiness readiness;

  @override
  Widget build(BuildContext context) {
    final summary = workspace.summary;
    return LayoutBuilder(
      builder: (context, constraints) {
        const gap = 12.0;
        final width = (constraints.maxWidth - gap) / 2;
        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: [
            SizedBox(
              width: width,
              child: MetricTile(
                label: 'Readiness',
                value: '${readiness.completedCount}/${readiness.totalCount}',
                icon: Icons.fact_check_outlined,
              ),
            ),
            SizedBox(
              width: width,
              child: MetricTile(
                label: 'Live offers',
                value: '${summary.totalServices + summary.totalProducts}',
                icon: Icons.storefront_outlined,
              ),
            ),
          ],
        );
      },
    );
  }
}

class _CurrentStepCard extends StatelessWidget {
  const _CurrentStepCard({
    required this.step,
    required this.workspace,
    required this.answers,
    required this.readiness,
    required this.businessNameController,
    required this.locationController,
    required this.serviceAreaController,
    required this.radiusController,
    required this.descriptionController,
    required this.offeringsController,
    required this.catalogController,
    required this.pricingController,
    required this.hoursController,
    required this.phoneController,
    required this.websiteController,
    required this.offeringType,
    required this.brandTone,
    required this.businessType,
    required this.primaryCategory,
    required this.latitude,
    required this.longitude,
    required this.locatingGps,
    required this.onOfferingTypeChanged,
    required this.onBrandToneChanged,
    required this.onBusinessTypeChanged,
    required this.onCategoryChanged,
    required this.onGps,
    required this.onAiReviewStarted,
  });

  final _LaunchpadStep step;
  final MobileLaunchpadWorkspace workspace;
  final MobileLaunchpadAnswers answers;
  final _PublishReadiness readiness;
  final TextEditingController businessNameController;
  final TextEditingController locationController;
  final TextEditingController serviceAreaController;
  final TextEditingController radiusController;
  final TextEditingController descriptionController;
  final TextEditingController offeringsController;
  final TextEditingController catalogController;
  final TextEditingController pricingController;
  final TextEditingController hoursController;
  final TextEditingController phoneController;
  final TextEditingController websiteController;
  final String offeringType;
  final String brandTone;
  final String businessType;
  final String primaryCategory;
  final double? latitude;
  final double? longitude;
  final bool locatingGps;
  final ValueChanged<String> onOfferingTypeChanged;
  final ValueChanged<String> onBrandToneChanged;
  final ValueChanged<String> onBusinessTypeChanged;
  final ValueChanged<String> onCategoryChanged;
  final VoidCallback onGps;
  final VoidCallback onAiReviewStarted;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: switch (step) {
        _LaunchpadStep.basics => _BasicsStep(
          businessNameController: businessNameController,
          businessType: businessType,
          primaryCategory: primaryCategory,
          locationController: locationController,
          serviceAreaController: serviceAreaController,
          radiusController: radiusController,
          brandTone: brandTone,
          latitude: latitude,
          longitude: longitude,
          locatingGps: locatingGps,
          onBrandToneChanged: onBrandToneChanged,
          onBusinessTypeChanged: onBusinessTypeChanged,
          onCategoryChanged: onCategoryChanged,
          onGps: onGps,
        ),
        _LaunchpadStep.offers => _OffersStep(
          offeringType: offeringType,
          offeringsController: offeringsController,
          catalogController: catalogController,
          pricingController: pricingController,
          hoursController: hoursController,
          phoneController: phoneController,
          websiteController: websiteController,
          onOfferingTypeChanged: onOfferingTypeChanged,
        ),
        _LaunchpadStep.aiDraft => _AiDraftStep(
          answers: answers,
          workspace: workspace,
          descriptionController: descriptionController,
          onAiReviewStarted: onAiReviewStarted,
        ),
        _LaunchpadStep.publish => _PublishStep(
          answers: answers,
          workspace: workspace,
          readiness: readiness,
        ),
      },
    );
  }
}

class _BasicsStep extends StatelessWidget {
  const _BasicsStep({
    required this.businessNameController,
    required this.businessType,
    required this.primaryCategory,
    required this.locationController,
    required this.serviceAreaController,
    required this.radiusController,
    required this.brandTone,
    required this.latitude,
    required this.longitude,
    required this.locatingGps,
    required this.onBrandToneChanged,
    required this.onBusinessTypeChanged,
    required this.onCategoryChanged,
    required this.onGps,
  });

  final TextEditingController businessNameController;
  final String businessType;
  final String primaryCategory;
  final TextEditingController locationController;
  final TextEditingController serviceAreaController;
  final TextEditingController radiusController;
  final String brandTone;
  final double? latitude;
  final double? longitude;
  final bool locatingGps;
  final ValueChanged<String> onBrandToneChanged;
  final ValueChanged<String> onBusinessTypeChanged;
  final ValueChanged<String> onCategoryChanged;
  final VoidCallback onGps;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _StepHeader(
          title: 'Basics',
          subtitle:
              'Tell Business AI who you are and where customers can find you.',
        ),
        _TextField(
          controller: businessNameController,
          label: 'Business or provider name',
          validator: _required('Add a public name.'),
        ),
        _DropdownField(
          label: 'Business type',
          value: businessType,
          values: businessTypes,
          onChanged: onBusinessTypeChanged,
        ),
        _DropdownField(
          label: 'Primary category',
          value: primaryCategory,
          values: categories,
          onChanged: onCategoryChanged,
        ),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: _TextField(
                controller: locationController,
                label: 'Base location',
                validator: _required('Add a location.'),
              ),
            ),
            const SizedBox(width: 8),
            SizedBox(
              height: 56,
              child: OutlinedButton.icon(
                onPressed: locatingGps ? null : onGps,
                icon: locatingGps
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Icon(
                        Icons.location_on_outlined,
                        color: Theme.of(context).colorScheme.primary,
                      ),
                label: Text(
                  'GPS',
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.primary,
                  ),
                ),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppRadii.md),
                  ),
                ),
              ),
            ),
          ],
        ),
        if (latitude != null && longitude != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Text(
              'Coordinates saved: ${latitude!.toStringAsFixed(4)}, ${longitude!.toStringAsFixed(4)}',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: AppColors.success,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        _TextField(controller: serviceAreaController, label: 'Service area'),
        _TextField(
          controller: radiusController,
          label: 'Service radius in km',
          keyboardType: TextInputType.number,
        ),
        _DropdownField(
          label: 'Business tone',
          value: brandTone,
          values: const [
            'professional',
            'friendly',
            'premium',
            'fast',
            'community',
          ],
          onChanged: onBrandToneChanged,
        ),
      ],
    );
  }
}

class _OffersStep extends StatelessWidget {
  const _OffersStep({
    required this.offeringType,
    required this.offeringsController,
    required this.catalogController,
    required this.pricingController,
    required this.hoursController,
    required this.phoneController,
    required this.websiteController,
    required this.onOfferingTypeChanged,
  });

  final String offeringType;
  final TextEditingController offeringsController;
  final TextEditingController catalogController;
  final TextEditingController pricingController;
  final TextEditingController hoursController;
  final TextEditingController phoneController;
  final TextEditingController websiteController;
  final ValueChanged<String> onOfferingTypeChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _StepHeader(
          title: 'Offers',
          subtitle:
              'Add the services, products, pricing notes, and availability AI should shape.',
        ),
        _DropdownField(
          label: 'Offer type',
          value: offeringType,
          values: const ['services', 'products', 'hybrid'],
          onChanged: onOfferingTypeChanged,
        ),
        const SizedBox(height: 12),
        _TextField(
          controller: offeringsController,
          label: 'Core offerings',
          hint: 'One per line works well',
          maxLines: 4,
          validator: _required('Add at least one offer.'),
        ),
        _TextField(
          controller: catalogController,
          label: 'Catalog details',
          hint: 'Paste products, packs, service variants',
          maxLines: 4,
        ),
        _TextField(
          controller: pricingController,
          label: 'Pricing notes',
          maxLines: 3,
        ),
        _TextField(
          controller: hoursController,
          label: 'Availability and hours',
        ),
        _TextField(
          controller: phoneController,
          label: 'Phone',
          keyboardType: TextInputType.phone,
        ),
        _TextField(
          controller: websiteController,
          label: 'Website',
          keyboardType: TextInputType.url,
        ),
      ],
    );
  }
}

class _AiDraftStep extends StatelessWidget {
  const _AiDraftStep({
    required this.answers,
    required this.workspace,
    required this.descriptionController,
    required this.onAiReviewStarted,
  });

  final MobileLaunchpadAnswers answers;
  final MobileLaunchpadWorkspace workspace;
  final TextEditingController descriptionController;
  final VoidCallback onAiReviewStarted;

  @override
  Widget build(BuildContext context) {
    final generated = _generatedOfferings(workspace);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _StepHeader(
          title: 'AI Draft',
          subtitle:
              'Review the public copy and listing direction before anything goes live.',
        ),
        PrimaryButton(
          label: 'Review AI draft',
          icon: const Icon(Icons.auto_awesome_rounded),
          onPressed: onAiReviewStarted,
        ),
        const SizedBox(height: 14),
        _TextField(
          controller: descriptionController,
          label: 'Short profile summary',
          hint: 'What should customers know first?',
          maxLines: 4,
        ),
        const SizedBox(height: 8),
        _PublicProfilePreview(answers: answers),
        const SizedBox(height: 12),
        if (generated.isEmpty)
          EmptyStateView(
            title: 'Generated listings will appear after publish',
            message:
                'Business AI will use your offers, catalog, and pricing notes to create reviewable listings.',
          )
        else
          _GeneratedPreview(offerings: generated),
      ],
    );
  }
}

class _PublishStep extends StatelessWidget {
  const _PublishStep({
    required this.answers,
    required this.workspace,
    required this.readiness,
  });

  final MobileLaunchpadAnswers answers;
  final MobileLaunchpadWorkspace workspace;
  final _PublishReadiness readiness;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _StepHeader(
          title: 'Publish Readiness',
          subtitle:
              'Check what will go public before your profile and listings are published.',
        ),
        _ReadinessChecklist(readiness: readiness),
        const SizedBox(height: 14),
        Text(
          'What will go public',
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: 10),
        _PublicProfilePreview(answers: answers),
        const SizedBox(height: 12),
        _GeneratedPreview(offerings: _generatedOfferings(workspace)),
      ],
    );
  }
}

class _StepHeader extends StatelessWidget {
  const _StepHeader({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 6),
          Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
        ],
      ),
    );
  }
}

class _ReadinessChecklist extends StatelessWidget {
  const _ReadinessChecklist({required this.readiness});

  final _PublishReadiness readiness;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (final item in readiness.items)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: _ReadinessItemTile(item: item),
          ),
      ],
    );
  }
}

class _ReadinessItemTile extends StatelessWidget {
  const _ReadinessItemTile({required this.item});

  final _ReadinessItem item;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: item.done ? AppColors.successSoft : AppColors.surfaceMuted,
        borderRadius: BorderRadius.circular(AppRadii.md),
        border: Border.all(
          color: item.done
              ? AppColors.success.withValues(alpha: 0.14)
              : AppColors.border,
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            item.done
                ? Icons.check_circle_rounded
                : Icons.radio_button_unchecked_rounded,
            color: item.done ? AppColors.success : AppColors.inkSubtle,
            size: 20,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item.title, style: Theme.of(context).textTheme.labelLarge),
                const SizedBox(height: 3),
                Text(
                  item.description,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PublicProfilePreview extends StatelessWidget {
  const _PublicProfilePreview({required this.answers});

  final MobileLaunchpadAnswers answers;

  @override
  Widget build(BuildContext context) {
    final title = answers.businessName.isEmpty
        ? 'Business name'
        : answers.businessName;
    final category = answers.primaryCategory.isEmpty
        ? 'Primary category'
        : answers.primaryCategory;
    final location = answers.location.isEmpty
        ? 'Base location'
        : answers.location;
    final summary = answers.shortDescription.isEmpty
        ? _fallbackSummary(answers)
        : answers.shortDescription;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surfaceMuted,
        borderRadius: BorderRadius.circular(AppRadii.md),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 6),
          Text(
            '$category / $location',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          if (answers.latitude != null && answers.longitude != null) ...[
            const SizedBox(height: 4),
            Text(
              'GPS: ${answers.latitude!.toStringAsFixed(4)}, ${answers.longitude!.toStringAsFixed(4)}',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: AppColors.success,
              ),
            ),
          ],
          const SizedBox(height: 10),
          Text(summary, style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              PremiumPill(
                label: _humanize(answers.offeringType),
                icon: Icons.inventory_2_outlined,
              ),
              PremiumPill(
                label: _humanize(answers.brandTone),
                icon: Icons.record_voice_over_outlined,
              ),
              if (answers.serviceArea.isNotEmpty)
                PremiumPill(
                  label: answers.serviceArea,
                  icon: Icons.location_searching_rounded,
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _GeneratedPreview extends StatelessWidget {
  const _GeneratedPreview({required this.offerings});

  final List<MobileLaunchpadGeneratedOffering> offerings;

  @override
  Widget build(BuildContext context) {
    if (offerings.isEmpty) {
      return const EmptyStateView(
        title: 'No generated listings yet',
        message:
            'Your saved answers are enough to start. Generated listings will appear here after Business AI publishes them.',
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Generated listings',
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: 10),
        ...offerings
            .take(5)
            .map(
              (offering) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _PreviewTile(offering: offering),
              ),
            ),
      ],
    );
  }
}

class _PreviewTile extends StatelessWidget {
  const _PreviewTile({required this.offering});

  final MobileLaunchpadGeneratedOffering offering;

  @override
  Widget build(BuildContext context) {
    final price = offering.price;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadii.md),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(offering.title, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 4),
          Text(
            [
              if (offering.category.isNotEmpty) offering.category,
              if (price != null && price > 0) 'INR ${price.round()}',
            ].join(' / '),
            style: Theme.of(context).textTheme.bodySmall,
          ),
          if (offering.description.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              offering.description,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ],
        ],
      ),
    );
  }
}

class _LaunchpadActions extends StatelessWidget {
  const _LaunchpadActions({
    required this.step,
    required this.saving,
    required this.publishing,
    required this.onBack,
    required this.onContinue,
    required this.onSave,
  });

  final _LaunchpadStep step;
  final bool saving;
  final bool publishing;
  final VoidCallback onBack;
  final VoidCallback onContinue;
  final VoidCallback? onSave;

  @override
  Widget build(BuildContext context) {
    final primaryLabel = step == _LaunchpadStep.publish
        ? (publishing ? 'Publishing...' : 'Publish profile')
        : 'Continue';

    return Column(
      children: [
        PrimaryButton(
          key: const ValueKey('launchpad-primary-action'),
          label: primaryLabel,
          icon: publishing
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : Icon(
                  step == _LaunchpadStep.publish
                      ? Icons.rocket_launch_outlined
                      : Icons.arrow_forward_rounded,
                ),
          onPressed: publishing ? null : onContinue,
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: SecondaryButton(
                label: 'Back',
                icon: const Icon(Icons.arrow_back_rounded),
                onPressed: publishing ? null : onBack,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: SecondaryButton(
                key: const ValueKey('launchpad-save-draft-action'),
                label: saving ? 'Saving...' : 'Save draft',
                icon: saving
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.save_outlined),
                onPressed: publishing ? null : onSave,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _StatusPanel extends StatelessWidget {
  const _StatusPanel({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      padding: const EdgeInsets.all(12),
      child: Row(
        children: [
          const Icon(Icons.info_outline_rounded, color: AppColors.primary),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: AppColors.primaryDeep,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TextField extends StatelessWidget {
  const _TextField({
    required this.controller,
    required this.label,
    this.hint,
    this.maxLines = 1,
    this.keyboardType,
    this.validator,
  });

  final TextEditingController controller;
  final String label;
  final String? hint;
  final int maxLines;
  final TextInputType? keyboardType;
  final String? Function(String?)? validator;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        controller: controller,
        maxLines: maxLines,
        keyboardType: keyboardType,
        decoration: InputDecoration(labelText: label, hintText: hint),
        validator: validator,
      ),
    );
  }
}

class _DropdownField extends StatelessWidget {
  const _DropdownField({
    required this.label,
    required this.value,
    required this.values,
    required this.onChanged,
  });

  final String label;
  final String value;
  final List<String> values;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<String>(
      initialValue: value,
      isExpanded: true,
      decoration: InputDecoration(labelText: label),
      items: values
          .map(
            (item) => DropdownMenuItem<String>(
              value: item,
              child: Text(_humanize(item)),
            ),
          )
          .toList(),
      onChanged: (next) {
        if (next != null) {
          onChanged(next);
        }
      },
    );
  }
}

class _LaunchpadLoading extends StatelessWidget {
  const _LaunchpadLoading();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: List.generate(
        3,
        (index) => Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: SectionCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                LoadingShimmer(height: 22, width: 180),
                SizedBox(height: 12),
                LoadingShimmer(height: 14),
                SizedBox(height: 10),
                LoadingShimmer(height: 90),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _PublishReadiness {
  const _PublishReadiness({required this.items});

  factory _PublishReadiness.from(MobileLaunchpadAnswers answers) {
    final items = [
      _ReadinessItem(
        title: 'Business basics',
        description: 'Public name, category, and base location are ready.',
        done:
            answers.businessName.isNotEmpty &&
            answers.primaryCategory.isNotEmpty &&
            answers.location.isNotEmpty,
        step: _LaunchpadStep.basics,
      ),
      _ReadinessItem(
        title: 'Offer catalog',
        description: 'At least one service or product has enough detail.',
        done: answers.coreOfferings.isNotEmpty,
        step: _LaunchpadStep.offers,
      ),
      _ReadinessItem(
        title: 'Customer-facing copy',
        description: 'Profile summary or AI fallback copy can be shown.',
        done:
            answers.shortDescription.isNotEmpty ||
            (answers.businessName.isNotEmpty &&
                answers.coreOfferings.isNotEmpty),
        step: _LaunchpadStep.aiDraft,
      ),
      _ReadinessItem(
        title: 'Contact or availability',
        description: 'Customers have a contact path or available hours.',
        done: answers.phone.isNotEmpty || answers.hours.isNotEmpty,
        step: _LaunchpadStep.offers,
      ),
    ];
    return _PublishReadiness(items: items);
  }

  final List<_ReadinessItem> items;

  int get totalCount => items.length;
  int get completedCount => items.where((item) => item.done).length;
  bool get ready => items.every((item) => item.done);
  _LaunchpadStep get firstIncompleteStep =>
      items.firstWhere((item) => !item.done, orElse: () => items.last).step;
}

class _ReadinessItem {
  const _ReadinessItem({
    required this.title,
    required this.description,
    required this.done,
    required this.step,
  });

  final String title;
  final String description;
  final bool done;
  final _LaunchpadStep step;
}

List<MobileLaunchpadGeneratedOffering> _generatedOfferings(
  MobileLaunchpadWorkspace workspace,
) {
  final draft = workspace.draft;
  return [
    ...(draft?.generatedServices ?? const <MobileLaunchpadGeneratedOffering>[]),
    ...(draft?.generatedProducts ?? const <MobileLaunchpadGeneratedOffering>[]),
  ];
}

String? Function(String?) _required(String message) {
  return (value) {
    if ((value ?? '').trim().isEmpty) {
      return message;
    }
    return null;
  };
}

String _validOfferingType(String value) {
  return const {'services', 'products', 'hybrid'}.contains(value)
      ? value
      : 'services';
}

String _validBrandTone(String value) {
  return const {
        'professional',
        'friendly',
        'premium',
        'fast',
        'community',
      }.contains(value)
      ? value
      : 'friendly';
}

String _validBusinessType(String value) {
  return businessTypes.contains(value) ? value : '';
}

String _validCategory(String value) {
  return categories.contains(value) ? value : '';
}

String _fallbackSummary(MobileLaunchpadAnswers answers) {
  final business = answers.businessName.isEmpty
      ? 'This provider'
      : answers.businessName;
  final category = answers.primaryCategory.isEmpty
      ? 'local services'
      : answers.primaryCategory;
  final location = answers.location.isEmpty
      ? 'nearby'
      : 'in ${answers.location}';
  return '$business offers trusted $category $location with clear availability, pricing context, and local follow-through.';
}

String _humanize(String raw) {
  return raw
      .split('_')
      .map(
        (part) => part.isEmpty
            ? part
            : '${part[0].toUpperCase()}${part.substring(1)}',
      )
      .join(' ');
}
