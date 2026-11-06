import 'package:flutter/material.dart';
import '../core/constants/api_constants.dart';
import '../core/services/api_service.dart';
import '../models/analytics.dart';

class AnalyticsProvider extends ChangeNotifier {
  final ApiService _api = ApiService();

  AnalyticsDashboardData? _dashboard;
  List<RecommendationItem> _recommendations = [];
  bool _isLoading = false;
  String? _errorMessage;

  AnalyticsDashboardData? get dashboard => _dashboard;
  List<RecommendationItem> get recommendations => _recommendations;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  Future<void> fetchDashboard() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final res = await _api.get(ApiConstants.analyticsDashboard);
      _dashboard = AnalyticsDashboardData.fromJson(res);
      await fetchRecommendations();
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _isLoading = false;
      _errorMessage = e.toString();
      notifyListeners();
    }
  }

  Future<void> fetchRecommendations() async {
    try {
      final res = await _api.get(ApiConstants.revisionRecommendations);
      final list = res['recommended_revision_modules'] as List? ?? [];
      _recommendations = list.map((r) => RecommendationItem.fromJson(r)).toList();
      notifyListeners();
    } catch (_) {}
  }
}

