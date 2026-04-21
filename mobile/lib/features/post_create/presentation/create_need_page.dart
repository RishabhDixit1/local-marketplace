import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/constants/app_routes.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/section_card.dart';
import '../../../shared/components/metric_tile.dart';
import '../../../shared/components/sticky_bottom_cta.dart';
import '../../../shared/components/trust_badge.dart';
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

const _budgetPresets = [
  _BudgetPreset(label: 'Under 500', amount: 500),
  _BudgetPreset(label: '500 - 1500', amount: 1500),
  _BudgetPreset(label: '1500 - 3000', amount: 3000),
  _BudgetPreset(label: 'Flexible'),
];

const _maxComposerMedia = 6;

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
  final ImagePicker _imagePicker = ImagePicker();

  int _step = 1;
  String _category = _categories.first;
  String _neededWithin = _neededWithinOptions[2];
  CreateNeedMode _mode = CreateNeedMode.urgent;
  double _radiusKm = 8;
  List<_ComposerMediaItem> _media = <_ComposerMediaItem>[];
  bool _submitting = false;
  bool _draftRestored = false;
  String? _error;
  CreateNeedResult? _result;
  CreateNeedDraft? _lastPublishedDraft;

  @override
  void initState() {
    super.initState();
    _titleController.addListener(_handleDraftChanged);
    _detailsController.addListener(_handleDraftChanged);
    _budgetController.addListener(_handleDraftChanged);
    _locationController.addListener(_handleDraftChanged);
    _restoreDraftIfAvailable();
  }

  @override
  void dispose() {
    if (_result == null) {
      _cacheDraft();
    } else {
      _CreateNeedDraftCache.clear();
    }
    _titleController.removeListener(_handleDraftChanged);
    _detailsController.removeListener(_handleDraftChanged);
    _budgetController.removeListener(_handleDraftChanged);
    _locationController.removeListener(_handleDraftChanged);
    _titleController.dispose();
    _detailsController.dispose();
    _budgetController.dispose();
    _locationController.dispose();
    super.dispose();
  }

  void _restoreDraftIfAvailable() {
    final cached = _CreateNeedDraftCache.read();
    if (cached == null) {
      return;
    }

    _titleController.text = cached.title;
    _detailsController.text = cached.details;
    _budgetController.text = cached.budgetText;
    _locationController.text = cached.locationLabel;
    _category = cached.category;
    _neededWithin = cached.neededWithin;
    _mode = cached.mode;
    _radiusKm = cached.radiusKm;
    _step = cached.step;
    _media = cached.media
        .map((item) => _ComposerMediaItem.fromSnapshot(item))
        .toList();
    _draftRestored = cached.hasContent;
  }

  void _handleDraftChanged() {
    _cacheDraft();
    if (mounted) {
      setState(() {});
    }
  }

  void _cacheDraft() {
    final snapshot = _CreateNeedDraftSnapshot(
      step: _step.clamp(1, 3),
      title: _titleController.text,
      details: _detailsController.text,
      category: _category,
      budgetText: _budgetController.text,
      locationLabel: _locationController.text,
      radiusKm: _radiusKm,
      mode: _mode,
      neededWithin: _neededWithin,
      media: _media.map((item) => item.toSnapshot()).toList(),
    );

    if (snapshot.hasContent) {
      _CreateNeedDraftCache.write(snapshot);
    } else {
      _CreateNeedDraftCache.clear();
    }
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

  void _selectMode(CreateNeedMode mode) {
    setState(() {
      _mode = mode;
      _error = null;
      if (mode == CreateNeedMode.urgent &&
          !_isUrgencyOptionUrgent(_neededWithin)) {
        _neededWithin = _neededWithinOptions[2];
      }
      if (mode == CreateNeedMode.schedule &&
          _isUrgencyOptionUrgent(_neededWithin)) {
        _neededWithin = _neededWithinOptions[3];
      }
    });
    _cacheDraft();
  }

  void _selectUrgency(String value) {
    setState(() {
      _neededWithin = value;
      _mode = _isUrgencyOptionUrgent(value)
          ? CreateNeedMode.urgent
          : CreateNeedMode.schedule;
      _error = null;
    });
    _cacheDraft();
  }

  void _selectBudgetPreset(_BudgetPreset preset) {
    setState(() {
      _budgetController.text = preset.amount == null
          ? ''
          : preset.amount!.round().toString();
      _error = null;
    });
    _cacheDraft();
  }

  void _continueToStepTwo() {
    setState(() {
      _error = null;
      _draftRestored = false;
    });

    if (!_stepOneFormKey.currentState!.validate()) {
      return;
    }

    setState(() {
      _step = 2;
    });
    _cacheDraft();
  }

  void _continueToPreview() {
    setState(() {
      _error = null;
      _draftRestored = false;
    });

    if (!_stepTwoFormKey.currentState!.validate()) {
      return;
    }

    FocusScope.of(context).unfocus();
    setState(() {
      _step = 3;
    });
    _cacheDraft();
  }

  bool _validateBeforePublishing() {
    final titleError = _validateTitle(_titleController.text);
    final detailsError = _validateDetails(_detailsController.text);
    if (titleError != null || detailsError != null) {
      setState(() {
        _step = 1;
        _error = titleError ?? detailsError;
      });
      return false;
    }

    final locationError = _validateLocation(_locationController.text);
    final budgetError = _validateBudget(_budgetController.text);
    if (locationError != null || budgetError != null) {
      setState(() {
        _step = 2;
        _error = locationError ?? budgetError;
      });
      return false;
    }

    return true;
  }

  CreateNeedDraft _buildDraft() {
    final budgetText = _budgetController.text.trim();
    return CreateNeedDraft(
      title: _titleController.text,
      details: _detailsController.text,
      category: _category,
      budget: budgetText.isEmpty ? null : double.parse(budgetText),
      locationLabel: _locationController.text,
      radiusKm: _radiusKm,
      mode: _mode,
      neededWithin: _neededWithin,
      media: _uploadedMedia,
    );
  }

  Future<void> _openMediaOptions() async {
    if (_submitting) {
      return;
    }

    if (_media.length >= _maxComposerMedia) {
      _showComposerSnack(
        'You can upload up to $_maxComposerMedia attachments.',
      );
      return;
    }

    final action = await showModalBottomSheet<_ComposerMediaAction>(
      context: context,
      showDragHandle: true,
      builder: (context) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Add media',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 8),
                Text(
                  'Photos and short videos help nearby providers trust the request faster.',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 18),
                _MediaActionTile(
                  icon: Icons.photo_library_outlined,
                  title: 'Choose photos',
                  subtitle: 'Pick one or more images from your gallery.',
                  onTap: () => Navigator.of(
                    context,
                  ).pop(_ComposerMediaAction.galleryPhotos),
                ),
                _MediaActionTile(
                  icon: Icons.videocam_outlined,
                  title: 'Choose video',
                  subtitle: 'Add one short video clip.',
                  onTap: () => Navigator.of(
                    context,
                  ).pop(_ComposerMediaAction.galleryVideo),
                ),
                _MediaActionTile(
                  icon: Icons.photo_camera_outlined,
                  title: 'Use camera',
                  subtitle: 'Capture one photo right now.',
                  onTap: () => Navigator.of(
                    context,
                  ).pop(_ComposerMediaAction.cameraPhoto),
                ),
                _MediaActionTile(
                  icon: Icons.video_call_outlined,
                  title: 'Record video',
                  subtitle: 'Capture one video right now.',
                  onTap: () => Navigator.of(
                    context,
                  ).pop(_ComposerMediaAction.cameraVideo),
                ),
              ],
            ),
          ),
        );
      },
    );

    if (action == null) {
      return;
    }

    await _pickMedia(action);
  }

  Future<void> _pickMedia(_ComposerMediaAction action) async {
    try {
      switch (action) {
        case _ComposerMediaAction.galleryPhotos:
          final files = await _imagePicker.pickMultiImage();
          await _addPickedFiles(files);
          return;
        case _ComposerMediaAction.galleryVideo:
          final file = await _imagePicker.pickVideo(
            source: ImageSource.gallery,
          );
          await _addPickedFiles(file == null ? const [] : [file]);
          return;
        case _ComposerMediaAction.cameraPhoto:
          final file = await _imagePicker.pickImage(source: ImageSource.camera);
          await _addPickedFiles(file == null ? const [] : [file]);
          return;
        case _ComposerMediaAction.cameraVideo:
          final file = await _imagePicker.pickVideo(source: ImageSource.camera);
          await _addPickedFiles(file == null ? const [] : [file]);
          return;
      }
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _error = 'Unable to open media picker: $error';
      });
    }
  }

  Future<void> _addPickedFiles(List<XFile> files) async {
    if (files.isEmpty) {
      return;
    }

    final remaining = _maxComposerMedia - _media.length;
    final nextFiles = files.take(remaining).toList();
    if (nextFiles.isEmpty) {
      _showComposerSnack(
        'You can upload up to $_maxComposerMedia attachments.',
      );
      return;
    }

    final items = nextFiles.map(_ComposerMediaItem.fromXFile).toList();
    setState(() {
      _media = [..._media, ...items];
      _error = null;
      _draftRestored = false;
    });
    _cacheDraft();

    for (final item in items) {
      unawaited(_uploadMediaItem(item.id));
    }

    if (files.length > nextFiles.length) {
      _showComposerSnack(
        'Only the first $remaining attachment${remaining == 1 ? '' : 's'} were added.',
      );
    }
  }

  Future<void> _uploadMediaItem(String itemId) async {
    final current = _mediaFor(itemId);
    if (current == null ||
        current.status == _ComposerMediaStatus.uploading ||
        current.status == _ComposerMediaStatus.uploaded) {
      return;
    }

    _updateMediaItem(
      itemId,
      (item) => item.copyWith(
        status: _ComposerMediaStatus.uploading,
        errorMessage: null,
      ),
    );

    try {
      final uploaded = await ref
          .read(createNeedRepositoryProvider)
          .uploadMedia(
            filePath: current.filePath,
            fileName: current.fileName,
            mediaType: current.mediaType,
          );

      if (!mounted || _mediaFor(itemId) == null) {
        return;
      }

      _updateMediaItem(
        itemId,
        (item) => item.copyWith(
          status: _ComposerMediaStatus.uploaded,
          uploadedMedia: uploaded,
          errorMessage: null,
        ),
      );
    } on ApiException catch (error) {
      if (!mounted || _mediaFor(itemId) == null) {
        return;
      }

      _updateMediaItem(
        itemId,
        (item) => item.copyWith(
          status: _ComposerMediaStatus.failed,
          errorMessage: error.message,
        ),
      );
    } catch (error) {
      if (!mounted || _mediaFor(itemId) == null) {
        return;
      }

      _updateMediaItem(
        itemId,
        (item) => item.copyWith(
          status: _ComposerMediaStatus.failed,
          errorMessage: error.toString(),
        ),
      );
    }
  }

  void _retryMediaUpload(String itemId) {
    unawaited(_uploadMediaItem(itemId));
  }

  void _removeMediaItem(String itemId) {
    setState(() {
      _media = _media.where((item) => item.id != itemId).toList();
      _error = null;
    });
    _cacheDraft();
  }

  void _showComposerSnack(String message) {
    if (!mounted) {
      return;
    }

    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  _ComposerMediaItem? _mediaFor(String itemId) {
    for (final item in _media) {
      if (item.id == itemId) {
        return item;
      }
    }
    return null;
  }

  void _updateMediaItem(
    String itemId,
    _ComposerMediaItem Function(_ComposerMediaItem current) transform,
  ) {
    if (!mounted) {
      return;
    }

    setState(() {
      _media = _media.map((item) {
        if (item.id != itemId) {
          return item;
        }
        return transform(item);
      }).toList();
    });
    _cacheDraft();
  }

  Future<void> _publishNeed() async {
    setState(() {
      _error = null;
      _draftRestored = false;
    });

    if (!_validateBeforePublishing()) {
      return;
    }

    if (_hasUploadingMedia) {
      setState(() {
        _error = 'Finish media uploads before posting this request.';
      });
      return;
    }

    if (_hasFailedMedia) {
      setState(() {
        _error =
            'Retry or remove failed media uploads before posting this request.';
      });
      return;
    }

    final draft = _buildDraft();

    FocusScope.of(context).unfocus();
    setState(() {
      _submitting = true;
      _result = null;
      _lastPublishedDraft = null;
    });

    try {
      final result = await ref
          .read(createNeedRepositoryProvider)
          .publishNeed(draft);
      ref.invalidate(feedSnapshotProvider(MobileFeedScope.all));
      ref.invalidate(feedSnapshotProvider(MobileFeedScope.connected));
      _CreateNeedDraftCache.clear();

      if (!mounted) {
        return;
      }

      setState(() {
        _result = result;
        _lastPublishedDraft = draft;
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
    _CreateNeedDraftCache.clear();
    setState(() {
      _step = 1;
      _category = _categories.first;
      _neededWithin = _neededWithinOptions[2];
      _mode = CreateNeedMode.urgent;
      _radiusKm = 8;
      _media = <_ComposerMediaItem>[];
      _error = null;
      _result = null;
      _lastPublishedDraft = null;
      _draftRestored = false;
    });
    _titleController.clear();
    _detailsController.clear();
    _budgetController.clear();
    _locationController.clear();
  }

  String get _budgetSummary {
    final budgetText = _budgetController.text.trim();
    if (budgetText.isEmpty) {
      return 'Flexible budget';
    }

    final amount = double.tryParse(budgetText);
    if (amount == null || amount <= 0) {
      return 'Flexible budget';
    }

    return 'Around INR ${amount.round()}';
  }

  String get _previewAudienceCopy {
    final location = _locationController.text.trim();
    final area = location.isEmpty ? 'your area' : location;
    return 'Nearby ${_category.toLowerCase()} providers within ${_radiusKm.round()} km of $area will see this in discovery, request matching, and provider alerts.';
  }

  List<CreateNeedUploadedMedia> get _uploadedMedia => _media
      .map((item) => item.uploadedMedia)
      .whereType<CreateNeedUploadedMedia>()
      .toList();

  bool get _hasUploadingMedia => _media.any(
    (item) =>
        item.status == _ComposerMediaStatus.queued ||
        item.status == _ComposerMediaStatus.uploading,
  );

  bool get _hasFailedMedia =>
      _media.any((item) => item.status == _ComposerMediaStatus.failed);

  @override
  Widget build(BuildContext context) {
    final publishedDraft = _lastPublishedDraft;

    return Scaffold(
      appBar: AppBar(title: const Text('Create request')),
      bottomNavigationBar: _result == null ? _buildStickyCta() : null,
      body: SafeArea(
        child: ListView(
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          padding: EdgeInsets.fromLTRB(20, 12, 20, _result == null ? 120 : 28),
          children: [
            _CreateNeedHero(step: _step),
            if (_draftRestored) ...[
              const SizedBox(height: 14),
              _DraftRecoveredBanner(
                titleController: _titleController,
                onDiscard: _resetComposer,
              ),
            ],
            const SizedBox(height: 16),
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 220),
              switchInCurve: Curves.easeOutCubic,
              switchOutCurve: Curves.easeInCubic,
              child: _result != null && publishedDraft != null
                  ? _PublishedState(
                      key: const ValueKey('published-state'),
                      result: _result!,
                      draft: publishedDraft,
                      onCreateAnother: _resetComposer,
                      onViewFeed: () => context.go(AppRoutes.home),
                    )
                  : _buildStepContent(context),
            ),
            if (_error != null) ...[
              const SizedBox(height: 14),
              SectionCard(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      Icons.error_outline_rounded,
                      color: Theme.of(context).colorScheme.error,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        _error!,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Theme.of(context).colorScheme.error,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildStickyCta() {
    switch (_step) {
      case 1:
        return StickyBottomCTA(
          title: 'Step 1 of 3',
          subtitle: _media.isEmpty
              ? 'Clear local requests get faster, better replies.'
              : '${_uploadedMedia.length}/${_media.length} attachments ready for nearby discovery.',
          primaryLabel: 'Continue',
          onPrimary: _submitting ? null : _continueToStepTwo,
        );
      case 2:
        return StickyBottomCTA(
          title: 'Step 2 of 3',
          subtitle: 'Set the area, radius, and budget before previewing.',
          primaryLabel: 'Preview request',
          onPrimary: _submitting ? null : _continueToPreview,
          secondaryLabel: 'Back',
          onSecondary: _submitting
              ? null
              : () => setState(() {
                  _step = 1;
                  _error = null;
                }),
        );
      case 3:
        return StickyBottomCTA(
          title: 'Ready to post nearby',
          subtitle: _hasUploadingMedia
              ? 'Finishing media uploads before this request can go live.'
              : _hasFailedMedia
              ? 'Retry or remove failed media before posting.'
              : 'This request will reach providers within ${_radiusKm.round()} km of ${_locationController.text.trim().isEmpty ? 'your area' : _locationController.text.trim()}.',
          primaryLabel: _submitting ? 'Posting...' : 'Post request',
          onPrimary: _submitting ? null : _publishNeed,
          secondaryLabel: 'Edit',
          onSecondary: _submitting
              ? null
              : () => setState(() {
                  _step = 2;
                  _error = null;
                }),
        );
      default:
        return const SizedBox.shrink();
    }
  }

  Widget _buildStepContent(BuildContext context) {
    switch (_step) {
      case 1:
        return _buildStepOne(context);
      case 2:
        return _buildStepTwo(context);
      default:
        return _buildPreview(context);
    }
  }

  Widget _buildStepOne(BuildContext context) {
    return SectionCard(
      key: const ValueKey('create-need-step-1'),
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
              'Tell nearby providers what you need, how urgent it is, and enough context to trust the request quickly.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 18),
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
                      _error = null;
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
                hintText: 'Need electrician for switch repair today',
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
                    'Share the issue, timing, landmarks, access notes, and anything that helps someone quote or respond fast.',
              ),
              validator: _validateDetails,
            ),
            const SizedBox(height: 18),
            _CreateNeedMediaSection(
              items: _media,
              maxItems: _maxComposerMedia,
              onAddMedia: _openMediaOptions,
              onRemove: _removeMediaItem,
              onRetry: _retryMediaUpload,
            ),
            const SizedBox(height: 10),
            Text('Need type', style: Theme.of(context).textTheme.titleMedium),
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
                      : (_) => _selectMode(CreateNeedMode.urgent),
                ),
                ChoiceChip(
                  label: const Text('Scheduled'),
                  selected: _mode == CreateNeedMode.schedule,
                  onSelected: _submitting
                      ? null
                      : (_) => _selectMode(CreateNeedMode.schedule),
                ),
              ],
            ),
            const SizedBox(height: 18),
            Text('Urgency', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 10),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: _neededWithinOptions
                  .map(
                    (value) => ChoiceChip(
                      label: Text(value),
                      selected: _neededWithin == value,
                      onSelected: _submitting
                          ? null
                          : (_) => _selectUrgency(value),
                    ),
                  )
                  .toList(),
            ),
            const SizedBox(height: 18),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.surfaceMuted,
                borderRadius: BorderRadius.circular(AppRadii.md),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.visibility_outlined, size: 18),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Short, concrete titles and precise landmarks make it easier for local providers to trust the job and respond faster.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStepTwo(BuildContext context) {
    return SectionCard(
      key: const ValueKey('create-need-step-2'),
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
              'Keep the area readable and budget realistic so nearby providers can quickly decide if they can help.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 18),
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
            const SizedBox(height: 16),
            Text('Budget', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 10),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: _budgetPresets
                  .map(
                    (preset) => ChoiceChip(
                      label: Text(preset.label),
                      selected: preset.matches(_budgetController.text),
                      onSelected: _submitting
                          ? null
                          : (_) => _selectBudgetPreset(preset),
                    ),
                  )
                  .toList(),
            ),
            const SizedBox(height: 12),
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
                labelText: 'Custom budget',
                hintText: 'Optional amount in INR',
              ),
              validator: _validateBudget,
            ),
            const SizedBox(height: 18),
            Text(
              'Search radius',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 4),
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
                      _error = null;
                    }),
            ),
            Text(
              '${_radiusKm.round()} km around ${_locationController.text.trim().isEmpty ? 'your area' : _locationController.text.trim()}',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 18),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.primarySoft,
                borderRadius: BorderRadius.circular(AppRadii.md),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Who will see this',
                    style: Theme.of(
                      context,
                    ).textTheme.titleSmall?.copyWith(color: AppColors.ink),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      TrustBadge(
                        label: '${_radiusKm.round()} km reach',
                        icon: Icons.route_rounded,
                        backgroundColor: Colors.white,
                        foregroundColor: AppColors.primary,
                      ),
                      TrustBadge(
                        label: _mode == CreateNeedMode.urgent
                            ? 'Urgent request'
                            : 'Scheduled job',
                        icon: Icons.schedule_rounded,
                        backgroundColor: Colors.white,
                        foregroundColor: AppColors.ink,
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text(
                    _previewAudienceCopy,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPreview(BuildContext context) {
    return Column(
      key: const ValueKey('create-need-step-3'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Preview', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 10),
              Text(
                'This is what nearby providers will judge in the first few seconds.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 18),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  TrustBadge(
                    label: _category,
                    icon: Icons.category_outlined,
                    backgroundColor: AppColors.surfaceMuted,
                    foregroundColor: AppColors.ink,
                  ),
                  TrustBadge(
                    label: _neededWithin,
                    icon: Icons.flash_on_rounded,
                    backgroundColor: AppColors.primarySoft,
                    foregroundColor: AppColors.primary,
                  ),
                  TrustBadge(
                    label: _budgetSummary,
                    icon: Icons.payments_outlined,
                    backgroundColor: AppColors.accentSoft,
                    foregroundColor: AppColors.accent,
                  ),
                ],
              ),
              const SizedBox(height: 18),
              Text(
                _titleController.text.trim(),
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 8),
              Text(
                _detailsController.text.trim(),
                style: Theme.of(context).textTheme.bodyLarge,
              ),
              const SizedBox(height: 18),
              _PreviewRow(
                icon: Icons.location_on_outlined,
                label: 'Location',
                value: _locationController.text.trim(),
              ),
              _PreviewRow(
                icon: Icons.route_rounded,
                label: 'Reach',
                value: '${_radiusKm.round()} km',
              ),
              _PreviewRow(
                icon: Icons.access_time_rounded,
                label: 'Need type',
                value: _mode == CreateNeedMode.urgent ? 'Urgent' : 'Scheduled',
              ),
              if (_media.isNotEmpty) ...[
                const SizedBox(height: 6),
                _MediaPreviewSummary(
                  items: _media,
                  uploadedCount: _uploadedMedia.length,
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 14),
        SectionCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Nearby visibility',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 10),
              Text(
                _previewAudienceCopy,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 14),
              LayoutBuilder(
                builder: (context, constraints) {
                  const gap = 10.0;
                  final tileWidth = (constraints.maxWidth - gap) / 2;
                  return Wrap(
                    spacing: gap,
                    runSpacing: gap,
                    children: [
                      SizedBox(
                        width: tileWidth,
                        child: MetricTile(
                          label: 'Budget',
                          value: _budgetSummary,
                          icon: Icons.payments_outlined,
                        ),
                      ),
                      SizedBox(
                        width: tileWidth,
                        child: MetricTile(
                          label: 'Urgency',
                          value: _neededWithin,
                          icon: Icons.flash_on_rounded,
                        ),
                      ),
                      if (_media.isNotEmpty)
                        SizedBox(
                          width: tileWidth,
                          child: MetricTile(
                            label: 'Media',
                            value:
                                '${_uploadedMedia.length}/${_media.length} ready',
                            icon: Icons.perm_media_outlined,
                          ),
                        ),
                    ],
                  );
                },
              ),
            ],
          ),
        ),
      ],
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
        borderRadius: BorderRadius.circular(24),
        gradient: const LinearGradient(
          colors: [Color(0xFF0B1F33), Color(0xFF11466A), Color(0xFF0EA5A4)],
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
            'Step $step of 3. Shape the request, add photos or video, tune nearby discovery, then preview what your local market will see.',
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
              const SizedBox(width: 10),
              Expanded(
                child: _StepIndicator(active: step == 3, label: 'Preview'),
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
    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
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

class _DraftRecoveredBanner extends StatelessWidget {
  const _DraftRecoveredBanner({
    required this.titleController,
    required this.onDiscard,
  });

  final TextEditingController titleController;
  final VoidCallback onDiscard;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: AppColors.primarySoft,
              borderRadius: BorderRadius.circular(AppRadii.md),
            ),
            child: const Icon(Icons.save_outlined, color: AppColors.primary),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Draft restored',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 6),
                Text(
                  titleController.text.trim().isEmpty
                      ? 'We brought back your unfinished request so you can keep going.'
                      : '"${titleController.text.trim()}" is ready to finish.',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 10),
                TextButton(
                  onPressed: onDiscard,
                  child: const Text('Discard draft'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PreviewRow extends StatelessWidget {
  const _PreviewRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: AppColors.inkMuted),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: Theme.of(context).textTheme.bodySmall),
                const SizedBox(height: 4),
                Text(
                  value,
                  style: Theme.of(
                    context,
                  ).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w700),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PublishedState extends StatelessWidget {
  const _PublishedState({
    super.key,
    required this.result,
    required this.draft,
    required this.onCreateAnother,
    required this.onViewFeed,
  });

  final CreateNeedResult result;
  final CreateNeedDraft draft;
  final VoidCallback onCreateAnother;
  final VoidCallback onViewFeed;

  @override
  Widget build(BuildContext context) {
    final matchedCopy = result.matchedCount == 1
        ? '1 nearby provider matched'
        : '${result.matchedCount} nearby providers matched';
    final latencySeconds = (result.firstNotificationLatencyMs / 1000).ceil();

    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: AppColors.primarySoft,
                  borderRadius: BorderRadius.circular(AppRadii.md),
                ),
                child: const Icon(
                  Icons.check_circle_rounded,
                  color: AppColors.primary,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Request posted nearby',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '$matchedCopy. ${result.notifiedProviders} notifications have already started going out.',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              TrustBadge(
                label: '${draft.radiusKm.round()} km reach',
                icon: Icons.route_rounded,
                backgroundColor: AppColors.primarySoft,
                foregroundColor: AppColors.primary,
              ),
              TrustBadge(
                label: draft.locationLabel,
                icon: Icons.location_on_outlined,
                backgroundColor: AppColors.surfaceMuted,
                foregroundColor: AppColors.ink,
              ),
              TrustBadge(
                label: draft.neededWithin,
                icon: Icons.flash_on_rounded,
                backgroundColor: AppColors.accentSoft,
                foregroundColor: AppColors.accent,
              ),
              if (draft.media.isNotEmpty)
                TrustBadge(
                  label: '${draft.media.length} media',
                  icon: Icons.perm_media_outlined,
                  backgroundColor: AppColors.surfaceMuted,
                  foregroundColor: AppColors.ink,
                ),
            ],
          ),
          const SizedBox(height: 18),
          Text(
            'Who will see this now',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          Text(
            'Providers in ${draft.category.toLowerCase()} around ${draft.locationLabel} can now see this in the local feed, request alerts, and matching queue.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          if (draft.media.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              'Attached photos and videos are already part of the live request, which helps providers judge scope much faster on mobile.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
          const SizedBox(height: 18),
          LayoutBuilder(
            builder: (context, constraints) {
              const gap = 10.0;
              final tileWidth = (constraints.maxWidth - (gap * 2)) / 3;
              return Wrap(
                spacing: gap,
                runSpacing: gap,
                children: [
                  SizedBox(
                    width: tileWidth,
                    child: MetricTile(
                      label: 'Matched',
                      value: result.matchedCount.toString(),
                      icon: Icons.people_outline_rounded,
                    ),
                  ),
                  SizedBox(
                    width: tileWidth,
                    child: MetricTile(
                      label: 'Queued',
                      value: result.notifiedProviders.toString(),
                      icon: Icons.notifications_active_outlined,
                    ),
                  ),
                  SizedBox(
                    width: tileWidth,
                    child: MetricTile(
                      label: 'Speed',
                      value: '${latencySeconds}s',
                      icon: Icons.bolt_rounded,
                    ),
                  ),
                ],
              );
            },
          ),
          if (result.helpRequestId.isNotEmpty) ...[
            const SizedBox(height: 14),
            Text(
              'Request ID: ${result.helpRequestId}',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
          const SizedBox(height: 18),
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

const Object _composerMediaSentinel = Object();

enum _ComposerMediaAction {
  galleryPhotos,
  galleryVideo,
  cameraPhoto,
  cameraVideo,
}

enum _ComposerMediaStatus { queued, uploading, uploaded, failed }

class _ComposerMediaItem {
  const _ComposerMediaItem({
    required this.id,
    required this.filePath,
    required this.fileName,
    required this.mediaType,
    required this.status,
    this.errorMessage,
    this.uploadedMedia,
  });

  factory _ComposerMediaItem.fromXFile(XFile file) {
    final fileName = file.name.trim().isEmpty
        ? file.path.split(Platform.pathSeparator).last
        : file.name.trim();

    return _ComposerMediaItem(
      id: 'media-${DateTime.now().microsecondsSinceEpoch}-${file.path.hashCode}',
      filePath: file.path,
      fileName: fileName,
      mediaType: _guessMediaType(fileName, fallbackPath: file.path),
      status: _ComposerMediaStatus.queued,
    );
  }

  factory _ComposerMediaItem.fromSnapshot(_CreateNeedDraftMediaSnapshot value) {
    return _ComposerMediaItem(
      id: value.id,
      filePath: value.filePath,
      fileName: value.fileName,
      mediaType: value.mediaType,
      status: value.status,
      errorMessage: value.errorMessage,
      uploadedMedia: value.uploadedMedia,
    );
  }

  final String id;
  final String filePath;
  final String fileName;
  final String mediaType;
  final _ComposerMediaStatus status;
  final String? errorMessage;
  final CreateNeedUploadedMedia? uploadedMedia;

  bool get isImage => mediaType.startsWith('image/');
  bool get isVideo => mediaType.startsWith('video/');

  String get statusLabel {
    switch (status) {
      case _ComposerMediaStatus.queued:
        return 'Queued';
      case _ComposerMediaStatus.uploading:
        return 'Uploading';
      case _ComposerMediaStatus.uploaded:
        return 'Ready';
      case _ComposerMediaStatus.failed:
        return 'Retry needed';
    }
  }

  _ComposerMediaItem copyWith({
    _ComposerMediaStatus? status,
    Object? errorMessage = _composerMediaSentinel,
    Object? uploadedMedia = _composerMediaSentinel,
  }) {
    return _ComposerMediaItem(
      id: id,
      filePath: filePath,
      fileName: fileName,
      mediaType: mediaType,
      status: status ?? this.status,
      errorMessage: errorMessage == _composerMediaSentinel
          ? this.errorMessage
          : errorMessage as String?,
      uploadedMedia: uploadedMedia == _composerMediaSentinel
          ? this.uploadedMedia
          : uploadedMedia as CreateNeedUploadedMedia?,
    );
  }

  _CreateNeedDraftMediaSnapshot toSnapshot() {
    return _CreateNeedDraftMediaSnapshot(
      id: id,
      filePath: filePath,
      fileName: fileName,
      mediaType: mediaType,
      status: status,
      errorMessage: errorMessage,
      uploadedMedia: uploadedMedia,
    );
  }
}

class _CreateNeedMediaSection extends StatelessWidget {
  const _CreateNeedMediaSection({
    required this.items,
    required this.maxItems,
    required this.onAddMedia,
    required this.onRemove,
    required this.onRetry,
  });

  final List<_ComposerMediaItem> items;
  final int maxItems;
  final VoidCallback onAddMedia;
  final ValueChanged<String> onRemove;
  final ValueChanged<String> onRetry;

  @override
  Widget build(BuildContext context) {
    final readyCount = items
        .where((item) => item.status == _ComposerMediaStatus.uploaded)
        .length;
    final uploadingCount = items
        .where((item) => item.status == _ComposerMediaStatus.uploading)
        .length;
    final failedCount = items
        .where((item) => item.status == _ComposerMediaStatus.failed)
        .length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Photos and video',
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: 6),
        Text(
          'Add up to $maxItems attachments so providers can judge scope faster on mobile.',
          style: Theme.of(context).textTheme.bodyMedium,
        ),
        const SizedBox(height: 12),
        Align(
          alignment: Alignment.centerLeft,
          child: OutlinedButton.icon(
            onPressed: onAddMedia,
            icon: const Icon(Icons.add_photo_alternate_outlined),
            label: Text(
              items.isEmpty
                  ? 'Add media'
                  : '${items.length}/$maxItems attached',
            ),
          ),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            TrustBadge(
              label: '$readyCount ready',
              icon: Icons.cloud_done_outlined,
              backgroundColor: AppColors.primarySoft,
              foregroundColor: AppColors.primary,
            ),
            if (uploadingCount > 0)
              TrustBadge(
                label: '$uploadingCount uploading',
                icon: Icons.cloud_upload_outlined,
                backgroundColor: AppColors.accentSoft,
                foregroundColor: AppColors.accent,
              ),
            if (failedCount > 0)
              TrustBadge(
                label: '$failedCount retry needed',
                icon: Icons.error_outline_rounded,
                backgroundColor: AppColors.dangerSoft,
                foregroundColor: AppColors.danger,
              ),
          ],
        ),
        const SizedBox(height: 12),
        if (items.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.surfaceRaised,
              borderRadius: BorderRadius.circular(AppRadii.md),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'No attachments yet',
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                const SizedBox(height: 6),
                Text(
                  'Before-and-after photos, broken parts, access points, or a short walk-through video can improve response quality a lot.',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
            ),
          )
        else
          SizedBox(
            height: 172,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: items.length,
              separatorBuilder: (_, _) => const SizedBox(width: 12),
              itemBuilder: (context, index) {
                final item = items[index];
                return _ComposerMediaCard(
                  item: item,
                  onRemove: () => onRemove(item.id),
                  onRetry: item.status == _ComposerMediaStatus.failed
                      ? () => onRetry(item.id)
                      : null,
                );
              },
            ),
          ),
      ],
    );
  }
}

class _ComposerMediaCard extends StatelessWidget {
  const _ComposerMediaCard({
    required this.item,
    required this.onRemove,
    required this.onRetry,
  });

  final _ComposerMediaItem item;
  final VoidCallback onRemove;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final foreground = switch (item.status) {
      _ComposerMediaStatus.uploaded => AppColors.primary,
      _ComposerMediaStatus.failed => AppColors.danger,
      _ => AppColors.accent,
    };
    final background = switch (item.status) {
      _ComposerMediaStatus.uploaded => AppColors.primarySoft,
      _ComposerMediaStatus.failed => AppColors.dangerSoft,
      _ => AppColors.accentSoft,
    };

    return SizedBox(
      width: 144,
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: AppColors.border),
          boxShadow: AppShadows.card,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(18),
              ),
              child: SizedBox(
                height: 96,
                width: double.infinity,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    _ComposerMediaThumbnail(item: item),
                    Positioned(
                      top: 8,
                      right: 8,
                      child: Material(
                        color: Colors.black.withValues(alpha: 0.45),
                        shape: const CircleBorder(),
                        child: InkWell(
                          onTap: onRemove,
                          customBorder: const CircleBorder(),
                          child: const Padding(
                            padding: EdgeInsets.all(6),
                            child: Icon(
                              Icons.close_rounded,
                              color: Colors.white,
                              size: 16,
                            ),
                          ),
                        ),
                      ),
                    ),
                    if (item.status == _ComposerMediaStatus.uploading ||
                        item.status == _ComposerMediaStatus.queued)
                      Positioned(
                        left: 0,
                        right: 0,
                        bottom: 0,
                        child: const LinearProgressIndicator(minHeight: 4),
                      ),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 5,
                    ),
                    decoration: BoxDecoration(
                      color: background,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      item.statusLabel,
                      style: Theme.of(
                        context,
                      ).textTheme.labelMedium?.copyWith(color: foreground),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    item.fileName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(
                      context,
                    ).textTheme.bodySmall?.copyWith(color: AppColors.ink),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    item.isVideo ? 'Video clip' : 'Image',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  if (item.status == _ComposerMediaStatus.failed &&
                      item.errorMessage != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      item.errorMessage!,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(
                        context,
                      ).textTheme.bodySmall?.copyWith(color: AppColors.danger),
                    ),
                    const SizedBox(height: 8),
                    TextButton(
                      onPressed: onRetry,
                      style: TextButton.styleFrom(
                        padding: EdgeInsets.zero,
                        minimumSize: const Size(0, 0),
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                      child: const Text('Retry upload'),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ComposerMediaThumbnail extends StatelessWidget {
  const _ComposerMediaThumbnail({required this.item});

  final _ComposerMediaItem item;

  @override
  Widget build(BuildContext context) {
    if (item.isImage) {
      return Image.file(
        File(item.filePath),
        fit: BoxFit.cover,
        errorBuilder: (_, _, _) {
          return _FallbackMediaSurface(
            icon: Icons.image_outlined,
            label: 'Preview unavailable',
          );
        },
      );
    }

    return _FallbackMediaSurface(
      icon: item.isVideo ? Icons.movie_creation_outlined : Icons.attach_file,
      label: item.isVideo ? 'Video ready to upload' : 'Media attachment',
    );
  }
}

class _FallbackMediaSurface extends StatelessWidget {
  const _FallbackMediaSurface({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.surfaceMuted,
      padding: const EdgeInsets.all(12),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, color: AppColors.inkMuted),
          const SizedBox(height: 8),
          Text(
            label,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}

class _MediaPreviewSummary extends StatelessWidget {
  const _MediaPreviewSummary({
    required this.items,
    required this.uploadedCount,
  });

  final List<_ComposerMediaItem> items;
  final int uploadedCount;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              'Media preview',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(width: 8),
            Text(
              '$uploadedCount/${items.length} ready',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
        const SizedBox(height: 10),
        SizedBox(
          height: 96,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: items.length,
            separatorBuilder: (_, _) => const SizedBox(width: 10),
            itemBuilder: (context, index) {
              final item = items[index];
              return ClipRRect(
                borderRadius: BorderRadius.circular(14),
                child: SizedBox(
                  width: 96,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      _ComposerMediaThumbnail(item: item),
                      Positioned(
                        left: 8,
                        right: 8,
                        bottom: 8,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.52),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            item.statusLabel,
                            textAlign: TextAlign.center,
                            style: Theme.of(context).textTheme.labelMedium
                                ?.copyWith(color: Colors.white),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _MediaActionTile extends StatelessWidget {
  const _MediaActionTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: AppColors.surfaceRaised,
        borderRadius: BorderRadius.circular(18),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(18),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: AppColors.primarySoft,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(icon, color: AppColors.primary),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        subtitle,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right_rounded),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _BudgetPreset {
  const _BudgetPreset({required this.label, this.amount});

  final String label;
  final double? amount;

  bool matches(String rawValue) {
    final normalized = rawValue.trim();
    if (amount == null) {
      return normalized.isEmpty;
    }
    return normalized == amount!.round().toString();
  }
}

class _CreateNeedDraftSnapshot {
  const _CreateNeedDraftSnapshot({
    required this.step,
    required this.title,
    required this.details,
    required this.category,
    required this.budgetText,
    required this.locationLabel,
    required this.radiusKm,
    required this.mode,
    required this.neededWithin,
    required this.media,
  });

  final int step;
  final String title;
  final String details;
  final String category;
  final String budgetText;
  final String locationLabel;
  final double radiusKm;
  final CreateNeedMode mode;
  final String neededWithin;
  final List<_CreateNeedDraftMediaSnapshot> media;

  bool get hasContent {
    return title.trim().isNotEmpty ||
        details.trim().isNotEmpty ||
        budgetText.trim().isNotEmpty ||
        locationLabel.trim().isNotEmpty ||
        media.isNotEmpty ||
        category != _categories.first ||
        neededWithin != _neededWithinOptions[2] ||
        mode != CreateNeedMode.urgent ||
        radiusKm != 8 ||
        step > 1;
  }
}

class _CreateNeedDraftMediaSnapshot {
  const _CreateNeedDraftMediaSnapshot({
    required this.id,
    required this.filePath,
    required this.fileName,
    required this.mediaType,
    required this.status,
    this.errorMessage,
    this.uploadedMedia,
  });

  final String id;
  final String filePath;
  final String fileName;
  final String mediaType;
  final _ComposerMediaStatus status;
  final String? errorMessage;
  final CreateNeedUploadedMedia? uploadedMedia;
}

class _CreateNeedDraftCache {
  static _CreateNeedDraftSnapshot? _value;

  static _CreateNeedDraftSnapshot? read() => _value;

  static void write(_CreateNeedDraftSnapshot value) {
    _value = value;
  }

  static void clear() {
    _value = null;
  }
}

bool _isUrgencyOptionUrgent(String value) {
  return value == _neededWithinOptions[0] ||
      value == _neededWithinOptions[1] ||
      value == _neededWithinOptions[2];
}

bool _looksLikeRawCoordinates(String value) {
  return RegExp(r'^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$').hasMatch(value.trim());
}

String _guessMediaType(String fileName, {String? fallbackPath}) {
  final value = (fileName.trim().isNotEmpty ? fileName : (fallbackPath ?? ''))
      .toLowerCase();

  if (value.endsWith('.png')) return 'image/png';
  if (value.endsWith('.webp')) return 'image/webp';
  if (value.endsWith('.gif')) return 'image/gif';
  if (value.endsWith('.heic') || value.endsWith('.heif')) return 'image/heic';
  if (value.endsWith('.jpg') || value.endsWith('.jpeg')) return 'image/jpeg';
  if (value.endsWith('.mp4')) return 'video/mp4';
  if (value.endsWith('.mov')) return 'video/quicktime';
  if (value.endsWith('.m4v')) return 'video/x-m4v';
  if (value.endsWith('.webm')) return 'video/webm';

  return 'application/octet-stream';
}
