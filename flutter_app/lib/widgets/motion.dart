import 'package:flutter/material.dart';

/// Shared, low-cost motion primitives. They deliberately do not impose size,
/// color, or layout constraints on the widgets they wrap.
class AppMotion {
  static const fast = Duration(milliseconds: 180);
  static const standard = Duration(milliseconds: 320);
  static const curve = Curves.easeOutCubic;
}

class Pressable extends StatefulWidget {
  const Pressable({super.key, required this.child, this.enabled = true});

  final Widget child;
  final bool enabled;

  @override
  State<Pressable> createState() => _PressableState();
}

class _PressableState extends State<Pressable> {
  bool _pressed = false;

  void _setPressed(bool value) {
    if (widget.enabled && mounted) setState(() => _pressed = value);
  }

  @override
  Widget build(BuildContext context) {
    return Listener(
      onPointerDown: (_) => _setPressed(true),
      onPointerUp: (_) => _setPressed(false),
      onPointerCancel: (_) => _setPressed(false),
      child: AnimatedScale(
        duration: AppMotion.fast,
        curve: AppMotion.curve,
        scale: _pressed ? 0.975 : 1,
        child: widget.child,
      ),
    );
  }
}

class FadeSlideIn extends StatelessWidget {
  const FadeSlideIn({super.key, required this.child, this.delay = Duration.zero});

  final Widget child;
  final Duration delay;

  @override
  Widget build(BuildContext context) {
    return _DelayedEntrance(delay: delay, child: child);
  }
}

class _DelayedEntrance extends StatefulWidget {
  const _DelayedEntrance({required this.child, required this.delay});
  final Widget child;
  final Duration delay;

  @override
  State<_DelayedEntrance> createState() => _DelayedEntranceState();
}

class _DelayedEntranceState extends State<_DelayedEntrance> {
  bool _visible = false;

  @override
  void initState() {
    super.initState();
    Future<void>.delayed(widget.delay, () {
      if (mounted) setState(() => _visible = true);
    });
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedOpacity(
      duration: AppMotion.standard,
      curve: AppMotion.curve,
      opacity: _visible ? 1 : 0,
      child: AnimatedSlide(
        duration: AppMotion.standard,
        curve: AppMotion.curve,
        offset: _visible ? Offset.zero : const Offset(0, .035),
        child: widget.child,
      ),
    );
  }
}

class AnimatedLoadingIndicator extends StatefulWidget {
  const AnimatedLoadingIndicator({super.key, this.color});
  final Color? color;

  @override
  State<AnimatedLoadingIndicator> createState() => _AnimatedLoadingIndicatorState();
}

class _AnimatedLoadingIndicatorState extends State<AnimatedLoadingIndicator>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Center(
      child: FadeTransition(
        opacity: Tween<double>(begin: .55, end: 1).animate(_controller),
        child: CircularProgressIndicator(color: widget.color),
      ),
    );
  }
}
