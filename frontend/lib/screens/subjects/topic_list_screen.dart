import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../models/subject.dart';
import '../../providers/subject_provider.dart';
import '../../providers/test_provider.dart';
import '../test_engine/test_screen.dart';

class TopicListScreen extends StatefulWidget {
  final Subject subject;

  const TopicListScreen({super.key, required this.subject});

  @override
  State<TopicListScreen> createState() => _TopicListScreenState();
}

class _TopicListScreenState extends State<TopicListScreen> {
  Subject? _detailSubject;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadTopics();
  }

  Future<void> _loadTopics() async {
    final prov = Provider.of<SubjectProvider>(context, listen: false);
    final res = await prov.fetchSubjectDetail(widget.subject.id);
    if (mounted) {
      setState(() {
        _detailSubject = res ?? widget.subject;
        _isLoading = false;
      });
    }
  }

  void _startTopicPractice(Topic topic) async {
    final testProv = Provider.of<TestProvider>(context, listen: false);
    final success = await testProv.createCustomTest(
      title: "${widget.subject.name} - ${topic.name}",
      testMode: "practice",
      subjectIds: [widget.subject.id],
      topicIds: [topic.id],
      questionCount: topic.totalQuestions > 25 ? 25 : topic.totalQuestions,
    );
    if (success && mounted) {
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => const TestScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final topics = _detailSubject?.topics ?? [];

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.subject.name),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Subject Summary Banner
                Container(
                  padding: const EdgeInsets.all(16),
                  color: isDark ? AppColors.surfaceDark : Colors.grey.shade50,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            "${topics.length} High-Yield Modules",
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            "${widget.subject.totalQuestions} Questions total",
                            style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
                          ),
                        ],
                      ),
                      ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          minimumSize: const Size(130, 42),
                          backgroundColor: AppColors.primary,
                        ),
                        onPressed: () async {
                          final testProv = Provider.of<TestProvider>(context, listen: false);
                          final success = await testProv.createCustomTest(
                            title: "${widget.subject.name} Full Practice Drill",
                            testMode: "practice",
                            subjectIds: [widget.subject.id],
                            questionCount: 30,
                          );
                          if (success && mounted) {
                            Navigator.of(context).push(
                              MaterialPageRoute(builder: (_) => const TestScreen()),
                            );
                          }
                        },
                        icon: const Icon(Icons.play_arrow, size: 18),
                        label: const Text("All Topics", style: TextStyle(fontSize: 13)),
                      ),
                    ],
                  ),
                ),
                const Divider(height: 1),

                // Topics List
                Expanded(
                  child: ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: topics.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (ctx, idx) {
                      final topic = topics[idx];
                      return Container(
                        decoration: BoxDecoration(
                          color: isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
                        ),
                        child: ExpansionTile(
                          shape: const Border(),
                          leading: CircleAvatar(
                            radius: 16,
                            backgroundColor: AppColors.primary.withOpacity(0.1),
                            child: Text(
                              "${idx + 1}",
                              style: const TextStyle(
                                color: AppColors.primary,
                                fontWeight: FontWeight.bold,
                                fontSize: 13,
                              ),
                            ),
                          ),
                          title: Text(
                            topic.name,
                            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                          ),
                          subtitle: Text(
                            "${topic.totalQuestions} Questions • ${topic.subtopics.length} Subtopics",
                            style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                          ),
                          trailing: IconButton(
                            icon: const Icon(Icons.play_circle_fill, color: AppColors.primary, size: 28),
                            onPressed: () => _startTopicPractice(topic),
                          ),
                          children: [
                            if (topic.subtopics.isNotEmpty) ...[
                              const Divider(height: 1),
                              for (final st in topic.subtopics)
                                ListTile(
                                  dense: true,
                                  contentPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 0),
                                  leading: const Icon(Icons.subdirectory_arrow_right, size: 18, color: Colors.grey),
                                  title: Text(st.name, style: const TextStyle(fontSize: 13.5)),
                                  trailing: Text(
                                    "${st.totalQuestions} Qs",
                                    style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                                  ),
                                ),
                            ],
                          ],
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
    );
  }
}

