import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/design_system/serviq_async_state.dart';
import '../../../core/theme/design_tokens.dart';
import '../../../core/widgets/section_card.dart';
import '../../../shared/components/empty_state_view.dart';
import '../data/verification_repository.dart';
import '../domain/verification_models.dart';

class VerificationPage extends ConsumerStatefulWidget {
  const VerificationPage({super.key});

  @override
  ConsumerState<VerificationPage> createState() => _VerificationPageState();
}

class _VerificationPageState extends ConsumerState<VerificationPage> {
  final ImagePicker _picker = ImagePicker();
  final List<_UploadField> _uploadFields = [_UploadField()];
  bool _uploading = false;
  bool _submitting = false;
  String? _message;

  Future<void> _refresh() async {
    ref.invalidate(verificationBundleProvider);
    await ref.read(verificationBundleProvider.future);
  }

  void _addField() {
    setState(() => _uploadFields.add(_UploadField()));
  }

  void _removeField(int index) {
    if (_uploadFields.length <= 1) return;
    setState(() => _uploadFields.removeAt(index));
  }

  Future<void> _pickFile(int index) async {
    final xFile = await _picker.pickImage(source: ImageSource.gallery);
    if (xFile == null || !mounted) return;
    setState(() {
      _uploadFields[index].xFile = xFile;
      _uploadFields[index].documentType ??= 'id_proof';
    });
  }

