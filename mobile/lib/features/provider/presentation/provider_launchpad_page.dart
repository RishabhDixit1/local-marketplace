import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/error/app_error_mapper.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/section_card.dart';
import '../../../shared/components/app_buttons.dart';
import '../../../shared/components/empty_state_view.dart';
import '../../../shared/components/error_state_view.dart';
import '../../../shared/components/loading_shimmer.dart';
import '../../../shared/components/metric_tile.dart';
import '../data/launchpad_repository.dart';
import '../data/provider_listing_repository.dart';
import '../domain/launchpad_models.dart';
import '../../profile/data/profile_repository.dart';

class ProviderLaunchpadPage extends ConsumerStatefulWidget {
  const ProviderLaunchpadPage({super.key});

  @override
  ConsumerState<ProviderLaunchpadPage> createState() =>
      _ProviderLaunchpadPageState();
}

class _ProviderLaunchpadPageState extends ConsumerState<ProviderLaunchpadPage> {
  final _formKey = GlobalKey<FormState>();
  final _businessNameController = TextEditingController();
  final _businessTypeController = TextEditingController(text: 'local_service');
  final _categoryController = TextEditingController();
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

  String _offeringType = 'services';
  String _brandTone = 'friendly';
  String? _loadedDraftId;
  bool _saving = false;
  bool _publishing = false;
  String? _statusMessage;

  @override
  void dispose() {
    _businessNameController.dispose();
    _businessTypeController.dispose();
    _categoryController.dispose();
    _locationController.dispose();
    _serviceAreaController.dispose();
    _radiusController.dispose();
    _descriptionController.dispose();
    _offeringsController.dispose();
    _catalogController.dispose();
    _pricingController.dispose();
    _hoursController.dispose();
    _phoneController.dispose();
    _websiteController.dispose();
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
      return;
    }
    _loadedDraftId = id;

