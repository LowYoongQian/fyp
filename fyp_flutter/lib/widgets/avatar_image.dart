import 'package:flutter/painting.dart';

String? _lastLink;
ImageProvider? _lastImage;

/// The saved profile photo, the same one the web shows: an http(s) link, or an embedded `data:image/...` photo saved
/// by older web builds. Anything else (empty, unknown scheme, broken data) gives null so callers show the initials.
ImageProvider? avatarImage(Object? link) {
  final url = link?.toString().trim() ?? '';
  if (url.startsWith('https://') || url.startsWith('http://')) return NetworkImage(url);
  if (!url.startsWith('data:image/')) return null;
  // Decoded once and reused, so a rebuild does not decode the photo again or make it flicker.
  if (url == _lastLink) return _lastImage;
  try {
    _lastImage = MemoryImage(UriData.parse(url).contentAsBytes());
  } on FormatException {
    _lastImage = null;
  }
  _lastLink = url;
  return _lastImage;
}
