import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../providers/subject_provider.dart';
import '../../providers/test_provider.dart';
import 'test_screen.dart';

class TestGeneratorScreen extends StatefulWidget {
  const TestGeneratorScreen({super.key});

  @override
  State<TestGeneratorScreen> createState() => _TestGeneratorScreenState();
}

class _TestGeneratorScreenState extends State<TestGeneratorScreen> {
  final _titleCtrl = TextEditingController(text: "Custom Practice Test");
  String _testMode = "practice"; // 'practice' or 'exam'
  int _questionCount = 25;
  bool _isTimed = false;
  int _durationMinutes = 30;
  String _filterStatus = "all"; // 'all', 'unattempted', 'incorrect'
  final Set<int> _selectedSubjectIds = {};

  @override
  Widget build(BuildContext context) {
    final subjectProv = Provider.of<SubjectProvider>(context);
    final testProv = Provider.of<TestProvider>(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          "Custom Test Generator",
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Mode Selector
            const Text(
              "Select Test Mode",
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: _buildModeCard(
                    title: "Practice Mode",
                    subtitle: "Instant explanations & references",
                    icon: Icons.lightbulb_outline,
                    isSelected: _testMode == "practice",
                    onTap: () => setState(() => _testMode = "practice"),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildModeCard(
                    title: "Exam Mode",
                    subtitle: "Timed simulation • Explanations at end",
                    icon: Icons.timer_outlined,
                    isSelected: _testMode == "exam",
                    onTap: () => setState(() => _testMode = "exam"),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),

            // Number of questions
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  "Number of Questions",
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                ),
                Text(
                  "$_questionCount MCQs",
                  style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.primary),
                ),
              ],
            ),
            Slider(
              value: _questionCount.toDouble(),
              min: 5,
              max: 100,
              divisions: 19,
              activeColor: AppColors.primary,
              label: "$_questionCount",
              onChanged: (v) => setState(() => _questionCount = v.toInt()),
            ),
            const SizedBox(height: 16),

            // Question Filter Type (All, Unattempted, Incorrect)
            const Text(
              "Question Source",
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: [
                _buildFilterChip("all", "All Questions"),
                _buildFilterChip("unattempted", "Unattempted Only"),
                _buildFilterChip("incorrect", "Incorrect Attempts Only"),
              ],
            ),
            const SizedBox(height: 20),

            // Timed toggle (if exam mode)
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text("Timed Test", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
              subtitle: Text(
                _isTimed ? "$_durationMinutes minutes allowed" : "Untimed learning pace",
                style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
              ),
              value: _isTimed,
              activeColor: AppColors.primary,
              onChanged: (v) => setState(() => _isTimed = v),
            ),
            const SizedBox(height: 16),

            // Subject Selector Header
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  "Choose Subjects (Optional)",
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                ),
                TextButton(
                  onPressed: () {
                    setState(() {
                      if (_selectedSubjectIds.length == subjectProv.subjects.length) {
                        _selectedSubjectIds.clear();
                      } else {
                        _selectedSubjectIds.addAll(subjectProv.subjects.map((s) => s.id));
                      }
                    });
                  },
                  child: Text(
                    _selectedSubjectIds.length == subjectProv.subjects.length
                        ? "Deselect All"
                        : "Select All",
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),

            // Subject Multi-Select Chips
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: subjectProv.subjects.map((subj) {
                final isSelected = _selectedSubjectIds.contains(subj.id);
                return FilterChip(
                  label: Text("${subj.name} (${subj.totalQuestions})"),
                  selected: isSelected,
                  selectedColor: AppColors.primary.withOpacity(0.15),
                  checkmarkColor: AppColors.primary,
                  labelStyle: TextStyle(
                    fontSize: 12,
                    fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                    color: isSelected ? AppColors.primary : (isDark ? Colors.white : Colors.black87),
                  ),
                  onSelected: (selected) {
                    setState(() {
                      if (selected) {
                        _selectedSubjectIds.add(subj.id);
                      } else {
                        _selectedSubjectIds.remove(subj.id);
                      }
                    });
                  },
                );
              }).toList(),
            ),
            const SizedBox(height: 32),

            // Start Button
            ElevatedButton(
              onPressed: testProv.isLoading
                  ? null
                  : () async {
                      final success = await testProv.createCustomTest(
                        title: _titleCtrl.text.trim(),
                        testMode: _testMode,
                        subjectIds: _selectedSubjectIds.toList(),
                        questionCount: _questionCount,
                        isTimed: _isTimed,
                        durationMinutes: _isTimed ? _durationMinutes : null,
                        filterStatus: _filterStatus,
                      );
                      if (success && mounted) {
                        Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => const TestScreen()),
                        );
                      }
                    },
              child: testProv.isLoading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : Text("Create Test ($_questionCount Questions)"),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildModeCard({
    required String title,
    required String subtitle,
    required IconData icon,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isSelected
              ? (isDark ? AppColors.primary.withOpacity(0.2) : const Color(0xFFEFF6FF))
              : (isDark ? AppColors.surfaceDark : AppColors.surfaceLight),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isSelected ? AppColors.primaryLight : (isDark ? AppColors.borderDark : AppColors.borderLight),
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: isSelected ? AppColors.primaryLight : Colors.grey, size: 24),
            const SizedBox(height: 8),
            Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
            const SizedBox(height: 4),
            Text(subtitle, style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterChip(String value, String label) {
    final isSelected = _filterStatus == value;
    return ChoiceChip(
      label: Text(label),
      selected: isSelected,
      selectedColor: AppColors.primary.withOpacity(0.15),
      labelStyle: TextStyle(
        fontSize: 12,
        fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
        color: isSelected ? AppColors.primary : Colors.grey.shade700,
      ),
      onSelected: (_) => setState(() => _filterStatus = value),
    );
  }
}

