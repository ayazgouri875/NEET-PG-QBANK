import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../providers/analytics_provider.dart';

class AnalyticsScreen extends StatefulWidget {
  const AnalyticsScreen({super.key});

  @override
  State<AnalyticsScreen> createState() => _AnalyticsScreenState();
}

class _AnalyticsScreenState extends State<AnalyticsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<AnalyticsProvider>(context, listen: false).fetchDashboard();
    });
  }

  @override
  Widget build(BuildContext context) {
    final analyticsProv = Provider.of<AnalyticsProvider>(context);
    final dashboard = analyticsProv.dashboard;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          "Performance Analytics",
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      body: analyticsProv.isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: () => analyticsProv.fetchDashboard(),
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Overview Metric Grid
                    Row(
                      children: [
                        Expanded(
                          child: _buildMetricCard(
                            title: "Overall Accuracy",
                            value: "${dashboard?.overallAccuracy.toStringAsFixed(1) ?? 0}%",
                            color: AppColors.primary,
                            icon: Icons.pie_chart,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: _buildMetricCard(
                            title: "Questions Solved",
                            value: "${dashboard?.totalAttempted ?? 0}",
                            color: AppColors.secondary,
                            icon: Icons.checklist,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: _buildMetricCard(
                            title: "Correct Answers",
                            value: "${dashboard?.totalCorrect ?? 0}",
                            color: AppColors.correct,
                            icon: Icons.check_circle_outline,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: _buildMetricCard(
                            title: "Avg Time / Q",
                            value: "${dashboard?.avgSecondsPerQuestion.toStringAsFixed(0) ?? 0}s",
                            color: AppColors.accent,
                            icon: Icons.speed,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),

                    // Weak Subjects Banner
                    if (dashboard != null && dashboard.weakSubjects.isNotEmpty) ...[
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: AppColors.incorrectLight,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: AppColors.incorrect.withOpacity(0.3)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Row(
                              children: [
                                Icon(Icons.warning_amber_rounded, color: AppColors.incorrect, size: 20),
                                SizedBox(width: 8),
                                Text(
                                  "Weak Subjects Detected (< 60% Accuracy)",
                                  style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.incorrect, fontSize: 14),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Wrap(
                              spacing: 8,
                              children: dashboard.weakSubjects.map((s) {
                                return Chip(
                                  backgroundColor: Colors.white,
                                  label: Text(s, style: const TextStyle(color: AppColors.incorrect, fontSize: 12)),
                                );
                              }).toList(),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),
                    ],

                    // Revision Recommendations
                    if (analyticsProv.recommendations.isNotEmpty) ...[
                      const Text(
                        "High-Yield Revision Recommendations",
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 10),
                      for (final rec in analyticsProv.recommendations)
                        Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.replay_circle_filled, color: AppColors.primary, size: 24),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      rec.topicName,
                                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                                    ),
                                    Text(
                                      "${rec.subjectName} • ${rec.incorrectAttempts} incorrect questions",
                                      style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      const SizedBox(height: 24),
                    ],

                    // Subject Breakdown
                    const Text(
                      "Subject-Wise Accuracy",
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 12),

                    if (dashboard != null && dashboard.subjectBreakdown.isNotEmpty)
                      ListView.separated(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: dashboard.subjectBreakdown.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (ctx, idx) {
                          final stat = dashboard.subjectBreakdown[idx];
                          return Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                      stat.subject,
                                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                                    ),
                                    Text(
                                      "${stat.accuracy.toStringAsFixed(1)}%",
                                      style: TextStyle(
                                        fontWeight: FontWeight.bold,
                                        color: stat.accuracy >= 60.0 ? AppColors.correct : AppColors.incorrect,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                LinearProgressIndicator(
                                  value: stat.accuracy / 100.0,
                                  backgroundColor: Colors.grey.shade200,
                                  valueColor: AlwaysStoppedAnimation<Color>(
                                    stat.accuracy >= 60.0 ? AppColors.correct : AppColors.incorrect,
                                  ),
                                  minHeight: 6,
                                  borderRadius: BorderRadius.circular(3),
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  "${stat.correct} Correct • ${stat.incorrect} Incorrect • ${stat.attempted} Attempted",
                                  style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                                ),
                              ],
                            ),
                          );
                        },
                      )
                    else
                      Container(
                        padding: const EdgeInsets.all(24),
                        alignment: Alignment.center,
                        child: Text(
                          "Complete a practice test to unlock subject analytics and weakness diagnostics.",
                          textAlign: TextAlign.center,
                          style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                        ),
                      ),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildMetricCard({
    required String title,
    required String value,
    required Color color,
    required IconData icon,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 22),
          const SizedBox(height: 10),
          Text(
            value,
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 2),
          Text(
            title,
            style: TextStyle(fontSize: 12, color: Colors.grey.shade600, fontWeight: FontWeight.w500),
          ),
        ],
      ),
    );
  }
}

