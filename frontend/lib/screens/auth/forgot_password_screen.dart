import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../providers/auth_provider.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key, required this.initialEmail});

  final String initialEmail;

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _emailCtrl = TextEditingController();
  final _codeCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _confirmPasswordCtrl = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _codeSent = false;

  @override
  void initState() {
    super.initState();
    _emailCtrl.text = widget.initialEmail;
  }

  @override
  void dispose() {
    _emailCtrl.dispose();
    _codeCtrl.dispose();
    _passwordCtrl.dispose();
    _confirmPasswordCtrl.dispose();
    super.dispose();
  }

  Future<void> _requestCode(AuthProvider auth) async {
    final success = await auth.requestPasswordReset(_emailCtrl.text.trim());
    if (success && mounted) {
      setState(() => _codeSent = true);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            "If an account exists, check your inbox for a reset code. Check spam if it doesn't arrive.",
          ),
        ),
      );
    }
  }

  Future<void> _submit(AuthProvider auth) async {
    if (!_formKey.currentState!.validate()) return;

    final success = await auth.resetPassword(
      email: _emailCtrl.text.trim(),
      otpCode: _codeCtrl.text.trim(),
      newPassword: _passwordCtrl.text,
    );
    if (success && mounted) {
      Navigator.of(context).pop(true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);

    return Scaffold(
      appBar: AppBar(title: const Text("Reset Password")),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  "Forgot your password?",
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                Text(
                  _codeSent
                      ? "Enter the 6-digit code from your email and choose a new password."
                      : "Enter your account email and we'll send you a password reset code.",
                  style: TextStyle(color: Colors.grey.shade600),
                ),
                const SizedBox(height: 24),
                if (auth.errorMessage != null) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.incorrectLight,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      auth.errorMessage!,
                      style: const TextStyle(color: AppColors.incorrect, fontSize: 13),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
                TextFormField(
                  controller: _emailCtrl,
                  enabled: !_codeSent && !auth.isLoading,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(
                    labelText: "Email Address",
                    prefixIcon: Icon(Icons.email_outlined),
                  ),
                  validator: (value) {
                    if (value == null || !value.contains("@")) {
                      return "Enter a valid email address";
                    }
                    return null;
                  },
                ),
                if (_codeSent) ...[
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _codeCtrl,
                    keyboardType: TextInputType.number,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    maxLength: 6,
                    decoration: const InputDecoration(
                      labelText: "6-digit reset code",
                      prefixIcon: Icon(Icons.pin_outlined),
                    ),
                    validator: (value) =>
                        value == null || value.trim().length != 6 ? "Enter the 6-digit code" : null,
                  ),
                  const SizedBox(height: 8),
                  TextFormField(
                    controller: _passwordCtrl,
                    obscureText: true,
                    decoration: const InputDecoration(
                      labelText: "New Password",
                      prefixIcon: Icon(Icons.lock_outline),
                    ),
                    validator: (value) {
                      if (value == null || value.length < 8) {
                        return "Use at least 8 characters";
                      }
                      if (!RegExp(r"[A-Za-z]").hasMatch(value) ||
                          !RegExp(r"\d").hasMatch(value)) {
                        return "Include at least one letter and one number";
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _confirmPasswordCtrl,
                    obscureText: true,
                    decoration: const InputDecoration(
                      labelText: "Confirm New Password",
                      prefixIcon: Icon(Icons.lock_outline),
                    ),
                    validator: (value) =>
                        value != _passwordCtrl.text ? "Passwords do not match" : null,
                  ),
                ],
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: auth.isLoading
                      ? null
                      : () async {
                          if (!_codeSent) {
                            if (_formKey.currentState!.validate()) {
                              await _requestCode(auth);
                            }
                          } else {
                            await _submit(auth);
                          }
                        },
                  child: auth.isLoading
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : Text(_codeSent ? "Reset Password" : "Send Reset Code"),
                ),
                if (_codeSent) ...[
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: auth.isLoading ? null : () => _requestCode(auth),
                    child: const Text("Resend code"),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
