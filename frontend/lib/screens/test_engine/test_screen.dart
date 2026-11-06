import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../models/question.dart';
import '../../providers/test_provider.dart';
import '../../widgets/clinical_image_viewer.dart';
import '../../widgets/explanation_sheet.dart';
import '../../widgets/option_tile.dart';
import '../../widgets/question_palette_dialog.dart';
import 'test_result_screen.dart';

class TestScreen extends StatelessWidget {
  const TestScreen({super.key});

  String _formatTimer(int totalSeconds) {
    final minutes = (totalSeconds ~/ 60).toString().padLeft(2, '0');
    final seconds = (totalSeconds % 60).toString().padLeft(2, '0');
    return "$minutes:$seconds";
  }

  void _confirmExit(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("Pause / Exit Test?"),
        content: const Text("Your selected answers are saved. You can complete the test now or continue solving."),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text("Resume"),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.incorrect),
            onPressed: () {
              Navigator.of(ctx).pop();
              Navigator.of(context).pop();
            },
            child: const Text("Exit Test"),
          ),
        ],
      ),
    );
  }

  void _showCompleteDialog(BuildContext context, TestProvider testProv) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("Submit Test?"),
        content: Text(
          "You have answered ${testProv.answeredCount} of ${testProv.questions.length} questions.\n"
          "Unattempted: ${testProv.unattemptedCount}\n"
          "Marked for Review: ${testProv.reviewCount}",
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text("Back to Questions"),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.of(ctx).pop();
              final completed = await testProv.completeTest();
              if (completed != null && context.mounted) {
                Navigator.of(context).pushReplacement(
                  MaterialPageRoute(builder: (_) => TestResultScreen(session: completed)),
                );
              }
            },
            child: const Text("Submit & View Results"),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final testProv = Provider.of<TestProvider>(context);
    final question = testProv.currentQuestion;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (question == null) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    final qId = question.id;
    final selectedOption = testProv.getSelectedOption(qId);
    final feedback = testProv.getAnswerFeedback(qId);
    final isReview = testProv.isMarkedForReview(qId);
    final isBookmarked = testProv.isBookmarked(qId);
    final isPractice = testProv.isPracticeMode;

    // Filter question images
    final qImages = question.images.where((i) => i.imageType == 'question').toList();

    return WillPopScope(
      onWillPop: () async {
        _confirmExit(context);
        return false;
      },
      child: Scaffold(
        appBar: AppBar(
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () => _confirmExit(context),
          ),
          title: Text(
            "Q ${testProv.currentIndex + 1} of ${testProv.questions.length}",
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
          ),
          actions: [
            // Timer Badge
            Container(
              margin: const EdgeInsets.symmetric(vertical: 10),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF1E293B) : Colors.grey.shade100,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
              ),
              child: Row(
                children: [
                  const Icon(Icons.timer_outlined, size: 14, color: AppColors.primary),
                  const SizedBox(width: 4),
                  Text(
                    _formatTimer(testProv.elapsedSeconds),
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.primary),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 6),

            // Bookmark Button
            IconButton(
              icon: Icon(
                isBookmarked ? Icons.bookmark : Icons.bookmark_border,
                color: isBookmarked ? AppColors.primary : null,
              ),
              tooltip: "Bookmark Question",
              onPressed: () => testProv.toggleBookmark(),
            ),

            // Review Flag Button
            IconButton(
              icon: Icon(
                isReview ? Icons.flag : Icons.flag_outlined,
                color: isReview ? AppColors.review : null,
              ),
              tooltip: "Mark for Review",
              onPressed: () => testProv.toggleReview(),
            ),

            // Question Palette Grid Button
            IconButton(
              icon: const Icon(Icons.grid_view),
              tooltip: "Question Palette",
              onPressed: () {
                showModalBottomSheet(
                  context: context,
                  isScrollControlled: true,
                  backgroundColor: Colors.transparent,
                  builder: (_) => const QuestionPaletteDialog(),
                );
              },
            ),
          ],
        ),

        body: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Metadata Badges (Clinical / PYQ / MCQ ID)
              Wrap(
                spacing: 8,
                children: [
                  if (question.mcqId != null)
                    _buildBadge(question.mcqId!, Colors.grey.shade700, Colors.grey.shade100),
                  if (question.isClinical)
                    _buildBadge("🩺 Clinical Vignette", AppColors.primary, const Color(0xFFEFF6FF)),
                  if (question.pyqYear != null)
                    _buildBadge("PYQ ${question.pyqYear}", AppColors.secondary, const Color(0xFFF0FDFA)),
                  if (question.hasImages)
                    _buildBadge("🖼️ Image-Based", AppColors.accent, const Color(0xFFEEF2FF)),
                ],
              ),
              const SizedBox(height: 12),

              // Question Text
              Text(
                question.text,
                style: const TextStyle(
                  fontSize: 16.5,
                  fontWeight: FontWeight.w600,
                  height: 1.45,
                  letterSpacing: -0.2,
                ),
              ),

              // Question Clinical Images (if any)
              if (qImages.isNotEmpty) ...[
                const SizedBox(height: 12),
                for (final img in qImages)
                  ClinicalImageViewer(filename: img.filename, caption: img.caption),
              ],
              const SizedBox(height: 20),

              // Options List
              for (final opt in question.options)
                _buildOptionTile(opt, selectedOption, feedback, isPractice, testProv),

              // High-Yield Explanation Card (in Practice Mode after selection)
              if (isPractice && feedback != null)
                ExplanationCard(
                  feedback: feedback,
                  question: question,
                  onNext: () {
                    if (testProv.currentIndex < testProv.questions.length - 1) {
                      testProv.nextQuestion();
                    } else {
                      _showCompleteDialog(context, testProv);
                    }
                  },
                ),

              const SizedBox(height: 80), // Padding for sticky bottom bar
            ],
          ),
        ),

        // Bottom Sticky Navigation Bar
        bottomNavigationBar: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          decoration: BoxDecoration(
            color: isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
            border: Border(top: BorderSide(color: isDark ? AppColors.borderDark : AppColors.borderLight)),
          ),
          child: SafeArea(
            child: Row(
              children: [
                // Previous Question
                Expanded(
                  flex: 1,
                  child: OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      minimumSize: Size.zero,
                    ),
                    onPressed: testProv.currentIndex > 0 ? () => testProv.previousQuestion() : null,
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.arrow_back_ios, size: 14),
                        Text("Prev", style: TextStyle(fontSize: 13)),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 8),

                // Palette Quick Action
                IconButton.outlined(
                  style: OutlinedButton.styleFrom(
                    side: BorderSide(color: isDark ? AppColors.borderDark : AppColors.borderLight),
                  ),
                  icon: const Icon(Icons.grid_view, size: 20),
                  onPressed: () {
                    showModalBottomSheet(
                      context: context,
                      isScrollControlled: true,
                      backgroundColor: Colors.transparent,
                      builder: (_) => const QuestionPaletteDialog(),
                    );
                  },
                ),
                const SizedBox(width: 8),

                // Next or Submit Button
                Expanded(
                  flex: 2,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: testProv.currentIndex == testProv.questions.length - 1
                          ? AppColors.correct
                          : AppColors.primary,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      minimumSize: Size.zero,
                    ),
                    onPressed: () {
                      if (testProv.currentIndex < testProv.questions.length - 1) {
                        testProv.nextQuestion();
                      } else {
                        _showCompleteDialog(context, testProv);
                      }
                    },
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          testProv.currentIndex == testProv.questions.length - 1 ? "Submit Test" : "Next",
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(width: 4),
                        Icon(
                          testProv.currentIndex == testProv.questions.length - 1
                              ? Icons.done_all
                              : Icons.arrow_forward_ios,
                          size: 14,
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildOptionTile(
    QuestionOption opt,
    int? selectedOption,
    SubmitAnswerResult? feedback,
    bool isPractice,
    TestProvider testProv,
  ) {
    OptionStatus status = OptionStatus.normal;

    if (isPractice && feedback != null) {
      if (opt.optionIndex == feedback.correctOptionIndex) {
        status = OptionStatus.correct;
      } else if (selectedOption == opt.optionIndex) {
        status = OptionStatus.incorrect;
      }
    } else {
      if (selectedOption == opt.optionIndex) {
        status = OptionStatus.selected;
      }
    }

    return OptionTile(
      label: opt.optionLabel,
      text: opt.text,
      status: status,
      onTap: () => testProv.selectOption(opt.optionIndex),
    );
  }

  Widget _buildBadge(String label, Color textColor, Color bgColor) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: TextStyle(color: textColor, fontSize: 11, fontWeight: FontWeight.w600),
      ),
    );
  }
}

