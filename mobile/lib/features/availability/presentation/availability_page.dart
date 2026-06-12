import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/design_system/serviq_async_state.dart';
import '../../../core/theme/design_tokens.dart';
import '../../../core/widgets/section_card.dart';
import '../data/availability_repository.dart';
import '../domain/availability_models.dart';

const _commonTimezones = [
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Hong_Kong',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Moscow',
  'US/Eastern',
  'US/Central',
  'US/Mountain',
  'US/Pacific',
];

class AvailabilityPage extends ConsumerStatefulWidget {
  const AvailabilityPage({super.key});

  @override
  ConsumerState<AvailabilityPage> createState() => _AvailabilityPageState();
}

class _AvailabilityPageState extends ConsumerState<AvailabilityPage> {
  List<_DaySlots> _slots = [];
  bool _saving = false;
  bool _loaded = false;
  String? _message;
  String _timezone = 'Asia/Kolkata';
  List<AvailabilityException> _exceptions = [];

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_loaded) {
      _loaded = true;
      _initFromProvider();
    }
  }

  Future<void> _initFromProvider() async {
    final slots = await ref.read(availabilitySlotsProvider.future);
    final exceptions = await ref.read(availabilityExceptionsProvider.future);
    if (!mounted) return;
    _exceptions = exceptions;
    if (slots.isNotEmpty) _timezone = slots.first.timezone;
    _groupByDay(slots);
  }

  void _groupByDay(List<AvailabilitySlot> slots) {
    final map = <int, List<AvailabilitySlot>>{};
    for (final s in slots) {
      map.putIfAbsent(s.dayOfWeek, () => []).add(s);
    }
    setState(() {
      _slots = List.generate(7, (i) {
        final daySlots = map[i] ?? [];
        return _DaySlots(
          dayOfWeek: i,
          slots: daySlots.isEmpty
              ? [AvailabilitySlot(dayOfWeek: i, startTime: '09:00', endTime: '17:00')]
              : daySlots,
          enabled: daySlots.isEmpty ? false : true,
        );
      });
    });
  }

  Future<void> _save() async {
    setState(() { _saving = true; _message = null; });
    try {
      final allSlots = <AvailabilitySlot>[];
      for (final ds in _slots) {
        if (!ds.enabled) continue;
        for (final slot in ds.slots) {
          allSlots.add(slot.copyWith(isActive: true, timezone: _timezone));
        }
      }
      await ref.read(availabilityRepositoryProvider).update(allSlots, timezone: _timezone);
      ref.invalidate(availabilitySlotsProvider);
      if (mounted) setState(() => _message = 'Availability saved.');
    } on ApiException catch (e) {
      if (mounted) setState(() => _message = e.message);
    } catch (e) {
      if (mounted) setState(() => _message = 'Failed to save.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _addSlot(int dayIndex) {
    setState(() {
      _slots[dayIndex].slots.add(AvailabilitySlot(dayOfWeek: dayIndex, startTime: '09:00', endTime: '17:00'));
    });
  }

  void _removeSlot(int dayIndex, int slotIndex) {
    if (_slots[dayIndex].slots.length <= 1) {
      setState(() {
        _slots[dayIndex].enabled = false;
        _slots[dayIndex].slots = [AvailabilitySlot(dayOfWeek: dayIndex, startTime: '09:00', endTime: '17:00')];
      });
      return;
    }
    setState(() => _slots[dayIndex].slots.removeAt(slotIndex));
  }

  Future<void> _pickTime(int dayIndex, int slotIndex, bool isStart) async {
    final current = _slots[dayIndex].slots[slotIndex];
    final initial = isStart ? current.startTime : current.endTime;
    final parts = initial.split(':');
    final initialTime = TimeOfDay(hour: int.tryParse(parts[0]) ?? 9, minute: int.tryParse(parts[1]) ?? 0);

    final picked = await showTimePicker(context: context, initialTime: initialTime);
    if (picked == null || !mounted) return;

    final formatted = '${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}';
    setState(() {
      if (isStart) {
        _slots[dayIndex].slots[slotIndex] = current.copyWith(startTime: formatted);
      } else {
        _slots[dayIndex].slots[slotIndex] = current.copyWith(endTime: formatted);
      }
    });
  }

  Future<void> _addException() async {
    final datePicked = await showDatePicker(
      context: context,
      initialDate: DateTime.now().add(const Duration(days: 1)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (datePicked == null || !mounted) return;

    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) {
        final controller = TextEditingController();
        return AlertDialog(
          title: const Text('Reason (optional)'),
          content: TextField(
            controller: controller,
            decoration: const InputDecoration(hintText: 'e.g. Holiday, Personal day'),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            TextButton(onPressed: () => Navigator.pop(ctx, controller.text.trim()), child: const Text('Add')),
          ],
        );
      },
    );
    if (reason == null || !mounted) return;

    try {
      final dateStr = '${datePicked.year.toString().padLeft(4, '0')}-${datePicked.month.toString().padLeft(2, '0')}-${datePicked.day.toString().padLeft(2, '0')}';
      final updated = await ref.read(availabilityRepositoryProvider).addException(
        AvailabilityException(exceptionDate: dateStr, isAvailable: false, reason: reason.isEmpty ? null : reason),
      );
      if (mounted) setState(() => _exceptions = updated);
      ref.invalidate(availabilityExceptionsProvider);
    } catch (e) {
      if (mounted) setState(() => _message = 'Failed to add day off.');
    }
  }

  Future<void> _removeException(String date) async {
    try {
      await ref.read(availabilityRepositoryProvider).removeException(date);
      if (mounted) {
        setState(() => _exceptions.removeWhere((e) => e.exceptionDate == date));
      }
      ref.invalidate(availabilityExceptionsProvider);
    } catch (e) {
      if (mounted) setState(() => _message = 'Failed to remove day off.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final asyncSlots = ref.watch(availabilitySlotsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Availability')),
      body: SafeArea(
        child: asyncSlots.isLoading && _slots.isEmpty
            ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
            : asyncSlots.hasError && _slots.isEmpty
            ? ServiqAsyncBody<List<AvailabilitySlot>>(
          value: asyncSlots,
          errorTitle: 'Unable to load availability',
          onRetry: () => ref.invalidate(availabilitySlotsProvider),
          data: (_) => const SizedBox.shrink(),
        )
            : ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
          children: [
            Text('Set your weekly service hours.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.inkSubtle)),
            const SizedBox(height: 16),
            ...List.generate(7, (i) => _buildDayRow(i)),
            const SizedBox(height: 16),
            _buildTimezoneSelector(),
            const SizedBox(height: 12),
            _buildExceptionsSection(),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _saving ? null : _save,
                icon: _saving
                    ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.save_outlined, size: 16),
                label: Text(_saving ? 'Saving...' : 'Save Availability'),
              ),
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
      ),
    );
  }

  Widget _buildTimezoneSelector() {
    return SectionCard(
      child: Row(
        children: [
          const Icon(Icons.access_time, size: 16, color: AppColors.inkSubtle),
          const SizedBox(width: 8),
          Text('Timezone', style: Theme.of(context).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(width: 8),
          Expanded(
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _timezone,
                isExpanded: true,
                items: _commonTimezones.map((tz) => DropdownMenuItem(
                  value: tz,
                  child: Text(tz.replaceAll('_', ' '), style: const TextStyle(fontSize: 12)),
                )).toList(),
                onChanged: (v) {
                  if (v != null) setState(() => _timezone = v);
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildExceptionsSection() {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.block, size: 16, color: AppColors.danger),
              const SizedBox(width: 6),
              Text('Days off / exceptions',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.bold)),
              const Spacer(),
              InkWell(
                onTap: _addException,
                borderRadius: BorderRadius.circular(6),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.dangerSoft,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.add, size: 12, color: AppColors.danger),
                      SizedBox(width: 3),
                      Text('Block', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.danger)),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text('Mark specific dates when you are unavailable.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.inkFaint, fontSize: 11)),
          if (_exceptions.isNotEmpty) ...[
            const SizedBox(height: 8),
            ..._exceptions.map((ex) => Container(
              margin: const EdgeInsets.only(bottom: 4),
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
              decoration: BoxDecoration(
                color: AppColors.dangerSoft,
                borderRadius: BorderRadius.circular(6),
              ),
              child: Row(
                children: [
                  const Icon(Icons.block, size: 12, color: AppColors.danger),
                  const SizedBox(width: 6),
                  Text(ex.exceptionDate,
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.danger)),
                  if (ex.reason != null && ex.reason!.isNotEmpty) ...[
                    const SizedBox(width: 4),
                    Text('— ${ex.reason}',
                        style: const TextStyle(fontSize: 11, color: AppColors.danger)),
                  ],
                  const Spacer(),
                  InkWell(
                    onTap: () => _removeException(ex.exceptionDate),
                    child: const Icon(Icons.close, size: 14, color: AppColors.danger),
                  ),
                ],
              ),
            )),
          ],
        ],
      ),
    );
  }

  Widget _buildDayRow(int dayIndex) {
    final daySlots = _slots[dayIndex];
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      child: SectionCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Switch(
                  value: daySlots.enabled,
                  onChanged: (v) {
                    setState(() => _slots[dayIndex].enabled = v);
                  },
                ),
                Text(AvailabilitySlot.dayLabels[dayIndex],
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold)),
                const Spacer(),
                if (daySlots.enabled)
                  IconButton(
                    icon: const Icon(Icons.add_circle_outline, size: 18),
                    onPressed: _saving ? null : () => _addSlot(dayIndex),
                    visualDensity: VisualDensity.compact,
                    tooltip: 'Add time slot',
                  ),
              ],
            ),
            if (daySlots.enabled)
              ...List.generate(daySlots.slots.length, (si) => _buildSlotRow(dayIndex, si)),
          ],
        ),
      ),
    );
  }

  Widget _buildSlotRow(int dayIndex, int slotIndex) {
    final slot = _slots[dayIndex].slots[slotIndex];
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          Expanded(
            child: InkWell(
              onTap: _saving ? null : () => _pickTime(dayIndex, slotIndex, true),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: AppColors.surfaceAlt,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.border),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.schedule, size: 14, color: AppColors.primary),
                    const SizedBox(width: 6),
                    Text(slot.startTime, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                  ],
                ),
              ),
            ),
          ),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 6),
            child: Text('to', style: TextStyle(color: AppColors.inkSubtle, fontSize: 12)),
          ),
          Expanded(
            child: InkWell(
              onTap: _saving ? null : () => _pickTime(dayIndex, slotIndex, false),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: AppColors.surfaceAlt,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.border),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.schedule, size: 14, color: AppColors.primary),
                    const SizedBox(width: 6),
                    Text(slot.endTime, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(width: 4),
          IconButton(
            icon: const Icon(Icons.remove_circle_outline, size: 18, color: AppColors.danger),
            onPressed: _saving ? null : () => _removeSlot(dayIndex, slotIndex),
            visualDensity: VisualDensity.compact,
            tooltip: 'Remove slot',
          ),
        ],
      ),
    );
  }
}

class _DaySlots {
  _DaySlots({
    required this.dayOfWeek,
    required this.slots,
    this.enabled = true,
  });

  final int dayOfWeek;
  List<AvailabilitySlot> slots;
  bool enabled;
}