  Future<void> _upload(int index) async {
    final field = _uploadFields[index];
    if (field.xFile == null || field.documentType == null) return;

    setState(() {
      _uploading = true;
      _message = null;
    });

    try {
      await ref.read(verificationRepositoryProvider).uploadDocument(
            filePath: field.xFile!.path,
            fileName: field.xFile!.name,
            mediaType: field.xFile!.mimeType ?? 'image/jpeg',
            documentType: field.documentType!,
          );
      await _refresh();
      if (mounted) {
        setState(() {
          _uploadFields[index] = _UploadField();
          _message = 'Document uploaded successfully.';
        });
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _message = e.message);
    } catch (e) {
      if (mounted) setState(() => _message = 'Failed to upload document.');
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _submit() async {
    setState(() {
      _submitting = true;
      _message = null;
    });

    try {
      final msg = await ref.read(verificationRepositoryProvider).submitForReview();
      await _refresh();
      if (mounted) setState(() => _message = msg);
    } on ApiException catch (e) {
      if (mounted) setState(() => _message = e.message);
    } catch (e) {
      if (mounted) setState(() => _message = 'Failed to submit.');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  static const List<Map<String, String>> _documentTypes = [
    {'value': 'id_proof', 'label': 'ID Proof (Aadhaar, PAN, DL)'},
    {'value': 'address_proof', 'label': 'Address Proof'},
    {'value': 'business_license', 'label': 'Business License / GST'},
    {'value': 'professional_certificate', 'label': 'Professional Certificate'},
    {'value': 'insurance', 'label': 'Insurance Certificate'},
    {'value': 'guarantee', 'label': 'Service Guarantee Document'},
  ];

  @override
  Widget build(BuildContext context) {
    final bundleAsync = ref.watch(verificationBundleProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Verification')),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
            children: [
              Text('Get verified to build trust with customers.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.inkSubtle)),
              const SizedBox(height: 16),
              ServiqAsyncBody<VerificationBundle>(
                value: bundleAsync,
                errorTitle: 'Unable to load verification data',
                onRetry: _refresh,
                data: (bundle) => _buildContent(bundle),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildContent(VerificationBundle bundle) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildStatusBanner(bundle.status),
        const SizedBox(height: 16),
        _buildUploadSection(bundle),
        const SizedBox(height: 16),
        _buildDocumentHistory(bundle.documents),
      ],
    );
  }

  Widget _buildStatusBanner(VerificationStatus status) {
    IconData icon;
    Color bg;
    Color fg;
    String label;

    switch (status.status) {
      case 'verified':
        icon = Icons.verified_rounded;
        bg = AppColors.successSoft;
        fg = AppColors.success;
        label = 'Verified';
      case 'pending':
        icon = Icons.hourglass_top_rounded;
        bg = AppColors.warningSoft;
        fg = AppColors.warning;
        label = 'Under Review';
      case 'rejected':
        icon = Icons.gpp_bad_rounded;
        bg = AppColors.dangerSoft;
        fg = AppColors.danger;
        label = 'Rejected';
      default:
        icon = Icons.gpp_maybe_outlined;
        bg = AppColors.surfaceAlt;
        fg = AppColors.inkSubtle;
        label = 'Not Submitted';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Icon(icon, color: fg, size: 28),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Status: $label',
                    style: TextStyle(fontWeight: FontWeight.bold, color: fg, fontSize: 15)),
                const SizedBox(height: 2),
                Text('Level: ${status.level[0].toUpperCase()}${status.level.substring(1)}',
                    style: TextStyle(fontSize: 12, color: fg.withValues(alpha: 0.8))),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildUploadSection(VerificationBundle bundle) {
    final hasPending = bundle.pendingCount > 0;

    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Upload Documents', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          const Text('Upload identity, address, or business documents (max 10MB each).',
              style: TextStyle(fontSize: 12, color: AppColors.inkSubtle)),
          const SizedBox(height: 14),
          ...List.generate(_uploadFields.length, (i) => _buildUploadRow(i, hasPending)),
          const SizedBox(height: 8),
          if (_uploadFields.length < 3)
            TextButton.icon(
              onPressed: _uploading ? null : _addField,
              icon: const Icon(Icons.add, size: 16),
              label: const Text('Add another document'),
            ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: (!hasPending || _submitting) ? null : _submit,
              icon: _submitting
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.send_rounded, size: 16),
              label: Text(_submitting ? 'Submitting...' : 'Submit for Review'),
            ),
          ),
          if (!hasPending && bundle.documents.isNotEmpty)
            const Padding(
              padding: EdgeInsets.only(top: 8),
              child: Text('All documents have been reviewed. Upload new ones and submit again.',
                  style: TextStyle(fontSize: 11, color: AppColors.inkSubtle)),
            ),
          if (_message != null) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.surfaceAlt,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(_message!, style: const TextStyle(fontSize: 12, color: AppColors.inkSubtle)),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildUploadRow(int index, bool hasPending) {
    final field = _uploadFields[index];
    final hasFile = field.xFile != null;
    final busy = _uploading;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surfaceAlt,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                  child: DropdownButtonFormField<String>(
                  initialValue: field.documentType,
                  decoration: const InputDecoration(
                    labelText: 'Document type',
                    contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    isDense: true,
                    border: OutlineInputBorder(),
                  ),
                  items: _documentTypes.map((t) {
                    return DropdownMenuItem(value: t['value'], child: Text(t['label']!, style: const TextStyle(fontSize: 13)));
                  }).toList(),
                  onChanged: busy
                      ? null
                      : (v) {
                          if (v == null) return;
                          setState(() => _uploadFields[index].documentType = v);
                        },
                ),
              ),
              if (_uploadFields.length > 1)
                IconButton(
                  icon: const Icon(Icons.close, size: 18),
                  onPressed: busy ? null : () => _removeField(index),
                  visualDensity: VisualDensity.compact,
                ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: busy ? null : () => _pickFile(index),
                  icon: const Icon(Icons.image_outlined, size: 16),
                  label: Text(
                    hasFile ? field.xFile!.name : 'Choose file',
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 12),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              FilledButton(
                onPressed: (!hasFile || busy) ? null : () => _upload(index),
                child: busy
                    ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Upload', style: TextStyle(fontSize: 12)),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildDocumentHistory(List<VerificationDocument> documents) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Document History', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 10),
          if (documents.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: EmptyStateView(
                title: 'No documents uploaded yet',
                message: 'Upload identity, address, or business documents above.',
              ),
            )
          else
            ...documents.map((d) => _documentRow(d)),
        ],
      ),
    );
  }

  Widget _documentRow(VerificationDocument doc) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.surfaceAlt,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(doc.documentTypeLabel,
                        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                    const SizedBox(height: 2),
                    Text('${doc.submittedAt.day}/${doc.submittedAt.month}/${doc.submittedAt.year}',
                        style: const TextStyle(fontSize: 11, color: AppColors.inkSubtle)),
                  ],
                ),
              ),
              _statusChip(doc.status),
            ],
          ),
          if (doc.reviewerNotes != null && doc.reviewerNotes!.isNotEmpty) ...[
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppColors.dangerSoft,
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                doc.reviewerNotes!,
                style: const TextStyle(fontSize: 11, color: AppColors.danger, fontWeight: FontWeight.w500),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _statusChip(String status) {
    Color bg;
    Color fg;
    switch (status) {
      case 'approved':
        bg = AppColors.successSoft; fg = AppColors.success;
      case 'rejected':
        bg = AppColors.dangerSoft; fg = AppColors.danger;
      default:
        bg = AppColors.warningSoft; fg = AppColors.warning;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
      child: Text(status[0].toUpperCase() + status.substring(1),
          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: fg)),
    );
  }
}

class _UploadField {
  XFile? xFile;
  String? documentType;
}
