import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/constants/app_colors.dart';
import '../providers/test_provider.dart';

class QuestionPaletteDialog extends StatelessWidget {
  const QuestionPaletteDialog({super.key});

  @override
  Widget build(BuildContext context) {
    final testProv = Provider.of<TestProvider>(context);
    final questions = testProv.questions;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      decoration: BoxDecoration(
        color: Theme.of(context).scaffoldBackgroundColor,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.grey.shade300,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 16),
          // Title
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                "Question Palette",
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              IconButton(
                icon: const Icon(Icons.close),
                onPressed: () => Navigator.of(context).pop(),
              ),
            ],
          ),
          const SizedBox(height: 12),
          // Summary Legend Bar
          Wrap(
            spacing: 12,
            runSpacing: 8,
            children: [
              _buildLegend(AppColors.correct, "Answered (${testProv.answeredCount})"),
              _buildLegend(AppColors.review, "Review (${testProv.reviewCount})"),
              _buildLegend(AppColors.unattempted, "Unattempted (${testProv.unattemptedCount})"),
            ],
          ),
          const Divider(height: 24),
          // Question Grid
          Flexible(
            child: SingleChildScrollView(
              child: GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 5,
                  crossAxisSpacing: 10,
                  mainAxisSpacing: 10,
                  childAspectRatio: 1.1,
                ),
                itemCount: questions.length,
                itemBuilder: (ctx, index) {
                  final q = questions[index];
                  final isCurrent = index == testProv.currentIndex;
                  final isAnswered = testProv.getSelectedOption(q.id) != null;
                  final isReview = testProv.isMarkedForReview(q.id);

                  Color boxColor = Colors.grey.shade100;
                  Color textColor = Colors.black87;
                  Border border = Border.all(color: Colors.grey.shade300);

                  if (isAnswered && isReview) {
                    boxColor = const Color(0xFF7C3AED); // Purple (answered & review)
                    textColor = Colors.white;
                  } else if (isAnswered) {
                    boxColor = AppColors.correct;
                    textColor = Colors.white;
                  } else if (isReview) {
                    boxColor = AppColors.review;
                    textColor = Colors.white;
                  }

                  if (isCurrent) {
                    border = Border.all(color: AppColors.primaryLight, width: 2.5);
                  }

                  return InkWell(
                    onTap: () {
                      testProv.goToQuestion(index);
                      Navigator.of(context).pop();
                    },
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: boxColor,
                        borderRadius: BorderRadius.circular(10),
                        border: border,
                      ),
                      child: Text(
                        "${index + 1}",
                        style: TextStyle(
                          color: textColor,
                          fontWeight: isCurrent ? FontWeight.bold : FontWeight.w600,
                          fontSize: 15,
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }

  Widget _buildLegend(Color color, String label) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 12,
          height: 12,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 6),
        Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500)),
      ],
    );
  }
}

