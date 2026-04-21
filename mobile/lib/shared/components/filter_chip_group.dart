import 'package:flutter/material.dart';

class FilterOption<T> {
  const FilterOption({required this.value, required this.label, this.icon});

  final T value;
  final String label;
  final IconData? icon;
}

class FilterChipGroup<T> extends StatelessWidget {
  const FilterChipGroup({
    super.key,
    required this.options,
    required this.selectedValues,
    required this.onChanged,
    this.allowMultiple = true,
  });

  final List<FilterOption<T>> options;
  final Set<T> selectedValues;
  final ValueChanged<Set<T>> onChanged;
  final bool allowMultiple;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: options.map((option) {
        final isSelected = selectedValues.contains(option.value);
        return FilterChip(
          selected: isSelected,
          onSelected: (selected) {
            final next = <T>{...selectedValues};
            if (allowMultiple) {
              if (selected) {
                next.add(option.value);
              } else {
                next.remove(option.value);
              }
            } else {
              next
                ..clear()
                ..add(option.value);
            }
            onChanged(next);
          },
          avatar: option.icon == null ? null : Icon(option.icon, size: 16),
          label: Text(option.label),
        );
      }).toList(),
    );
  }
}
