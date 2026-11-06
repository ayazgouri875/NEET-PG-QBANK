import 'package:flutter/material.dart';
import '../core/constants/api_constants.dart';
import '../core/services/api_service.dart';
import '../models/subject.dart';

class SubjectProvider extends ChangeNotifier {
  final ApiService _api = ApiService();

  List<Subject> _subjects = [];
  bool _isLoading = false;
  String? _errorMessage;

  List<Subject> get subjects => _subjects;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  List<Subject> get preClinicalSubjects =>
      _subjects.where((s) => s.category == 'Pre-clinical').toList();

  List<Subject> get paraClinicalSubjects =>
      _subjects.where((s) => s.category == 'Para-clinical').toList();

  List<Subject> get clinicalSubjects =>
      _subjects.where((s) => s.category == 'Clinical').toList();

  int get totalQuestionsAllSubjects =>
      _subjects.fold(0, (sum, s) => sum + s.totalQuestions);

  Future<void> fetchSubjects() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final res = await _api.get(ApiConstants.subjects);
      _subjects = (res as List).map((s) => Subject.fromJson(s)).toList();
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _isLoading = false;
      _errorMessage = e.toString();
      notifyListeners();
    }
  }

  Future<Subject?> fetchSubjectDetail(int subjectId) async {
    try {
      final res = await _api.get("${ApiConstants.subjects}$subjectId");
      return Subject.fromJson(res);
    } catch (e) {
      return null;
    }
  }
}

