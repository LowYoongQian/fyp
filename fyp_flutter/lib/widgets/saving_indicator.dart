import 'package:flutter/material.dart';
import '../i18n/tr.dart';
import '../services/save_activity.dart';

/// A thin bar and a small "Saving…" chip at the top of the screen while a save is on its way. It never takes taps.
class SavingIndicator extends StatelessWidget {
  const SavingIndicator({super.key});

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final still = MediaQuery.disableAnimationsOf(context);
    const blue = Color(0xFF2563EB);
    return IgnorePointer(
      child: ValueListenableBuilder<int>(
        valueListenable: savesInFlight,
        builder: (context, saving, _) => AnimatedSwitcher(
          duration: still ? Duration.zero : const Duration(milliseconds: 150),
          child: saving == 0
              ? const SizedBox.shrink()
              : SafeArea(
                  bottom: false,
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    LinearProgressIndicator(minHeight: 3, color: blue, backgroundColor: blue.withValues(alpha: .15), value: still ? 1 : null),
                    const SizedBox(height: 6),
                    Semantics(
                      liveRegion: true,
                      label: tr('Saving…'),
                      excludeSemantics: true,
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          color: dark ? const Color(0xFF1E293B) : Colors.white,
                          borderRadius: BorderRadius.circular(99),
                          border: Border.all(color: blue.withValues(alpha: .25)),
                          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: dark ? .35 : .12), blurRadius: 12, offset: const Offset(0, 4))],
                        ),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          child: Row(mainAxisSize: MainAxisSize.min, children: [
                            SizedBox.square(
                              dimension: 12,
                              child: still
                                  ? const Icon(Icons.cloud_upload_outlined, size: 12, color: blue)
                                  : const CircularProgressIndicator(strokeWidth: 2, color: blue),
                            ),
                            const SizedBox(width: 8),
                            Text(tr('Saving…'),
                                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: dark ? Colors.white : const Color(0xFF0F172A))),
                          ]),
                        ),
                      ),
                    ),
                  ]),
                ),
        ),
      ),
    );
  }
}
