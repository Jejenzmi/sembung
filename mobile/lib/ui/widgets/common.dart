import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../core/theme.dart';

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.title, {super.key, this.action, this.onAction});
  final String title;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 22, 12, 10),
      child: Row(
        children: [
          Expanded(
            child: Text(
              title,
              style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
            ),
          ),
          if (action != null)
            TextButton(
              onPressed: onAction,
              child: Text(action!,
                  style: const TextStyle(fontWeight: FontWeight.w700)),
            ),
        ],
      ),
    );
  }
}

class AppCard extends StatelessWidget {
  const AppCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.onTap,
    this.color,
  });

  final Widget child;
  final EdgeInsets padding;
  final VoidCallback? onTap;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: color ?? Colors.white,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Padding(padding: padding, child: child),
      ),
    );
  }
}

class Pill extends StatelessWidget {
  const Pill(this.text, {super.key, this.color, this.background, this.icon});
  final String text;
  final Color? color;
  final Color? background;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: background ?? AppColors.mossLight,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 13, color: color ?? AppColors.moss),
            const SizedBox(width: 4),
          ],
          Text(
            text,
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w700,
              color: color ?? AppColors.moss,
            ),
          ),
        ],
      ),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.text, this.emoji = '🗻', this.action});
  final String text;
  final String emoji;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(emoji, style: const TextStyle(fontSize: 44)),
            const SizedBox(height: 12),
            Text(
              text,
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.muted, height: 1.5),
            ),
            if (action != null) ...[const SizedBox(height: 18), action!],
          ],
        ),
      ),
    );
  }
}

class ErrorView extends StatelessWidget {
  const ErrorView({super.key, required this.message, this.onRetry});
  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return EmptyState(
      emoji: '📡',
      text: message,
      action: onRetry == null
          ? null
          : OutlinedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Coba lagi'),
            ),
    );
  }
}

class NetImage extends StatelessWidget {
  const NetImage(this.url, {super.key, this.height, this.width, this.radius = 0});
  final String? url;
  final double? height;
  final double? width;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final placeholder = Container(
      height: height,
      width: width,
      color: AppColors.mossLight,
      alignment: Alignment.center,
      child: const Text('🏔️', style: TextStyle(fontSize: 28)),
    );
    if (url == null || url!.isEmpty) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(radius),
        child: placeholder,
      );
    }
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: CachedNetworkImage(
        imageUrl: url!,
        height: height,
        width: width,
        fit: BoxFit.cover,
        placeholder: (_, __) => placeholder,
        errorWidget: (_, __, ___) => placeholder,
      ),
    );
  }
}

/// Consistent SnackBar so success and failure read the same across screens.
void showSnack(BuildContext context, String message, {bool error = false}) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: error ? AppColors.danger : AppColors.mossDark,
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.all(14),
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    );
}

class StatusChip extends StatelessWidget {
  const StatusChip(this.status, {super.key});
  final String status;

  static const _map = <String, (Color, Color, String)>{
    'PENDING_PAYMENT': (Color(0xFFB45309), Color(0xFFFEF3C7), 'Menunggu Bayar'),
    'PAID': (AppColors.sky, Color(0xFFE0F2FE), 'E-Pass Aktif'),
    'CHECKED_IN': (AppColors.moss, AppColors.mossLight, 'Sedang Mendaki'),
    'COMPLETED': (AppColors.muted, Color(0xFFE2E8F0), 'Selesai'),
    'CANCELLED': (AppColors.danger, Color(0xFFFFE4E6), 'Dibatalkan'),
    'EXPIRED': (AppColors.danger, Color(0xFFFFE4E6), 'Kedaluwarsa'),
    'OPEN': (AppColors.danger, Color(0xFFFFE4E6), 'Terkirim'),
    'ACKNOWLEDGED': (Color(0xFFB45309), Color(0xFFFEF3C7), 'Ditanggapi'),
    'RESCUING': (AppColors.ember, AppColors.emberLight, 'Evakuasi'),
    'RESOLVED': (AppColors.moss, AppColors.mossLight, 'Selesai'),
    'FALSE_ALARM': (AppColors.muted, Color(0xFFE2E8F0), 'Alarm Palsu'),
  };

  @override
  Widget build(BuildContext context) {
    final (fg, bg, label) =
        _map[status] ?? (AppColors.muted, const Color(0xFFE2E8F0), status);
    return Pill(label, color: fg, background: bg);
  }
}
