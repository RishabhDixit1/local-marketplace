import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/widgets/section_card.dart';
import '../../feed/data/feed_repository.dart';
import '../../feed/domain/feed_snapshot.dart';
import '../data/create_need_repository.dart';

const _categories = [
  'Plumber',
  'Electrician',
  'AC Repair',
  'Carpenter',
  'Painter',
  'Cleaning',
  'RO Service',
  'Appliance Repair',
  'Mechanic',
  'Mobile Repair',
  'Computer Repair',
  'Tutor',
  'Delivery',
  'Tailor',
  'Beautician',
  'Photographer',
  'CCTV',
  'Internet / WiFi',
  'Other',
];

const _neededWithinOptions = [
  'Within 2 hours',
  'Today',
  'Within 24 hours',
  'This week',
  'Flexible',
];

class CreateNeedPage extends ConsumerStatefulWidget {
  const CreateNeedPage({super.key});

  @override
  ConsumerState<CreateNeedPage> createState() => _CreateNeedPageState();
}

class _CreateNeedPageState extends ConsumerState<CreateNeedPage> {
  final _stepOneFormKey = GlobalKey<FormState>();
  final _stepTwoFormKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _detailsController = TextEditingController();
  final _budgetController = TextEditingController();
  final _locationController = TextEditingController();

  int _step = 1;
  String _category = _categories.first;
  String _neededWithin = _neededWithinOptions[2];
  CreateNeedMode _mode = CreateNeedMode.urgent;
  double _radiusKm = 8;
  bool _submitting = false;
  String? _error;
  CreateNeedResult? _result;

  @override
  void dispose() {
    _titleController.dispose();
    _detailsController.dispose();
    _budgetController.dispose();
    _locationController.dispose();
    super.dispose();
  }

  String? _validateTitle(String? value) {
    final title = value?.trim() ?? '';
    if (title.isEmpty) {
      return 'Add a clear request title.';
    }
    if (title.length < 8) {
      return 'Use a little more detail in the title.';
    }
    return null;
  }

  String? _validateDetails(String? value) {
    final details = value?.trim() ?? '';
    if (details.isEmpty) {
      return 'Add the job details so providers can respond well.';
    }
    if (details.length < 20) {
      return 'Add a few more details about the job.';
    }
    return null;
  }

  String? _validateLocation(String? value) {
    final location = value?.trim() ?? '';
    if (location.isEmpty) {
      return 'Add your area, neighbourhood, or city.';
    }
    if (_looksLikeRawCoordinates(location)) {
      return 'Use a readable area name instead of raw coordinates.';
    }
    return null;
  }

  String? _validateBudget(String? value) {
    final rawValue = value?.trim() ?? '';
    if (rawValue.isEmpty) {
      return null;
    }

    final parsed = double.tryParse(rawValue);
    if (parsed == null || parsed <= 0) {
      return 'Enter a positive budget or leave it blank.';
    }
    return null;
  }

  void _continueToStepTwo() {
    setState(() {
      _error = null;
    });

    if (!_stepOneFormKey.currentState!.validate()) {
      return;
    }

    setState(() {
      _step = 2;
    });
  }

