bool isAlreadyCheckedInError(String message) {
  final lower = message.toLowerCase();
  return lower.contains('already registered attendance') ||
      lower.contains('already checked in');
}

String friendlyStudentError(String rawMsg) {
  final lower = rawMsg.toLowerCase();
  if (isAlreadyCheckedInError(rawMsg)) {
    return 'Already Checked In: Your attendance for this class session is already verified.';
  }
  if (lower.contains('already registered')) {
    return 'Face Already Registered: Your face is already registered. Visit the administration office if you need a reset.';
  }
  if (lower.contains('liveness') || lower.contains('blink') ||
      lower.contains('nod') || lower.contains('suspicious')) {
    return "Liveness Verification Failed: We couldn't verify a live face. Use your camera and complete the prompted movements.";
  }
  if (lower.contains('not registered') || lower.contains('register face') ||
      lower.contains('no registered face')) {
    return 'Face Registration Required: Please complete your one-time selfie profile registration first.';
  }
  if (lower.contains('unavailable')) return rawMsg.replaceAll('Exception: ', '').trim();
  if (lower.contains('face') && (lower.contains('not match') ||
      lower.contains('mismatch') || lower.contains('no match') ||
      lower.contains('identity could not be verified') || lower.contains('failed'))) {
    return 'Face Match Failed: Your face could not be matched to your registered profile. Use good lighting and look directly at the camera.';
  }
  // The server's two campus answers first: "unable to verify" (no reliable evidence) is not "off campus", and the
  // off-campus sentence says "connection", which is not a lost connection.
  if (lower.contains('unable to verify your network')) return rawMsg.replaceAll('Exception: ', '').trim();
  if (lower.contains('outside the approved campus network')) {
    return 'Off-Campus Network: You are not connected to the approved campus Wi-Fi network.';
  }
  // A lost connection next: its text often says "network" ("Network is unreachable"), which is not the campus check.
  if (lower.contains('socketexception') || lower.contains('clientexception') || lower.contains('connection') ||
      lower.contains('timeout')) {
    return 'Connection Error: Cannot reach the server. Please check your internet connection.';
  }
  if (lower.contains('wifi') || lower.contains('network') ||
      lower.contains('bssid') || lower.contains('subnet')) {
    return 'Off-Campus Network: You are not connected to the approved campus Wi-Fi network.';
  }
  if (lower.contains('closed') || lower.contains('expired')) {
    return 'Session Closed: This attendance window has expired or has been closed by your lecturer.';
  }
  return rawMsg.replaceAll('Exception: ', '').trim();
}
