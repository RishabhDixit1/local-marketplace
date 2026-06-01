import 'package:flutter/material.dart';

import '../../../core/theme/design_tokens.dart';

class PayoutStatusChip extends StatelessWidget {
  const PayoutStatusChip({super.key, required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final colors = _statusColors(status);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: colors.$1,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        _statusLabel(status),
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: colors.$2,
        ),
      ),
    );
  }

  String _statusLabel(String s) {
    switch (s) {
      case 'pending':
        return 'Pending';
      case 'approved':
        return 'Approved';
      case 'processing':
        return 'Processing';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return s;
    }
  }

  (Color, Color) _statusColors(String s) {
    switch (s) {
      case 'pending':
        return (AppColors.warningSoft, AppColors.warning);
      case 'approved':
        return (AppColors.verifiedSoft, AppColors.verified);
      case 'processing':
        return (AppColors.accentSoft, AppColors.accent);
      case 'completed':
        return (AppColors.successSoft, AppColors.success);
      case 'failed':
        return (AppColors.dangerSoft, AppColors.danger);
      case 'cancelled':
        return (AppColors.surfaceAlt, AppColors.inkSubtle);
      default:
        return (AppColors.surfaceAlt, AppColors.inkSubtle);
    }
  }
}
