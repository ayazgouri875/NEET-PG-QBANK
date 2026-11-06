import 'package:flutter/material.dart';
import '../core/constants/app_colors.dart';
import '../models/question.dart';
import '../models/test_session.dart';
import 'clinical_image_viewer.dart';

class ExplanationCard extends StatelessWidget {
  final SubmitAnswerResult feedback;
  final Question question;
  final VoidCallback onNext;

  const ExplanationCard({
    super.key,
    required this.feedback,
    required this.question,
    required this.onNext,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isCorrect = feedback.isCorrect;
    final optionLabels = ["A", "B", "C", "D", "E", "F", "G", "H"];
    final correctLetter = feedback.correctOptionIndex < optionLabels.length
        ? optionLabels[feedback.correctOptionIndex]
        : "${feedback.correctOptionIndex + 1}";

    // Explanation clinical images
    final expImages = question.images.where((i) => i.imageType == 'explanation').toList();

    return Container(
      margin: const EdgeInsets.only(top: 16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isCorrect ? AppColors.correct : AppColors.incorrect,
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: (isCorrect ? AppColors.correct : AppColors.incorrect).withOpacity(0.08),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Banner Header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: isCorrect
                  ? (isDark ? const Color(0xFF064E3B) : AppColors.correctLight)
                  : (isDark ? const Color(0xFF7F1D1D) : AppColors.incorrectLight),
              borderRadius: const BorderRadius.vertical(top: Radius.circular(15)),
            ),
            child: Row(
              children: [
                Icon(
                  isCorrect ? Icons.check_circle : Icons.cancel,
                  color: isCorrect ? AppColors.correct : AppColors.incorrect,
                  size: 24,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    isCorrect
                        ? "Correct Answer! (+4 Marks)"
                        : "Incorrect (-1 Mark) • Correct is Option $correctLetter",
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: isCorrect ? AppColors.correct : AppColors.incorrect,
                    ),
                  ),
                ),
              ],
            ),
          ),

          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(Icons.menu_book, color: AppColors.primaryLight, size: 20),
                    SizedBox(width: 8),
                    Text(
                      "High-Yield Explanation",
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // Explanation text
                Text(
                  feedback.explanation ?? question.explanation?.text ?? "No explanation available for this question.",
                  style: TextStyle(
                    fontSize: 14.5,
                    height: 1.5,
                    color: isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight,
                  ),
                ),

                // Explanation Images (if any)
                if (expImages.isNotEmpty) ...[
                  const SizedBox(height: 14),
                  const Text(
                    "High-Yield Diagrams & Illustrations:",
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.grey),
                  ),
                  const SizedBox(height: 8),
                  for (final img in expImages)
                    ClinicalImageViewer(filename: img.filename, caption: img.caption),
                ],

                // Textbook References
                if (feedback.references != null && feedback.references!.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(Icons.bookmark_added_outlined, color: AppColors.secondary, size: 18),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                "Standard Textbook References:",
                                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.secondary),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                feedback.references!,
                                style: TextStyle(fontSize: 12, color: isDark ? Colors.grey.shade300 : Colors.grey.shade700),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],

                const SizedBox(height: 18),
                // Next Question Button
                ElevatedButton.icon(
                  onPressed: onNext,
                  icon: const Icon(Icons.arrow_forward),
                  label: const Text("Next Question"),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

