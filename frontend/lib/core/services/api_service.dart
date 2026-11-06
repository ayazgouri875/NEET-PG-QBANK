import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../constants/api_constants.dart';

class ApiException implements Exception {
  final String message;
  final int statusCode;

  ApiException(this.message, [this.statusCode = 0]);

  @override
  String toString() => message;
}

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

  String? _token;

  Future<void> initializeToken() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString("access_token");
  }

  void setToken(String? token) async {
    _token = token;
    final prefs = await SharedPreferences.getInstance();
    if (token != null) {
      await prefs.setString("access_token", token);
    } else {
      await prefs.remove("access_token");
    }
  }

  String? get token => _token;

  Map<String, String> _buildHeaders() {
    final headers = {
      "Content-Type": "application/json",
      "Accept": "application/json",
    };
    if (_token != null) {
      headers["Authorization"] = "Bearer $_token";
    }
    return headers;
  }

  Future<dynamic> get(String endpoint, {Map<String, dynamic>? queryParams}) async {
    var uri = Uri.parse("${ApiConstants.baseUrl}$endpoint");
    if (queryParams != null && queryParams.isNotEmpty) {
      final stringParams = queryParams.map((k, v) => MapEntry(k, v.toString()));
      uri = uri.replace(queryParameters: stringParams);
    }

    try {
      final response = await http.get(uri, headers: _buildHeaders());
      return _processResponse(response);
    } on SocketException {
      throw ApiException("Unable to connect to NEET PG server. Please check your internet connection.");
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException("Network request failed: $e");
    }
  }

  Future<dynamic> post(String endpoint, {Map<String, dynamic>? body}) async {
    final uri = Uri.parse("${ApiConstants.baseUrl}$endpoint");
    try {
      final response = await http.post(
        uri,
        headers: _buildHeaders(),
        body: body != null ? jsonEncode(body) : null,
      );
      return _processResponse(response);
    } on SocketException {
      throw ApiException("Unable to connect to NEET PG server. Please check your internet connection.");
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException("Network request failed: $e");
    }
  }

  dynamic _processResponse(http.Response response) {
    dynamic body;
    try {
      body = jsonDecode(utf8.decode(response.bodyBytes));
    } catch (_) {
      body = response.body;
    }

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return body;
    } else if (response.statusCode == 401) {
      throw ApiException("Session expired. Please log in again.", 401);
    } else {
      final msg = (body is Map && body.containsKey("detail"))
          ? body["detail"]
          : "Server error occurred (${response.statusCode})";
      throw ApiException(msg.toString(), response.statusCode);
    }
  }
}

