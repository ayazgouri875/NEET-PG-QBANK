import 'package:flutter/material.dart';
import '../../core/constants/app_colors.dart';
import '../../models/test_session.dart';

class TestResultScreen extends StatelessWidget {
  final TestSession session;

  const TestResultScreen({super.key, required this.session});

  String _formatTime(int seconds) {
    final m = seconds ~/ 60;
    final s = seconds % 60;
    return "${m}m ${s}s";
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final totalQ = session.totalQuestions;
    final accuracy = session.accuracyPercentage;
    final score = session.score;

    return Scaffold(
      appBar: AppBar(
        title: const Text("Test Performance Summary"),
        automaticallyImplyLeading: false,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Score Card
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: score >= 0
                      ? [const Color(0xFF1E3A8A), const Color(0xFF0D9488)]
                      : [const Color(0xFF7F1D1D), const Color(0xFF991B1B)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.12),
                    blurRadius: 16,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: Column(
                children: [
                  const Text(
                    "TOTAL MARKS",
                    style: TextStyle(color: Colors.white70, fontSize: 13, letterSpacing: 1.5, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    score.toStringAsFixed(0),
                    style: const TextStyle(color: Colors.white, fontSize: 48, fontWeight: FontWeight.bold),
                  ),
                  Text(
                    "Out of ${totalQ * 4} (+4 Correct, -1 Incorrect)",
                    style: const TextStyle(color: Colors.white70, fontSize: 13),
                  ),
                  const SizedBox(height: 20),
                  const Divider(color: Colors.white24),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _buildScoreStat("ACCURACY", "${accuracy.toStringAsFixed(1)}%"),
                      _buildScoreStat("TIME", _formatTime(session.totalQuestions * 30)), // Approx or stored
                      _buildScoreStat("ATTEMPTED", "${session.correctCount + session.incorrectCount}/$totalQ"),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Question Breakdown
            const Text(
              "Question Breakdown",
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),

            Row(
              children: [
                Expanded(
                  child: _buildBreakdownCard(
                    title: "Correct",
                    count: session.correctCount,
                    color: AppColors.correct,
                    icon: Icons.check_circle,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _buildBreakdownCard(
                    title: "Incorrect",
                    count: session.incorrectCount,
                    color: AppColors.incorrect,
                    icon: Icons.cancel,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _buildBreakdownCard(
                    title: "Skipped",
                    count: session.skippedCount,
                    color: Colors.grey,
                    icon: Icons.remove_circle_outline,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 32),

            // Action Buttons
            ElevatedButton(
              onPressed: () {
                Navigator.of(context).popUntil((route) => route.isFirst);
              },
              child: const Text("Return to Question Bank"),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildScoreStat(String label, String value) {
    return Column(
      children: [
        Text(value, style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 2),
        Text(label, style: const TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.w600)),
      ],
    );
  }

  Widget _buildBreakdownCard({
    required String title,
    required int count,
    required Color color,
    required IconData icon,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 26),
          const SizedBox(height: 8),
          Text(
            "$count",
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: color),
          ),
          const SizedBox(height: 2),
          Text(title, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: color)),
        ],
      ),
    );
  }
}

