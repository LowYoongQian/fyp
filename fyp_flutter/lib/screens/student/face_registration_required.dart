import 'package:flutter/material.dart';

/// Account setup cannot be skipped, but camera errors never prevent sign-out.
class FaceRegistrationRequired extends StatelessWidget {
  final String studentName;
  final bool busy;
  final VoidCallback onRegister;
  final VoidCallback onLogout;
  final Future<void> Function() onRefresh;

  const FaceRegistrationRequired({
    super.key,
    required this.studentName,
    required this.busy,
    required this.onRegister,
    required this.onLogout,
    required this.onRefresh,
  });

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return SafeArea(
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 460),
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Icon(
                      Icons.face_retouching_natural,
                      size: 56,
                      color: colors.primary,
                    ),
                    const SizedBox(height: 20),
                    Text(
                      'Register your face',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.headlineSmall
                          ?.copyWith(fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'Welcome, $studentName. Complete a live camera scan to finish setting up your student account.',
                      textAlign: TextAlign.center,
                      style: const TextStyle(height: 1.5),
                    ),
                    const SizedBox(height: 20),
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: colors.primaryContainer,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Text(
                        'Use good lighting and keep only your face in view. Once registered, you cannot change your face in the app. Visit the administration office if you need a reset.',
                        style: TextStyle(
                          height: 1.5,
                          color: colors.onPrimaryContainer,
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),
                    FilledButton.icon(
                      onPressed: busy ? null : onRegister,
                      icon: const Icon(Icons.camera_alt_outlined),
                      label: Text(
                        busy
                            ? 'Preparing or verifying your scan…'
                            : 'Start live registration',
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextButton.icon(
                      onPressed: busy ? null : () => onRefresh(),
                      icon: const Icon(Icons.refresh),
                      label: const Text('Refresh registration status'),
                    ),
                    TextButton(
                      onPressed: onLogout,
                      child: const Text('Sign out'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
