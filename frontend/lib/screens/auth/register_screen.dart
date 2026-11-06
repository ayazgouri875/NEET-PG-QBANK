import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../providers/auth_provider.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _nameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  final _yearCtrl = TextEditingController(text: "2026");
  final _formKey = GlobalKey<FormState>();

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);

    return Scaffold(
      appBar: AppBar(title: const Text("Create Student Account")),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  "Begin NEET PG Preparation",
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 6),
                Text(
                  "Access all 19 subjects, 19,200+ medical MCQs and custom test engines.",
                  style: TextStyle(fontSize: 14, color: Colors.grey.shade600),
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
                  controller: _nameCtrl,
                  decoration: const InputDecoration(
                    labelText: "Doctor's Full Name (e.g. Dr. Priya Patel)",
                    prefixIcon: Icon(Icons.person_outline),
                  ),
                  validator: (v) => v == null || v.isEmpty ? "Enter name" : null,
                ),
                const SizedBox(height: 16),

                TextFormField(
                  controller: _emailCtrl,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(
                    labelText: "Email Address",
                    prefixIcon: Icon(Icons.email_outlined),
                  ),
                  validator: (v) => v == null || !v.contains("@") ? "Enter valid email" : null,
                ),
                const SizedBox(height: 16),

                TextFormField(
                  controller: _passCtrl,
                  obscureText: true,
                  decoration: const InputDecoration(
                    labelText: "Password",
                    prefixIcon: Icon(Icons.lock_outline),
                  ),
                  validator: (v) => v == null || v.length < 6 ? "Minimum 6 characters" : null,
                ),
                const SizedBox(height: 16),

                TextFormField(
                  controller: _yearCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: "Target Exam Year",
                    prefixIcon: Icon(Icons.calendar_today_outlined),
                  ),
                ),
                const SizedBox(height: 28),

                ElevatedButton(
                  onPressed: auth.isLoading
                      ? null
                      : () async {
                          if (_formKey.currentState!.validate()) {
                            final success = await auth.register(
                              fullName: _nameCtrl.text.trim(),
                              email: _emailCtrl.text.trim(),
                              password: _passCtrl.text,
                              targetExamYear: int.tryParse(_yearCtrl.text.trim()),
                            );
                            if (success && mounted) {
                              Navigator.of(context).pushReplacementNamed('/home');
                            }
                          }
                        },
                  child: auth.isLoading
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Text("Register & Start Practicing"),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

