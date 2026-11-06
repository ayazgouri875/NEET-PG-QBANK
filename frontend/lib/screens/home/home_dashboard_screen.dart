import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../providers/analytics_provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/subject_provider.dart';
import '../../providers/test_provider.dart';
import '../subjects/topic_list_screen.dart';
import '../test_engine/test_screen.dart';

class HomeDashboardScreen extends StatefulWidget {
  const HomeDashboardScreen({super.key});

  @override
  State<HomeDashboardScreen> createState() => _HomeDashboardScreenState();
}

class _HomeDashboardScreenState extends State<HomeDashboardScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<SubjectProvider>(context, listen: false).fetchSubjects();
      Provider.of<AnalyticsProvider>(context, listen: false).fetchDashboard();
    });
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final subjectProv = Provider.of<SubjectProvider>(context);
    final analyticsProv = Provider.of<AnalyticsProvider>(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final userName = auth.user?['full_name'] ?? "Doctor";
    final totalQ = subjectProv.totalQuestionsAllSubjects;
    final dashboard = analyticsProv.dashboard;

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: AppColors.primary.withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.medical_services, color: AppColors.primary, size: 20),
            ),
            const SizedBox(width: 10),
            const Text(
              "NEET PG Q-Bank",
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_none),
            onPressed: () {},
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: "Logout",
            onPressed: () {
              auth.logout();
              Navigator.of(context).pushReplacementNamed('/login');
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          await subjectProv.fetchSubjects();
          await analyticsProv.fetchDashboard();
        },
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Welcome Banner
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF1E3A8A), Color(0xFF0F766E)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF1E3A8A).withOpacity(0.2),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "Welcome back, $userName",
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      "$totalQ Verified Questions across 19 Subjects ready for revision.",
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.9),
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 16),
                    // Quick stats pill row
                    Row(
                      children: [
                        _buildBannerPill(
                          Icons.check_circle_outline,
                          "${dashboard?.overallAccuracy.toStringAsFixed(0) ?? 0}% Accuracy",
                        ),
                        const SizedBox(width: 10),
                        _buildBannerPill(
                          Icons.quiz_outlined,
                          "${dashboard?.totalAttempted ?? 0} Solved",
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Quick Action Tiles
              Row(
                children: [
                  Expanded(
                    child: _buildActionTile(
                      icon: Icons.flash_on,
                      title: "Quick Test",
                      subtitle: "20 Random Qs",
                      color: AppColors.primary,
                      onTap: () async {
                        final testProv = Provider.of<TestProvider>(context, listen: false);
                        final success = await testProv.createCustomTest(
                          title: "Daily Practice Sprint",
                          testMode: "practice",
                          questionCount: 20,
                        );
                        if (success && mounted) {
                          Navigator.of(context).push(
                            MaterialPageRoute(builder: (_) => const TestScreen()),
                          );
                        }
                      },
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildActionTile(
                      icon: Icons.history,
                      title: "PYQ Drill",
                      subtitle: "Past Exam Qs",
                      color: AppColors.secondary,
                      onTap: () async {
                        final testProv = Provider.of<TestProvider>(context, listen: false);
                        final success = await testProv.createCustomTest(
                          title: "NEET PG Previous Years Drill",
                          testMode: "practice",
                          questionCount: 25,
                        );
                        if (success && mounted) {
                          Navigator.of(context).push(
                            MaterialPageRoute(builder: (_) => const TestScreen()),
                          );
                        }
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),

              // Subject-wise question bank header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    "Subjects (19 Categories)",
                    style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
                  ),
                  Text(
                    "$totalQ MCQs",
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.primary),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Subjects List Preview
              if (subjectProv.isLoading)
                const Center(
                  child: Padding(
                    padding: EdgeInsets.all(24.0),
                    child: CircularProgressIndicator(),
                  ),
                )
              else
                ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: subjectProv.subjects.take(8).length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (ctx, idx) {
                    final subj = subjectProv.subjects[idx];
                    return InkWell(
                      onTap: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => TopicListScreen(subject: subj),
                          ),
                        );
                      },
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        decoration: BoxDecoration(
                          color: isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: isDark ? AppColors.borderDark : AppColors.borderLight,
                          ),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 36,
                              height: 36,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                color: _getCategoryColor(subj.category).withOpacity(0.12),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                subj.code.isNotEmpty ? subj.code.substring(0, 2) : "MD",
                                style: TextStyle(
                                  color: _getCategoryColor(subj.category),
                                  fontWeight: FontWeight.bold,
                                  fontSize: 13,
                                ),
                              ),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    subj.name,
                                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                                  ),
                                  Text(
                                    "${subj.category} • ${subj.totalQuestions} Questions",
                                    style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                                  ),
                                ],
                              ),
                            ),
                            const Icon(Icons.chevron_right, color: Colors.grey, size: 20),
                          ],
                        ),
                      ),
                    );
                  },
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBannerPill(IconData icon, String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.18),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: Colors.white, size: 14),
          const SizedBox(width: 5),
          Text(
            text,
            style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }

  Widget _buildActionTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required Color color,
    required VoidCallback onTap,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Material(
      color: isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: color.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, color: color, size: 22),
              ),
              const SizedBox(height: 12),
              Text(
                title,
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 4),
              Text(
                subtitle,
                style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Color _getCategoryColor(String category) {
    switch (category) {
      case 'Pre-clinical':
        return AppColors.preClinical;
      case 'Para-clinical':
        return AppColors.paraClinical;
      case 'Clinical':
      default:
        return AppColors.clinical;
    }
  }
}

