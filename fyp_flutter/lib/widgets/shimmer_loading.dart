import 'package:flutter/material.dart';

// -----------------------------------------------------------------
// SHIMMER LOADING CONTAINER: Animating Shader Gradient Mask
// -----------------------------------------------------------------
class ShimmerLoading extends StatefulWidget {
  final Widget child;
  final bool isLoading;

  const ShimmerLoading({
    super.key,
    required this.isLoading,
    required this.child,
  });

  @override
  State<ShimmerLoading> createState() => _ShimmerLoadingState();
}

class _ShimmerLoadingState extends State<ShimmerLoading>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    );

  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _updateAnimation();
  }

  void _updateAnimation() {
    if (widget.isLoading && !MediaQuery.disableAnimationsOf(context)) {
      if (!_controller.isAnimating) _controller.repeat();
    } else {
      _controller.stop();
    }
  }

  @override
  void didUpdateWidget(ShimmerLoading oldWidget) {
    super.didUpdateWidget(oldWidget);
    _updateAnimation();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.isLoading || MediaQuery.disableAnimationsOf(context)) {
      return widget.child;
    }

    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    final shimmerColors = isDarkMode
        ? [
            const Color(0xFF222222),
            const Color(0xFF333333),
            const Color(0xFF222222),
          ]
        : [
            Colors.grey.shade300,
            Colors.grey.shade100,
            Colors.grey.shade300,
          ];

    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        final val = _controller.value;
        return ShaderMask(
          blendMode: BlendMode.srcATop,
          shaderCallback: (bounds) {
            return LinearGradient(
              colors: shimmerColors,
              stops: const [0.1, 0.5, 0.9],
              begin: Alignment(-1.0 + (val * 2.0), -0.3),
              end: Alignment(0.0 + (val * 2.0), 0.3),
              tileMode: TileMode.clamp,
            ).createShader(bounds);
          },
          child: child,
        );
      },
      child: widget.child,
    );
  }
}

// -----------------------------------------------------------------
// SHIMMER SKELETON PRESET: Mockup Layout representing Student Page
// -----------------------------------------------------------------
class ShimmerSkeleton extends StatelessWidget {
  const ShimmerSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    final baseColor = isDarkMode ? const Color(0xFF222222) : Colors.grey.shade300;
    final accentColor = isDarkMode ? const Color(0xFF333333) : Colors.grey.shade400;

    return SingleChildScrollView(
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Appbar mockup
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: baseColor,
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(width: 100, height: 12, color: baseColor),
                      const SizedBox(height: 6),
                      Container(width: 60, height: 8, color: baseColor),
                    ],
                  ),
                ],
              ),
              Row(
                children: [
                  Container(width: 34, height: 34, decoration: BoxDecoration(color: baseColor, shape: BoxShape.circle)),
                  const SizedBox(width: 8),
                  Container(width: 34, height: 34, decoration: BoxDecoration(color: baseColor, shape: BoxShape.circle)),
                ],
              ),
            ],
          ),
          const SizedBox(height: 24),

          // Welcome Card mockup
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: baseColor,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Row(
              children: [
                CircleAvatar(radius: 24, backgroundColor: accentColor),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(width: 120, height: 14, color: accentColor),
                      const SizedBox(height: 8),
                      Container(width: 180, height: 10, color: accentColor),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Selector bar mockup
          Container(
            height: 40,
            decoration: BoxDecoration(
              color: baseColor,
              borderRadius: BorderRadius.circular(12),
            ),
          ),
          const SizedBox(height: 24),

          // Session Header mockup
          Container(width: 160, height: 14, color: baseColor),
          const SizedBox(height: 12),

          // Session Card mockup 1
          Container(
            height: 120,
            decoration: BoxDecoration(
              color: baseColor,
              borderRadius: BorderRadius.circular(16),
            ),
          ),
          const SizedBox(height: 12),

          // Session Card mockup 2
          Container(
            height: 120,
            decoration: BoxDecoration(
              color: baseColor,
              borderRadius: BorderRadius.circular(16),
            ),
          ),
          const SizedBox(height: 24),

          // Announcements mockup
          Container(width: 150, height: 14, color: baseColor),
          const SizedBox(height: 12),

          Container(
            height: 100,
            decoration: BoxDecoration(
              color: baseColor,
              borderRadius: BorderRadius.circular(16),
            ),
          ),
        ],
      ),
    );
  }
}

// -----------------------------------------------------------------
// SHIMMER SKELETON PRESET: the staff dashboard (header, profile card with three counts, tabs, class cards)
// -----------------------------------------------------------------
class ShimmerStaffSkeleton extends StatelessWidget {
  const ShimmerStaffSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final base = dark ? const Color(0xFF222222) : Colors.grey.shade300;
    Widget box(double w, double h, {double r = 8}) =>
        Container(width: w, height: h, decoration: BoxDecoration(color: base, borderRadius: BorderRadius.circular(r)));
    // The shimmer paints everything it covers in one sweep, so the shapes are drawn directly (no filled panels behind them).
    Widget panel(Widget child) => Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: child);
    Widget classCard() => panel(Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            box(38, 38, r: 11),
            const SizedBox(width: 11),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [box(140, 12), const SizedBox(height: 6), box(100, 10)])),
            box(70, 22, r: 20),
          ]),
          const SizedBox(height: 12),
          box(160, 10),
          const SizedBox(height: 12),
          Row(children: [Expanded(child: box(0, 40, r: 20)), const SizedBox(width: 8), Expanded(child: box(0, 40, r: 20))]),
        ]));
    return SingleChildScrollView(
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          box(36, 36, r: 10),
          const SizedBox(width: 10),
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [box(96, 12), const SizedBox(height: 6), box(130, 8)]),
          const Spacer(),
          for (var i = 0; i < 3; i++) Padding(padding: const EdgeInsets.only(left: 8), child: box(34, 34, r: 10)),
        ]),
        const SizedBox(height: 18),
        panel(Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(width: 56, height: 56, decoration: BoxDecoration(color: base, shape: BoxShape.circle)),
            const SizedBox(width: 14),
            Column(crossAxisAlignment: CrossAxisAlignment.start, children: [box(80, 10), const SizedBox(height: 7), box(120, 16), const SizedBox(height: 7), box(150, 10)]),
          ]),
          const SizedBox(height: 14),
          Row(children: [box(80, 24, r: 20), const SizedBox(width: 6), box(120, 24, r: 20)]),
          const SizedBox(height: 14),
          Row(children: [
            for (var i = 0; i < 3; i++) ...[if (i > 0) const SizedBox(width: 8), Expanded(child: box(0, 62, r: 14))],
          ]),
        ])),
        const SizedBox(height: 16),
        box(double.infinity, 46, r: 14),
        const SizedBox(height: 18),
        classCard(),
        const SizedBox(height: 18),
        box(150, 14),
        const SizedBox(height: 12),
        classCard(),
      ]),
    );
  }
}