  Future<void> _publishNeed() async {
    setState(() {
      _error = null;
    });

    final stepOneValid = _stepOneFormKey.currentState!.validate();
    final stepTwoValid = _stepTwoFormKey.currentState!.validate();
    if (!stepOneValid || !stepTwoValid) {
      return;
    }

    final budgetText = _budgetController.text.trim();
    final draft = CreateNeedDraft(
      title: _titleController.text,
      details: _detailsController.text,
      category: _category,
      budget: budgetText.isEmpty ? null : double.parse(budgetText),
      locationLabel: _locationController.text,
      radiusKm: _radiusKm,
      mode: _mode,
      neededWithin: _neededWithin,
    );

    FocusScope.of(context).unfocus();
    setState(() {
      _submitting = true;
      _result = null;
    });

    try {
      final result = await ref
          .read(createNeedRepositoryProvider)
          .publishNeed(draft);
      ref.invalidate(feedSnapshotProvider(MobileFeedScope.all));
      ref.invalidate(feedSnapshotProvider(MobileFeedScope.connected));

      if (!mounted) {
        return;
      }

      setState(() {
        _result = result;
      });
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _error = error.message;
      });
    } catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _error = error.toString();
      });
    } finally {
      if (mounted) {
        setState(() {
          _submitting = false;
        });
      }
    }
  }

  void _resetComposer() {
    setState(() {
      _step = 1;
      _category = _categories.first;
      _neededWithin = _neededWithinOptions[2];
      _mode = CreateNeedMode.urgent;
      _radiusKm = 8;
      _error = null;
      _result = null;
    });
    _titleController.clear();
    _detailsController.clear();
    _budgetController.clear();
    _locationController.clear();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Create request')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
          children: [
            _CreateNeedHero(step: _step),
            const SizedBox(height: 16),
            if (_step == 1) _buildStepOne(context) else _buildStepTwo(context),
            if (_error != null) ...[
              const SizedBox(height: 14),
              SectionCard(
                child: Text(
                  _error!,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Theme.of(context).colorScheme.error,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
            if (_result != null) ...[
              const SizedBox(height: 14),
              _PublishedState(
                result: _result!,
                onCreateAnother: _resetComposer,
                onViewFeed: () => context.go('/app/welcome'),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildStepOne(BuildContext context) {
    return SectionCard(
      child: Form(
        key: _stepOneFormKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Request basics',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 10),
            Text(
              'Tell nearby providers what you need and why it matters now.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              key: ValueKey(_category),
              initialValue: _category,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'Category'),
              items: _categories
                  .map(
                    (category) => DropdownMenuItem<String>(
                      value: category,
                      child: Text(category),
                    ),
                  )
                  .toList(),
              onChanged: _submitting
                  ? null
                  : (value) => setState(() {
                      _category = value ?? _categories.first;
                    }),
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _titleController,
              enabled: !_submitting,
              maxLength: 160,
              textInputAction: TextInputAction.next,
              decoration: const InputDecoration(
                labelText: 'Title',
                hintText: 'Need electrician for switch repair',
              ),
              validator: _validateTitle,
            ),
            const SizedBox(height: 8),
            TextFormField(
              controller: _detailsController,
              enabled: !_submitting,
              minLines: 5,
              maxLines: 8,
              maxLength: 1200,
              textInputAction: TextInputAction.newline,
              decoration: const InputDecoration(
                labelText: 'Details',
                hintText:
                    'Share the job size, timing, landmarks, and anything the provider should know.',
              ),
              validator: _validateDetails,
            ),
            const SizedBox(height: 10),
            Text('Timing', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 10),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                ChoiceChip(
                  label: const Text('Urgent'),
                  selected: _mode == CreateNeedMode.urgent,
                  onSelected: _submitting
                      ? null
                      : (_) => setState(() {
                          _mode = CreateNeedMode.urgent;
                          _neededWithin = 'Within 24 hours';
                        }),
                ),
                ChoiceChip(
                  label: const Text('Scheduled'),
                  selected: _mode == CreateNeedMode.schedule,
                  onSelected: _submitting
                      ? null
                      : (_) => setState(() {
                          _mode = CreateNeedMode.schedule;
                          _neededWithin = 'This week';
                        }),
                ),
              ],
            ),
            const SizedBox(height: 18),
            FilledButton.icon(
              onPressed: _submitting ? null : _continueToStepTwo,
              icon: const Icon(Icons.arrow_forward_rounded),
              label: const Text('Continue'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStepTwo(BuildContext context) {
    return SectionCard(
      child: Form(
        key: _stepTwoFormKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Location and budget',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 10),
            Text(
              'Keep the area readable so providers can quickly judge if they can help.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              key: ValueKey(_neededWithin),
              initialValue: _neededWithin,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'Needed within'),
              items: _neededWithinOptions
                  .map(
                    (value) => DropdownMenuItem<String>(
                      value: value,
                      child: Text(value),
                    ),
                  )
                  .toList(),
              onChanged: _submitting
                  ? null
                  : (value) => setState(() {
                      _neededWithin = value ?? _neededWithinOptions[2];
                    }),
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _locationController,
              enabled: !_submitting,
              textInputAction: TextInputAction.next,
              decoration: const InputDecoration(
                labelText: 'Location',
                hintText: 'Koramangala, Bengaluru',
              ),
              validator: _validateLocation,
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _budgetController,
              enabled: !_submitting,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}')),
              ],
              decoration: const InputDecoration(
                labelText: 'Budget',
                hintText: 'Optional amount in INR',
              ),
              validator: _validateBudget,
            ),
            const SizedBox(height: 18),
            Text(
              'Search radius',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            Slider(
              value: _radiusKm,
              min: 2,
              max: 20,
              divisions: 9,
              label: '${_radiusKm.round()} km',
              onChanged: _submitting
                  ? null
                  : (value) => setState(() {
                      _radiusKm = value;
                    }),
            ),
            Text(
              '${_radiusKm.round()} km around ${_locationController.text.trim().isEmpty ? 'your area' : _locationController.text.trim()}',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                OutlinedButton.icon(
                  onPressed: _submitting
                      ? null
                      : () => setState(() {
                          _step = 1;
                          _error = null;
                        }),
                  icon: const Icon(Icons.arrow_back_rounded),
                  label: const Text('Back'),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton.icon(
                    onPressed: _submitting ? null : _publishNeed,
                    icon: _submitting
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.send_rounded),
                    label: Text(_submitting ? 'Posting...' : 'Post request'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _CreateNeedHero extends StatelessWidget {
  const _CreateNeedHero({required this.step});

  final int step;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(32),
        gradient: const LinearGradient(
          colors: [Color(0xFF0B1F33), Color(0xFF0EA5A4)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      padding: const EdgeInsets.all(22),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Post a local need',
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(color: Colors.white),
          ),
          const SizedBox(height: 8),
          Text(
            'Step $step of 2. Start with the request, then add location and budget.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: Colors.white.withValues(alpha: 0.84),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _StepIndicator(active: step == 1, label: 'Need'),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _StepIndicator(active: step == 2, label: 'Discovery'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _StepIndicator extends StatelessWidget {
  const _StepIndicator({required this.active, required this.label});

  final bool active;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: active ? 0.22 : 0.1),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: Colors.white.withValues(alpha: active ? 0.32 : 0.14),
        ),
      ),
      child: Text(
        label,
        textAlign: TextAlign.center,
        style: Theme.of(
          context,
        ).textTheme.labelLarge?.copyWith(color: Colors.white),
      ),
    );
  }
}

class _PublishedState extends StatelessWidget {
  const _PublishedState({
    required this.result,
    required this.onCreateAnother,
    required this.onViewFeed,
  });

  final CreateNeedResult result;
  final VoidCallback onCreateAnother;
  final VoidCallback onViewFeed;

  @override
  Widget build(BuildContext context) {
    final matchedCopy = result.matchedCount == 1
        ? '1 provider matched'
        : '${result.matchedCount} providers matched';

    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: const BoxDecoration(
                  color: Color(0xFFD1FAE5),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.check_rounded,
                  color: Color(0xFF047857),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Request posted',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            '$matchedCopy. ${result.notifiedProviders} notifications queued.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          if (result.helpRequestId.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              'Request ID: ${result.helpRequestId}',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
          const SizedBox(height: 16),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              FilledButton(
                onPressed: onViewFeed,
                child: const Text('View feed'),
              ),
              OutlinedButton(
                onPressed: onCreateAnother,
                child: const Text('Create another'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

bool _looksLikeRawCoordinates(String value) {
  return RegExp(r'^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$').hasMatch(value.trim());
}
