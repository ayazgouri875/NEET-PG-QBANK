import 'dart:io' show Platform;
import 'package:flutter/foundation.dart' show kIsWeb;

class ApiConstants {
  // Configurable Backend API Base URL
  static String get baseUrl {
    if (kIsWeb) {
      return "http://localhost:8000/api/v1";
    }
    try {
      if (Platform.isAndroid) {
        // Android Emulator uses 10.0.2.2 to access host machine localhost
        return "http://10.0.2.2:8000/api/v1";
      }
    } catch (_) {}
    return "http://localhost:8000/api/v1";
  }

  static String get mediaBaseUrl {
    if (kIsWeb) {
      return "http://localhost:8000";
    }
    try {
      if (Platform.isAndroid) {
        return "http://10.0.2.2:8000";
      }
    } catch (_) {}
    return "http://localhost:8000";
  }

  // Endpoints
  static const String login = "/auth/login";
  static const String forgotPassword = "/auth/forgot-password";
  static const String resetPassword = "/auth/reset-password";
  static const String register = "/auth/register";
  static const String me = "/auth/me";
  static const String subjects = "/subjects/";
  static const String questions = "/questions/";
  static const String customTest = "/tests/custom";
  static const String testSession = "/tests/";
  static const String bookmarks = "/bookmarks/";
  static const String bookmarkToggle = "/bookmarks/toggle";
  static const String analyticsDashboard = "/analytics/dashboard";
  static const String revisionRecommendations = "/analytics/recommendations";
}
