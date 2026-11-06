import 'package:flutter/material.dart';
import '../core/constants/api_constants.dart';
import '../core/services/api_service.dart';
import '../models/bookmark.dart';

class BookmarkProvider extends ChangeNotifier {
  final ApiService _api = ApiService();

  List<BookmarkItem> _bookmarks = [];
  bool _isLoading = false;
  String? _errorMessage;

  List<BookmarkItem> get bookmarks => _bookmarks;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  Future<void> fetchBookmarks({int? subjectId}) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final params = subjectId != null ? {'subject_id': subjectId} : null;
      final res = await _api.get(ApiConstants.bookmarks, queryParams: params);
      _bookmarks = (res as List).map((b) => BookmarkItem.fromJson(b)).toList();
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _isLoading = false;
      _errorMessage = e.toString();
      notifyListeners();
    }
  }

  Future<bool> removeBookmark(int questionId) async {
    try {
      await _api.post(
        ApiConstants.bookmarkToggle,
        body: {"question_id": questionId},
      );
      _bookmarks.removeWhere((b) => b.questionId == questionId);
      notifyListeners();
      return true;
    } catch (_) {
      return false;
    }
  }
}

