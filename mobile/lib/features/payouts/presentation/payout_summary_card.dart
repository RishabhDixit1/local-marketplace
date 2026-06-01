import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/design_tokens.dart';

class PayoutSummaryCard extends StatelessWidget {
  const PayoutSummaryCard({
    super.key,
    required this.label,
    required this.paise,
    this.accentColor = AppColors.primary,
    this.icon,
  });

  final String label;
  final int paise;
  final Color accentColor;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (icon != null) ...[
                Icon(icon, size: 16, color: accentColor),
                const SizedBox(width: 6),
              ],
              Text(
                label,
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.inkSubtle,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            _formatINR(paise),
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: accentColor,
            ),
          ),
        ],
      ),
    );
  }

  String _formatINR(int paise) {
    return NumberFormat.currency(
      locale: 'en_IN',
      symbol: '₹',
      decimalDigits: 0,
    ).format(paise / 100);
  }
}
