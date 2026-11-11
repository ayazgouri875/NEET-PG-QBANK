import 'package:flutter/material.dart';
import '../core/constants/api_constants.dart';
import '../core/services/api_service.dart';

class AuthProvider extends ChangeNotifier {
  final ApiService _api = ApiService();

  bool _isLoading = false;
  String? _errorMessage;
  Map<String, dynamic>? _user;

  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  Map<String, dynamic>? get user => _user;
  bool get isAuthenticated => _user != null && _api.token != null;

  Future<bool> initialize() async {
    await _api.initializeToken();
    if (_api.token != null) {
      return await checkAuth();
    }
    return false;
  }

  Future<bool> checkAuth() async {
    try {
      final res = await _api.get(ApiConstants.me);
      _user = res;
      notifyListeners();
      return true;
    } catch (_) {
      logout();
      return false;
    }
  }

  Future<bool> login(String email, String password) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final res = await _api.post(
        ApiConstants.login,
        body: {"email": email, "password": password},
      );
      final token = res["access_token"];
      _user = res["user"];
      _api.setToken(token);
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _isLoading = false;
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<bool> requestPasswordReset(String email) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      await _api.post(
        ApiConstants.forgotPassword,
        body: {"email": email},
      );
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> resetPassword({
    required String email,
    required String otpCode,
    required String newPassword,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      await _api.post(
        ApiConstants.resetPassword,
        body: {
          "email": email,
          "otp_code": otpCode,
          "new_password": newPassword,
        },
      );
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> register({
    required String email,
    required String password,
    required String fullName,
    int? targetExamYear,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final res = await _api.post(
        ApiConstants.register,
        body: {
          "email": email,
          "password": password,
          "full_name": fullName,
          "target_exam_year": targetExamYear ?? 2026,
        },
      );
      final token = res["access_token"];
      _user = res["user"];
      _api.setToken(token);
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _isLoading = false;
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }

  void logout() {
    _user = null;
    _api.setToken(null);
    notifyListeners();
  }
}
