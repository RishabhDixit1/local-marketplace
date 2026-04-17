import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/mobile_api_client.dart';
import '../data/task_post_repository.dart';

class TaskPostPage extends ConsumerStatefulWidget {
  const TaskPostPage({super.key});

  @override
  ConsumerState<TaskPostPage> createState() => _TaskPostPageState();
}

class _TaskPostPageState extends ConsumerState<TaskPostPage> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _detailsController = TextEditingController();
  final _categoryController = TextEditingController(text: 'Home Services');
  final _locationController = TextEditingController();
  final _budgetController = TextEditingController();

  bool _urgent = true;
  bool _submitting = false;

  @override
  void dispose() {
    _titleController.dispose();
    _detailsController.dispose();
    _categoryController.dispose();
    _locationController.dispose();
    _budgetController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate() || _submitting) {
      return;
    }

    FocusScope.of(context).unfocus();
    setState(() {
      _submitting = true;
    });

    try {
      final budget = double.tryParse(_budgetController.text.trim());
      final result = await ref
          .read(taskPostRepositoryProvider)
          .publishNeed(
            title: _titleController.text,
            details: _detailsController.text,
            category: _categoryController.text,
            locationLabel: _locationController.text,
            budget: budget,
            urgent: _urgent,
          );

      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Task posted. ${result.matchedCount} provider'
            '${result.matchedCount == 1 ? '' : 's'} matched right away.',
          ),
        ),
      );
      Navigator.of(context).pop(true);
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
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
    return Scaffold(
      appBar: AppBar(title: const Text('Post Task')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Publish a new service request',
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                const SizedBox(height: 10),
                Text(
                  'This uses the same backend workflow as the web app so matching, notifications, and task tracking stay aligned.',
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
                const SizedBox(height: 20),
                TextFormField(
                  controller: _titleController,
                  decoration: const InputDecoration(labelText: 'Task title'),
                  validator: (value) => (value ?? '').trim().isEmpty
                      ? 'Enter a short task title.'
                      : null,
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: _detailsController,
                  minLines: 4,
                  maxLines: 6,
                  decoration: const InputDecoration(
                    labelText: 'Details',
                    alignLabelWithHint: true,
                  ),
                  validator: (value) => (value ?? '').trim().length < 12
                      ? 'Add a bit more detail so providers can respond.'
                      : null,
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: _categoryController,
                  decoration: const InputDecoration(labelText: 'Category'),
                  validator: (value) =>
                      (value ?? '').trim().isEmpty ? 'Enter a category.' : null,
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: _locationController,
                  decoration: const InputDecoration(labelText: 'Location'),
                  validator: (value) => (value ?? '').trim().isEmpty
                      ? 'Add a location label.'
                      : null,
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: _budgetController,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  decoration: const InputDecoration(
                    labelText: 'Budget (optional)',
                    prefixText: 'INR ',
                  ),
                ),
                const SizedBox(height: 18),
                SwitchListTile.adaptive(
                  contentPadding: EdgeInsets.zero,
                  value: _urgent,
                  onChanged: (value) => setState(() => _urgent = value),
                  title: const Text('Urgent request'),
                  subtitle: Text(
                    _urgent
                        ? 'Priority matching will run immediately.'
                        : 'Providers can respond on a scheduled timeline.',
                  ),
                ),
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: _submitting ? null : _submit,
                    child: _submitting
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Publish task'),
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