    final answers = draft?.answers ?? MobileLaunchpadAnswers.empty();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) {
        return;
      }
      _businessNameController.text = answers.businessName;
      _businessTypeController.text = answers.businessType;
      _categoryController.text = answers.primaryCategory;
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
      });
    });
  }

  MobileLaunchpadAnswers _readAnswers() {
    return MobileLaunchpadAnswers(
      businessName: _businessNameController.text.trim(),
      businessType: _businessTypeController.text.trim().isEmpty
          ? 'local_service'
          : _businessTypeController.text.trim(),
      offeringType: _offeringType,
      primaryCategory: _categoryController.text.trim(),
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
    );
  }

  Future<MobileLaunchpadDraft?> _saveDraft({bool quiet = false}) async {
    if (!_formKey.currentState!.validate()) {
      return null;
    }

    FocusScope.of(context).unfocus();
    setState(() {
      _saving = true;
      if (!quiet) {
        _statusMessage = null;
      }
    });

    try {
      final draft = await ref
          .read(launchpadRepositoryProvider)
          .saveDraft(_readAnswers());
      ref.invalidate(launchpadWorkspaceProvider);
      ref.invalidate(profileSnapshotProvider);
      if (!mounted) {
        return draft;
      }
      if (!quiet) {
        setState(
          () => _statusMessage = 'Draft saved on your provider profile.',
        );
      }
      return draft;
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.message)));
      }
      return null;
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(AppErrorMapper.toMessage(error))),
        );
      }
      return null;
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }

  Future<void> _publish() async {
    final draft = await _saveDraft(quiet: true);
    if (draft == null) {
      return;
    }

    setState(() {
      _publishing = true;
      _statusMessage = null;
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

  @override
  Widget build(BuildContext context) {
    final workspaceAsync = ref.watch(launchpadWorkspaceProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Provider launchpad')),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _refresh,
          child: workspaceAsync.when(
            data: (workspace) {
              _hydrate(workspace);
              return ListView(
                keyboardDismissBehavior:
                    ScrollViewKeyboardDismissBehavior.onDrag,
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
                children: [
                  _LaunchpadHero(workspace: workspace),
                  const SizedBox(height: 16),
                  _LaunchpadMetrics(workspace: workspace),
                  const SizedBox(height: 16),
                  SectionCard(
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Identity and area',
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                          const SizedBox(height: 12),
                          _TextField(
                            controller: _businessNameController,
                            label: 'Business or provider name',
                            validator: _required('Add a public name.'),
                          ),
                          _TextField(
                            controller: _businessTypeController,
                            label: 'Business type',
                          ),
                          _TextField(
                            controller: _categoryController,
                            label: 'Primary category',
                            validator: _required('Add a category.'),
                          ),
                          _TextField(
                            controller: _locationController,
                            label: 'Base location',
                            validator: _required('Add a location.'),
                          ),
                          _TextField(
                            controller: _serviceAreaController,
                            label: 'Service area',
                          ),
                          _TextField(
                            controller: _radiusController,
                            label: 'Service radius in km',
                            keyboardType: TextInputType.number,
                          ),
                          const SizedBox(height: 8),
                          _DropdownField(
                            label: 'Offer type',
                            value: _offeringType,
                            values: const ['services', 'products', 'hybrid'],
                            onChanged: (value) =>
                                setState(() => _offeringType = value),
                          ),
                          const SizedBox(height: 12),
                          _DropdownField(
                            label: 'Tone',
                            value: _brandTone,
                            values: const [
                              'professional',
                              'friendly',
                              'premium',
                              'fast',
                              'community',
                            ],
                            onChanged: (value) =>
                                setState(() => _brandTone = value),
                          ),
                          const SizedBox(height: 20),
                          Text(
                            'Services, products, and availability',
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                          const SizedBox(height: 12),
                          _TextField(
                            controller: _descriptionController,
                            label: 'Short profile summary',
                            maxLines: 3,
                          ),
                          _TextField(
                            controller: _offeringsController,
                            label: 'Core offerings',
                            hint: 'One per line works well',
                            maxLines: 4,
                            validator: _required('Add at least one offer.'),
                          ),
                          _TextField(
                            controller: _catalogController,
                            label: 'Catalog details',
                            hint: 'Paste products, packs, service variants',
                            maxLines: 4,
                          ),
                          _TextField(
                            controller: _pricingController,
                            label: 'Pricing notes',
                            maxLines: 3,
                          ),
                          _TextField(
                            controller: _hoursController,
                            label: 'Availability and hours',
                          ),
                          _TextField(
                            controller: _phoneController,
                            label: 'Phone',
                            keyboardType: TextInputType.phone,
                          ),
                          _TextField(
                            controller: _websiteController,
                            label: 'Website',
                            keyboardType: TextInputType.url,
                          ),
                          const SizedBox(height: 16),
                          if ((_statusMessage ?? '').isNotEmpty)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: Text(
                                _statusMessage!,
                                style: Theme.of(context).textTheme.bodyMedium
                                    ?.copyWith(
                                      color: AppColors.primary,
                                      fontWeight: FontWeight.w800,
                                    ),
                              ),
                            ),
                          PrimaryButton(
                            label: _publishing ? 'Publishing...' : 'Publish',
                            icon: _publishing
                                ? const SizedBox(
                                    width: 16,
                                    height: 16,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                    ),
                                  )
                                : const Icon(Icons.rocket_launch_outlined),
                            onPressed: _saving || _publishing ? null : _publish,
                          ),
                          const SizedBox(height: 10),
                          SecondaryButton(
                            label: _saving ? 'Saving...' : 'Save draft',
                            icon: _saving
                                ? const SizedBox(
                                    width: 16,
                                    height: 16,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                    ),
                                  )
                                : const Icon(Icons.save_outlined),
                            onPressed: _saving || _publishing
                                ? null
                                : () => _saveDraft(),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  _GeneratedPreview(workspace: workspace),
                ],
              );
            },
            loading: () => const _LaunchpadLoading(),
            error: (error, _) => ListView(
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
          ),
        ),
      ),
    );
  }
}

class _LaunchpadHero extends StatelessWidget {
  const _LaunchpadHero({required this.workspace});

  final MobileLaunchpadWorkspace workspace;

  @override
  Widget build(BuildContext context) {
    final draft = workspace.draft;
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            draft == null
                ? 'Create provider identity'
                : 'Edit provider identity',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 8),
          Text(
            'Use this phone-first launchpad to shape identity, location, catalog, availability, and publishing in one pass.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              Chip(label: Text(draft?.status ?? 'not started')),
              if (workspace.summary.profilePath != null)
                Chip(label: Text(workspace.summary.profilePath!)),
            ],
          ),
        ],
      ),
    );
  }
}

class _LaunchpadMetrics extends StatelessWidget {
  const _LaunchpadMetrics({required this.workspace});

  final MobileLaunchpadWorkspace workspace;

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
                label: 'Services',
                value: summary.totalServices.toString(),
                icon: Icons.design_services_outlined,
              ),
            ),
            SizedBox(
              width: width,
              child: MetricTile(
                label: 'Products',
                value: summary.totalProducts.toString(),
                icon: Icons.inventory_2_outlined,
              ),
            ),
          ],
        );
      },
    );
  }
}

class _GeneratedPreview extends StatelessWidget {
  const _GeneratedPreview({required this.workspace});

  final MobileLaunchpadWorkspace workspace;

  @override
  Widget build(BuildContext context) {
    final draft = workspace.draft;
    final offerings = [
      ...(draft?.generatedServices ??
          const <MobileLaunchpadGeneratedOffering>[]),
      ...(draft?.generatedProducts ??
          const <MobileLaunchpadGeneratedOffering>[]),
    ];

    if (draft == null || offerings.isEmpty) {
      return const SectionCard(
        child: EmptyStateView(
          title: 'No generated preview yet',
          message:
              'Save and publish once your core offerings are clear. Generated listings will appear here when the backend creates them.',
        ),
      );
    }

    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Generated preview',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 12),
          ...offerings
              .take(5)
              .map(
                (offering) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _PreviewTile(offering: offering),
                ),
              ),
        ],
      ),
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
        color: AppColors.surfaceMuted,
        borderRadius: BorderRadius.circular(AppRadii.sm),
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
