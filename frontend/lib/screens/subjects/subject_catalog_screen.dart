import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../models/subject.dart';
import '../../providers/subject_provider.dart';
import 'topic_list_screen.dart';

class SubjectCatalogScreen extends StatelessWidget {
  const SubjectCatalogScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final subjectProv = Provider.of<SubjectProvider>(context);

    return DefaultTabController(
      length: 4,
      child: Scaffold(
        appBar: AppBar(
          title: const Text(
            "Question Bank",
            style: TextStyle(fontWeight: FontWeight.bold),
          ),
          bottom: const TabBar(
            isScrollable: true,
            tabAlignment: TabAlignment.start,
            indicatorColor: AppColors.primary,
            labelColor: AppColors.primary,
            unselectedLabelColor: Colors.grey,
            labelStyle: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
            tabs: [
              Tab(text: "All 19 Subjects"),
              Tab(text: "Pre-clinical"),
              Tab(text: "Para-clinical"),
              Tab(text: "Clinical"),
            ],
          ),
        ),
        body: subjectProv.isLoading
            ? const Center(child: CircularProgressIndicator())
            : TabBarView(
                children: [
                  _buildSubjectList(context, subjectProv.subjects),
                  _buildSubjectList(context, subjectProv.preClinicalSubjects),
                  _buildSubjectList(context, subjectProv.paraClinicalSubjects),
                  _buildSubjectList(context, subjectProv.clinicalSubjects),
                ],
              ),
      ),
    );
  }

  Widget _buildSubjectList(BuildContext context, List<Subject> subjects) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (subjects.isEmpty) {
      return const Center(child: Text("No subjects available"));
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: subjects.length,
      itemBuilder: (ctx, idx) {
        final subj = subjects[idx];
        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          decoration: BoxDecoration(
            color: isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
          ),
          child: ListTile(
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => TopicListScreen(subject: subj),
                ),
              );
            },
            leading: Container(
              width: 44,
              height: 44,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: _getCategoryColor(subj.category).withOpacity(0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                subj.code,
                style: TextStyle(
                  color: _getCategoryColor(subj.category),
                  fontWeight: FontWeight.bold,
                  fontSize: 12,
                ),
              ),
            ),
            title: Text(
              subj.name,
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
            ),
            subtitle: Padding(
              padding: const EdgeInsets.only(top: 4.0),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: _getCategoryColor(subj.category).withOpacity(0.1),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      subj.category,
                      style: TextStyle(
                        color: _getCategoryColor(subj.category),
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    "${subj.totalQuestions} Questions",
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                  ),
                ],
              ),
            ),
            trailing: const Icon(Icons.arrow_forward_ios, size: 16, color: Colors.grey),
          ),
        );
      },
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

