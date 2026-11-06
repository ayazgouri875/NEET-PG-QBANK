import 'package:flutter/material.dart';
import '../core/constants/app_colors.dart';

enum OptionStatus {
  normal,
  selected,
  correct,
  incorrect,
}

class OptionTile extends StatelessWidget {
  final String label; // 'A', 'B', 'C', 'D'
  final String text;
  final OptionStatus status;
  final VoidCallback onTap;

  const OptionTile({
    super.key,
    required this.label,
    required this.text,
    required this.status,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    Color backgroundColor;
    Color borderColor;
    Color labelBgColor;
    Color labelTextColor;
    Widget? trailingIcon;

    switch (status) {
      case OptionStatus.correct:
        backgroundColor = isDark ? const Color(0xFF064E3B) : AppColors.correctLight;
        borderColor = AppColors.correct;
        labelBgColor = AppColors.correct;
        labelTextColor = Colors.white;
        trailingIcon = const Icon(Icons.check_circle, color: AppColors.correct, size: 22);
        break;
      case OptionStatus.incorrect:
        backgroundColor = isDark ? const Color(0xFF7F1D1D) : AppColors.incorrectLight;
        borderColor = AppColors.incorrect;
        labelBgColor = AppColors.incorrect;
        labelTextColor = Colors.white;
        trailingIcon = const Icon(Icons.cancel, color: AppColors.incorrect, size: 22);
        break;
      case OptionStatus.selected:
        backgroundColor = isDark ? const Color(0xFF1E3A8A).withOpacity(0.3) : const Color(0xFFEFF6FF);
        borderColor = AppColors.primaryLight;
        labelBgColor = AppColors.primary;
        labelTextColor = Colors.white;
        trailingIcon = null;
        break;
      case OptionStatus.normal:
      default:
        backgroundColor = isDark ? AppColors.surfaceDark : AppColors.surfaceLight;
        borderColor = isDark ? AppColors.borderDark : AppColors.borderLight;
        labelBgColor = isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9);
        labelTextColor = isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight;
        trailingIcon = null;
        break;
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6.0),
      child: Material(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: borderColor, width: status != OptionStatus.normal ? 1.8 : 1.0),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Option Label Badge (A, B, C, D)
                Container(
                  width: 32,
                  height: 32,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: labelBgColor,
                    shape: BoxShape.circle,
                  ),
                  child: Text(
                    label,
                    style: TextStyle(
                      color: labelTextColor,
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                // Option Text Content
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(top: 4.0),
                    child: Text(
                      text,
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: status == OptionStatus.selected || status == OptionStatus.correct
                            ? FontWeight.w600
                            : FontWeight.w400,
                        color: isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight,
                        height: 1.35,
                      ),
                    ),
                  ),
                ),
                if (trailingIcon != null) ...[
                  const SizedBox(width: 8),
                  trailingIcon,
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

