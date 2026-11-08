// ignore_for_file: deprecated_member_use, use_build_context_synchronously
import '../../i18n/tr.dart';
import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:camera/camera.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import 'package:http/http.dart' as http;
import '../../widgets/aurora_background.dart';
import '../../widgets/glass_card.dart';

// -----------------------------------------------------------------
// SCREEN 3: Face Recognition Scanner Screen with scanning animation
// -----------------------------------------------------------------
/// Whether a detected face is looking at the camera. Small turn, tilt and roll are not enough on their own: with eye
/// and nose positions (image x, same space as [faceWidth]) the eyes must sit at least 28% of the face width apart and
/// the nose within 22% of that gap from their middle — a side view crowds the eyes and pushes the nose aside.
/// Without positions it falls back to both eyes having been seen.
bool isFrontalFace({
  required double? yaw,
  required double? pitch,
  required double roll,
  required double faceWidth,
  double? leftEyeX,
  double? rightEyeX,
  double? noseX,
  bool bothEyesSeen = false,
}) {
  if (yaw == null || pitch == null) return false;
  if (yaw.abs() > 10 || pitch.abs() > 12 || roll.abs() > 12) return false;
  if (leftEyeX == null || rightEyeX == null || noseX == null) return bothEyesSeen;
  final gap = (leftEyeX - rightEyeX).abs();
  if (gap < faceWidth * .28) return false;
  return (noseX - (leftEyeX + rightEyeX) / 2).abs() <= gap * .22;
}

class FaceScannerScreen extends StatefulWidget {
  final String title;
  final Function(String? imageBase64, bool livenessPassed, {int? challengeMs, String? challengeToken})
  onScanComplete;
  final String? sessionId;
  final String? authToken;
  final String? apiBaseUrl;

  const FaceScannerScreen({
    super.key,
    required this.title,
    required this.onScanComplete,
    this.sessionId,
    this.authToken,
    this.apiBaseUrl,
  });

  @override
  State<FaceScannerScreen> createState() => _FaceScannerScreenState();
}

class _FaceScannerScreenState extends State<FaceScannerScreen>
    with TickerProviderStateMixin {
  late AnimationController _scannerAnimController;
  // Drives the gesture cue: a blink, or an arrow moving the way to turn.
  late final AnimationController _cueController;

  CameraController? _cameraController;
  List<CameraDescription>? _cameras;
  bool _isCameraInitialized = false;
  String? _cameraError;

  bool isScanning = false;
  double progress = 0.0;
  String scanningStatusText = "Position your face in the oval guide";
  Timer? _progressTimer;

  final List<String> _challenges = ["Blink", "Turn Left", "Turn Right", "Nod"];
  late String _currentChallenge;
  double _eyeOpenProbability = 0.95;
  double _headRotationAngle = 0.0;
  double _headRotationAnglePitch = 0.0;
  bool _challengeSuccess = false;

  // Active liveness: two chained challenges, 4s each (8s total budget).
  static const int _kChallengeCount = 2;
  static const double _kPerChallengeSeconds = 4.0;
  // Persists across check-ins so the same pair never repeats consecutively.
  static List<String>? _lastPair;

  double _countdownSeconds = _kPerChallengeSeconds;
  Timer? _countdownTimer;
  bool _isWaitingForGesture = false;
  // Brief green pulse shown when a gesture is detected.
  bool _showSuccessPulse = false;

  late final FaceDetector _faceDetector;
  bool _isProcessingImage = false;
  // The detector's latest face box; the drawn box glides toward it every frame (see _onTrackTick).
  Rect? _targetFaceRect;
  final ValueNotifier<Rect?> _shownFace = ValueNotifier<Rect?>(null);
  late final Ticker _trackTicker;
  Duration _lastTick = Duration.zero;
  // Frontal detections in a row; a lock needs a few, so one lucky frame of a turned face never counts.
  int _frontalStreak = 0;
  // This frame's verdict, for the frame colour: green when frontal, red when the face is turned.
  bool _frontalNow = false;
  // Hold steady: the face box has barely moved over the last few detections.
  Rect? _lastBox;
  int _steadyStreak = 0;
  bool _steady = false;
  static const int _kFrontalFrames = 3;
  Size? _trackingImageSize;
  InputImageRotation _trackingRotation = InputImageRotation.rotation0deg;
  bool _faceDetected = false;
  bool _captureReady = false;
  String _trackingMessage = "Move your face into view";
  DateTime _lastDetectionAt = DateTime.fromMillisecondsSinceEpoch(0);
  int _completedTasksCount = 0;
  List<String> _selectedChallenges = [];
  // Behavioral biometrics: when the user clicked "Detect Face"
  DateTime? _scanStartedAt;
  String? _challengeToken;
  bool _preparingChallenge = false;
  // ML Kit stays below the camera preview rate so frames never queue. The native
  // preview remains fluid while detection updates the target roughly 12-15 times/s.
  static const Duration _detectionInterval = Duration(milliseconds: 70);

  @override
  void initState() {
    super.initState();
    _currentChallenge = _challenges[0];
    _faceDetector = FaceDetector(
      options: FaceDetectorOptions(
        enableClassification: true,
        // Eye and nose positions let a side view be told apart from a frontal face (see _isFrontal).
        enableLandmarks: true,
        enableTracking: true,
        performanceMode: FaceDetectorMode.fast,
      ),
    );
    _scannerAnimController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);
    _trackTicker = createTicker(_onTrackTick)..start();
    _cueController = AnimationController(vsync: this, duration: const Duration(milliseconds: 1300))..repeat();

    _initializeCamera();
  }

  Future<void> _initializeCamera() async {
    try {
      _cameras = await availableCameras();
      if (_cameras == null || _cameras!.isEmpty) {
        setState(() {
          _cameraError = "No cameras detected on this device.";
        });
        return;
      }

      // Select front camera or fallback to first available
      final frontCamera = _cameras!.firstWhere(
        (camera) => camera.lensDirection == CameraLensDirection.front,
        orElse: () => _cameras!.first,
      );

      _cameraController = CameraController(
        frontCamera,
        ResolutionPreset.medium,
        enableAudio: false,
        imageFormatGroup: Platform.isIOS
            ? ImageFormatGroup.bgra8888
            : ImageFormatGroup.yuv420,
      );

      await _cameraController!.initialize();
      if (mounted) {
        setState(() {
          _isCameraInitialized = true;
        });
        _startImageStream();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _cameraError = tr('Camera error: {error}', {'error': e});
        });
      }
    }
  }

  /// Runs every frame (~60 fps): moves the drawn face box a step toward the latest detection, so the frame follows
  /// the face smoothly instead of jumping at the detector's ~14 updates a second. Only the overlay repaints.
  void _onTrackTick(Duration elapsed) {
    final dt = ((elapsed - _lastTick).inMicroseconds / 1e6).clamp(0.0, .1);
    _lastTick = elapsed;
    final target = _targetFaceRect;
    final shown = _shownFace.value;
    if (target == null) {
      if (shown != null) _shownFace.value = null;
      return;
    }
    if (shown == null) {
      _shownFace.value = target;
      return;
    }
    final next = Rect.lerp(shown, target, 1 - math.exp(-dt / .06))!;
    final moved = (next.left - shown.left).abs() + (next.top - shown.top).abs() +
        (next.right - shown.right).abs() + (next.bottom - shown.bottom).abs();
    if (moved > .2) _shownFace.value = next;
  }

  /// A frontal face: small turn, tilt and roll, and (when ML Kit reports them) both eyes and the nose placed as on a
  /// face looking at the camera. A side view can still report a small angle, but its eyes crowd together and the nose
  /// leaves the space between them, so it does not count.
  bool _isFrontal(Face face, double? yaw, double? pitch, double roll) => isFrontalFace(
        yaw: yaw,
        pitch: pitch,
        roll: roll,
        faceWidth: face.boundingBox.width,
        leftEyeX: face.landmarks[FaceLandmarkType.leftEye]?.position.x.toDouble(),
        rightEyeX: face.landmarks[FaceLandmarkType.rightEye]?.position.x.toDouble(),
        noseX: face.landmarks[FaceLandmarkType.noseBase]?.position.x.toDouble(),
        bothEyesSeen: face.leftEyeOpenProbability != null && face.rightEyeOpenProbability != null,
      );

  @override
  void dispose() {
    _trackTicker.dispose();
    _cueController.dispose();
    _shownFace.dispose();
    _scannerAnimController.dispose();
    _progressTimer?.cancel();
    _countdownTimer?.cancel();
    try {
      if (_cameraController != null &&
          _cameraController!.value.isStreamingImages) {
        _cameraController!.stopImageStream();
      }
    } catch (e) {
      debugPrint("Error stopping image stream on dispose: $e");
    }
    _cameraController?.dispose();
    _faceDetector.close();
    super.dispose();
  }

  InputImageRotation _getRotation(CameraDescription camera) {
    final sensorOrientation = camera.sensorOrientation;
    if (Platform.isIOS) {
      return InputImageRotationValue.fromRawValue(sensorOrientation) ??
          InputImageRotation.rotation90deg;
    }

    int rotationCompensation = 0;
    if (_cameraController != null) {
      final deviceOrient = _cameraController!.value.deviceOrientation;
      if (deviceOrient == DeviceOrientation.portraitUp) {
        rotationCompensation = 0;
      } else if (deviceOrient == DeviceOrientation.landscapeLeft) {
        rotationCompensation = 90;
      } else if (deviceOrient == DeviceOrientation.portraitDown) {
        rotationCompensation = 180;
      } else if (deviceOrient == DeviceOrientation.landscapeRight) {
        rotationCompensation = 270;
      }
    }

    int rawRotation = sensorOrientation;
    if (camera.lensDirection == CameraLensDirection.front) {
      rawRotation = (sensorOrientation + rotationCompensation) % 360;
    } else {
      rawRotation = (sensorOrientation - rotationCompensation + 360) % 360;
    }

    return InputImageRotationValue.fromRawValue(rawRotation) ??
        InputImageRotation.rotation270deg;
  }

  Uint8List _convertYUV420toNV21(CameraImage image) {
    final width = image.width;
    final height = image.height;

    final yPlane = image.planes[0];
    final uPlane = image.planes[1];
    final vPlane = image.planes[2];

    final yBuffer = yPlane.bytes;
    final uBuffer = uPlane.bytes;
    final vBuffer = vPlane.bytes;

    final numPixels = (width * height * 1.5).toInt();
    final nv21 = Uint8List(numPixels);

    int idY = 0;
    int idUV = width * height;

    final uvWidth = width ~/ 2;
    final uvHeight = height ~/ 2;

    final uvRowStride = uPlane.bytesPerRow;
    final uvPixelStride = uPlane.bytesPerPixel ?? 1;
    final yRowStride = yPlane.bytesPerRow;
    final yPixelStride = yPlane.bytesPerPixel ?? 1;

    for (int y = 0; y < height; ++y) {
      final yOffset = y * yRowStride;
      for (int x = 0; x < width; ++x) {
        nv21[idY++] = yBuffer[yOffset + x * yPixelStride];
      }
    }

    for (int y = 0; y < uvHeight; ++y) {
      final uvOffset = y * uvRowStride;
      for (int x = 0; x < uvWidth; ++x) {
        final bufferIndex = uvOffset + (x * uvPixelStride);
        // NV21 is V-U interleaved
        nv21[idUV++] = vBuffer[bufferIndex];
        nv21[idUV++] = uBuffer[bufferIndex];
      }
    }
    return nv21;
  }

  InputImage? _convertCameraImageToInputImage(CameraImage image) {
    try {
      if (_cameraController == null) return null;
      final imageRotation = _getRotation(_cameraController!.description);

      final Size imageSize = Size(
        image.width.toDouble(),
        image.height.toDouble(),
      );
      final InputImageFormat inputImageFormat = Platform.isIOS
          ? InputImageFormat.bgra8888
          : InputImageFormat.nv21;

      final Uint8List bytes;
      if (Platform.isIOS) {
        bytes = image.planes[0].bytes;
      } else {
        bytes = _convertYUV420toNV21(image);
      }

      final metadata = InputImageMetadata(
        size: imageSize,
        rotation: imageRotation,
        format: inputImageFormat,
        bytesPerRow: image.planes[0].bytesPerRow,
      );

      return InputImage.fromBytes(bytes: bytes, metadata: metadata);
    } catch (e) {
      debugPrint("Error converting camera image: $e");
      return null;
    }
  }

  void _startImageStream() {
    if (_cameraController == null || !_isCameraInitialized) return;

    // Only start if not already streaming
    if (_cameraController!.value.isStreamingImages) return;

    _cameraController!.startImageStream((CameraImage image) async {
      final now = DateTime.now();
      if (_isProcessingImage ||
          now.difference(_lastDetectionAt) < _detectionInterval) {
        return;
      }
      _lastDetectionAt = now;
      _isProcessingImage = true;

      try {
        final inputImage = _convertCameraImageToInputImage(image);
        if (inputImage != null) {
          final List<Face> faces = await _faceDetector.processImage(inputImage);
          if (faces.isNotEmpty) {
            final Face face = faces.reduce(
              (a, b) =>
                  a.boundingBox.width * a.boundingBox.height >=
                      b.boundingBox.width * b.boundingBox.height
                  ? a
                  : b,
            );

            double? leftEye = face.leftEyeOpenProbability;
            double? rightEye = face.rightEyeOpenProbability;
            // Yaw sign is normalised to ONE convention here, at the single point it
            // enters the app: positive = the user's own left. Everything downstream
            // (the gauge and the Turn Left/Right checks) can then ignore the platform.
            //
            // It has to be normalised because the two platforms hand ML Kit different
            // images: Android sends a front-camera NV21 buffer through
            // rotationCompensation, iOS passes bgra8888 straight through. headEulerAngleY
            // is measured against the image, so that mirroring difference flips its sign
            // — which is why "Turn Left" only passed when an iPhone user turned RIGHT.
            double? rotY = face.headEulerAngleY; // Yaw (left/right)
            if (rotY != null &&
                Platform.isIOS &&
                _cameraController?.description.lensDirection ==
                    CameraLensDirection.front) {
              rotY = -rotY;
            }
            double? rotX = face.headEulerAngleX; // Pitch (up/down)
            final rotZ = face.headEulerAngleZ ?? 0.0;
            final imageArea = image.width * image.height;
            final faceArea = face.boundingBox.width * face.boundingBox.height;
            final largeEnough = faceArea >= imageArea * 0.075;
            final aligned = largeEnough && _isFrontal(face, rotY, rotX, rotZ);
            _frontalStreak = aligned ? _frontalStreak + 1 : 0;
            final ready = _frontalStreak >= _kFrontalFrames;
            final message = !largeEnough
                ? "Move a little closer"
                : ready
                ? "Face locked — ready to capture"
                : "Face detected — look straight ahead";
            final frameSize = Size(image.width.toDouble(), image.height.toDouble());
            final frameRotation = _getRotation(_cameraController!.description);
            final box = face.boundingBox;
            final last = _lastBox;
            final still = last != null && (box.center - last.center).distance < box.width * .04 && (box.width - last.width).abs() < box.width * .05;
            _steadyStreak = still ? _steadyStreak + 1 : 0;
            _lastBox = box;
            final steady = _steadyStreak >= 3;
            _targetFaceRect = box;

            // Guard: only rebuild if a value changed meaningfully.
            final newEye = (leftEye != null && rightEye != null)
                ? (leftEye + rightEye) / 2.0
                : _eyeOpenProbability;
            final newRotY = rotY ?? _headRotationAngle;
            final newRotX = rotX ?? _headRotationAnglePitch;
            final eyeChanged = (newEye - _eyeOpenProbability).abs() > 0.02;
            final rotYChanged = (newRotY - _headRotationAngle).abs() > 1.0;
            final rotXChanged = (newRotX - _headRotationAnglePitch).abs() > 1.0;
            if (mounted &&
                (!_faceDetected ||
                    ready != _captureReady ||
                    aligned != _frontalNow ||
                    steady != _steady ||
                    message != _trackingMessage ||
                    frameSize != _trackingImageSize ||
                    frameRotation != _trackingRotation ||
                    eyeChanged ||
                    rotYChanged ||
                    rotXChanged)) {
              setState(() {
                _trackingImageSize = frameSize;
                _trackingRotation = frameRotation;
                _faceDetected = true;
                _captureReady = ready;
                _frontalNow = aligned;
                _steady = steady;
                _trackingMessage = message;
                if (eyeChanged) _eyeOpenProbability = newEye;
                if (rotYChanged) _headRotationAngle = newRotY;
                if (rotXChanged) _headRotationAnglePitch = newRotX;
              });
            }

            if (_currentChallenge == "Blink") {
              if (leftEye != null &&
                  rightEye != null &&
                  leftEye < 0.3 &&
                  rightEye < 0.3) {
                _onChallengeSuccess();
              }
            } else if (_currentChallenge == "Turn Left") {
              // ML Kit yaw: positive = user's left on a front camera.
              if (rotY != null && rotY >= 20.0) {
                _onChallengeSuccess();
              }
            } else if (_currentChallenge == "Turn Right") {
              if (rotY != null && rotY <= -20.0) {
                _onChallengeSuccess();
              }
            } else if (_currentChallenge == "Nod") {
              if (rotX != null && rotX.abs() >= 12.0) {
                _onChallengeSuccess();
              }
            }
          } else if (mounted && _faceDetected) {
            setState(() {
              _faceDetected = false;
              _captureReady = false;
              _targetFaceRect = null;
              _frontalStreak = 0;
              _frontalNow = false;
              _lastBox = null;
              _steadyStreak = 0;
              _steady = false;
              _trackingMessage = "Move your face into view";
            });
          }
        }
      } catch (e) {
        debugPrint("Error processing image stream frame: $e");
      } finally {
        _isProcessingImage = false;
      }
    });
  }

  void _onChallengeSuccess() {
    if (!_isWaitingForGesture || _challengeSuccess) return;
    if (mounted) {
      setState(() {
        _challengeSuccess = true;
        _showSuccessPulse = true;
        _countdownTimer?.cancel();
      });
      // Clear the green pulse shortly after.
      Future.delayed(const Duration(milliseconds: 700), () {
        if (mounted) setState(() => _showSuccessPulse = false);
      });
    }
  }

  void _triggerBlinkSuccess() {
    if (!_isWaitingForGesture ||
        _currentChallenge != "Blink" ||
        _challengeSuccess) {
      return;
    }
    setState(() {
      _eyeOpenProbability = 0.02; // eyes closed/blinked
      _onChallengeSuccess();
    });
  }

  void _handlePanUpdate(DragUpdateDetails details) {
    if (!_isWaitingForGesture || _challengeSuccess) return;

    final dx = details.delta.dx;
    final dy = details.delta.dy;

    if (_currentChallenge == "Turn Left") {
      // Turn Left = Swiping left (dx < -3)
      if (dx < -3.0) {
        setState(() {
          _headRotationAngle = 35.0; // Left yaw (ML Kit positive)
          _onChallengeSuccess();
        });
      }
    } else if (_currentChallenge == "Turn Right") {
      // Turn Right = Swiping right (dx > 3)
      if (dx > 3.0) {
        setState(() {
          _headRotationAngle = -35.0; // Right yaw (ML Kit negative)
          _onChallengeSuccess();
        });
      }
    } else if (_currentChallenge == "Nod") {
      // Nod = Swiping up/down (dy.abs() > 3)
      if (dy.abs() > 3.0) {
        setState(() {
          _headRotationAnglePitch = 18.0; // Nod pitch
          _onChallengeSuccess();
        });
      }
    }
  }

  Future<void> startScanning() async {
    if (_preparingChallenge || isScanning) return;
    if (widget.sessionId != null) {
      setState(() { _preparingChallenge = true; scanningStatusText = 'Preparing secure scan...'; });
      try {
        final response = await http.post(
          Uri.parse('${widget.apiBaseUrl}/sessions/${Uri.encodeComponent(widget.sessionId!)}/checkin-challenge'),
          headers: {'Authorization': 'Bearer ${widget.authToken}'},
        ).timeout(const Duration(seconds: 12));
        final body = jsonDecode(response.body) as Map<String, dynamic>;
        if (response.statusCode != 200 || body['challenge_token'] is! String) {
          throw StateError(body['detail']?.toString() ?? 'Unable to prepare check-in. Please try again.');
        }
        _challengeToken = body['challenge_token'] as String;
      } catch (error) {
        if (!mounted) return;
        setState(() => scanningStatusText = 'Secure check-in unavailable. Please try again.');
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(tr(error is StateError ? error.message.toString() : 'Check your connection and try again.'))));
        return;
      } finally {
        if (mounted) setState(() => _preparingChallenge = false);
      }
      if (!mounted) return;
    }
    final random = math.Random();

    // Pick two DISTINCT challenges, and never repeat the previous pair
    // (order-insensitive) on consecutive attempts.
    List<String> pair;
    int guard = 0;
    do {
      final pool = List<String>.from(_challenges)..shuffle(random);
      pair = pool.take(_kChallengeCount).toList();
      guard++;
    } while (guard < 12 &&
        _lastPair != null &&
        _lastPair!.toSet().containsAll(pair.toSet()) &&
        pair.toSet().containsAll(_lastPair!.toSet()));
    _lastPair = pair;
    _selectedChallenges = pair;

    _completedTasksCount = 0;
    _currentChallenge = _selectedChallenges[0];
    _scanStartedAt = DateTime.now();

    _countdownTimer?.cancel();
    _progressTimer?.cancel();

    setState(() {
      isScanning = true;
      progress = 0.0;
      _challengeSuccess = false;
      _showSuccessPulse = false;
      _isWaitingForGesture = false;
      _countdownSeconds = _kPerChallengeSeconds;

      // Initial telemetry states
      _eyeOpenProbability = 0.95;
      _headRotationAngle = 0.0;
      _headRotationAnglePitch = 0.0;

      scanningStatusText = "Positioning face & analyzing contours...";
    });

    _startImageStream();

    // 200ms tick (5 rebuilds/s) is sufficient for smooth progress + telemetry.
    // The original 100ms (10/s) combined with expensive CustomPaint caused overheating.
    _progressTimer = Timer.periodic(const Duration(milliseconds: 200), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }

      setState(() {
        if (!_isWaitingForGesture && !_challengeSuccess) {
          // Increment progress
          progress += 0.05; // 5% per 200ms = same total scan time as before

          // Simulate some light random telemetry noise before the challenge
          if (_currentChallenge == "Blink") {
            _eyeOpenProbability =
                0.90 + (DateTime.now().millisecond % 10) * 0.008;
            _headRotationAngle = 0.0;
            _headRotationAnglePitch = 0.0;
          } else if (_currentChallenge == "Turn Left") {
            _eyeOpenProbability = 0.95;
            _headRotationAngle = -1.0 + (DateTime.now().millisecond % 5) * 0.4;
            _headRotationAnglePitch = 0.0;
          } else if (_currentChallenge == "Turn Right") {
            _eyeOpenProbability = 0.95;
            _headRotationAngle = 1.0 - (DateTime.now().millisecond % 5) * 0.4;
            _headRotationAnglePitch = 0.0;
          } else {
            _eyeOpenProbability = 0.95;
            _headRotationAngle = 0.0;
            _headRotationAnglePitch =
                -0.5 + (DateTime.now().millisecond % 5) * 0.2;
          }

          // Check for pause thresholds (two chained challenges):
          // Task 1: pause at 40%
          if (progress >= 0.40 && _completedTasksCount == 0) {
            progress = 0.40;
            _currentChallenge = _selectedChallenges[0];
            _isWaitingForGesture = true;
            _startCountdown();
          }
          // Task 2: pause at 75%
          else if (progress >= 0.75 && _completedTasksCount == 1) {
            progress = 0.75;
            _currentChallenge = _selectedChallenges[1];
            _isWaitingForGesture = true;
            _startCountdown();
          }
          // Final completion
          else if (progress >= 1.0) {
            progress = 1.0;
            timer.cancel();
            _finalizeScan();
          }
        } else if (_isWaitingForGesture && !_challengeSuccess) {
          // Paused, waiting for challenge. Update text and countdown
          final taskNum = _completedTasksCount + 1;
          final secsLeft = _countdownSeconds.ceil();
          if (_currentChallenge == "Blink") {
            scanningStatusText =
                tr('TASK {n}/{total}: Please BLINK! ({s}s)', {'n': taskNum, 'total': _kChallengeCount, 's': secsLeft});
            if (_eyeOpenProbability > 0.4) {
              _eyeOpenProbability =
                  0.90 + (DateTime.now().millisecond % 10) * 0.008;
            }
            _headRotationAngle = 0.0;
            _headRotationAnglePitch = 0.0;
          } else if (_currentChallenge == "Turn Left") {
            scanningStatusText =
                tr('TASK {n}/{total}: Turn head LEFT! ({s}s)', {'n': taskNum, 'total': _kChallengeCount, 's': secsLeft});
            _eyeOpenProbability = 0.95;
            if (_headRotationAngle > -10.0) {
              _headRotationAngle =
                  -1.0 + (DateTime.now().millisecond % 5) * 0.4;
            }
            _headRotationAnglePitch = 0.0;
          } else if (_currentChallenge == "Turn Right") {
            scanningStatusText =
                tr('TASK {n}/{total}: Turn head RIGHT! ({s}s)', {'n': taskNum, 'total': _kChallengeCount, 's': secsLeft});
            _eyeOpenProbability = 0.95;
            if (_headRotationAngle < 10.0) {
              _headRotationAngle = 1.0 - (DateTime.now().millisecond % 5) * 0.4;
            }
            _headRotationAnglePitch = 0.0;
          } else if (_currentChallenge == "Nod") {
            scanningStatusText =
                tr('TASK {n}/{total}: NOD your head! ({s}s)', {'n': taskNum, 'total': _kChallengeCount, 's': secsLeft});
            _eyeOpenProbability = 0.95;
            _headRotationAngle = 0.0;
            if (_headRotationAnglePitch.abs() < 5.0) {
              _headRotationAnglePitch =
                  -0.5 + (DateTime.now().millisecond % 5) * 0.2;
            }
          }
        } else if (_challengeSuccess) {
          // Gesture / face detection was successful, move past threshold
          _isWaitingForGesture = false;
          _challengeSuccess = false; // reset for next threshold
          _completedTasksCount++;

          if (_completedTasksCount < _selectedChallenges.length) {
            _currentChallenge = _selectedChallenges[_completedTasksCount];
          }

          progress += 0.05;
        }
      });
    });
  }

  void _startCountdown() {
    _countdownTimer?.cancel();
    setState(() {
      _countdownSeconds = _kPerChallengeSeconds;
    });
    // Tick every 100ms for a smooth countdown ring.
    _countdownTimer = Timer.periodic(const Duration(milliseconds: 100), (
      timer,
    ) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      if (_challengeSuccess) {
        timer.cancel();
        return;
      }
      setState(() {
        if (_countdownSeconds > 0) {
          _countdownSeconds -= 0.1;
          if (_countdownSeconds < 0) _countdownSeconds = 0;
        } else {
          timer.cancel();
          _handleLivenessTimeout();
        }
      });
    });
  }

  void _handleLivenessTimeout() {
    _progressTimer?.cancel();
    _countdownTimer?.cancel();
    try {
      if (_cameraController != null &&
          _cameraController!.value.isStreamingImages) {
        _cameraController!.stopImageStream();
      }
    } catch (e) {
      debugPrint("Error stopping image stream: $e");
    }
    setState(() {
      isScanning = false;
      progress = 0.5;
      scanningStatusText = "Liveness verification timed out! Challenge failed.";
    });
    Future.delayed(const Duration(milliseconds: 1500), () {
      if (mounted) {
        widget.onScanComplete(null, false);
        Navigator.pop(context);
      }
    });
  }

  Future<void> _finalizeScan() async {
    if (_isCameraInitialized &&
        _cameraController != null &&
        _cameraController!.value.isStreamingImages &&
        !_captureReady) {
      setState(() => scanningStatusText = "Look straight at the camera");
      final deadline = DateTime.now().add(const Duration(milliseconds: 2500));
      while (mounted && !_captureReady && DateTime.now().isBefore(deadline)) {
        await Future<void>.delayed(const Duration(milliseconds: 60));
      }
      if (!mounted) return;
    }
    setState(() {
      scanningStatusText = "Capturing Face...";
    });

    try {
      if (_cameraController != null &&
          _cameraController!.value.isStreamingImages) {
        await _cameraController!.stopImageStream();
      }
    } catch (e) {
      debugPrint("Error stopping image stream: $e");
    }

    String? capturedImageBase64;
    try {
      if (_isCameraInitialized && _cameraController != null) {
        final XFile photo = await _cameraController!.takePicture();
        final bytes = await photo.readAsBytes();
        capturedImageBase64 = base64Encode(bytes);
      }
    } catch (e) {
      debugPrint("Error capturing picture: $e");
    }

    final bool passed = _completedTasksCount >= _kChallengeCount;
    // Behavioral biometrics: total ms from "Detect Face" tap to all challenges done.
    final int? challengeMs = _scanStartedAt != null
        ? DateTime.now().difference(_scanStartedAt!).inMilliseconds
        : null;

    setState(() {
      scanningStatusText = passed
          ? "Liveness Verified Successfully!"
          : "Liveness Check Failed!";
    });

    Future.delayed(const Duration(milliseconds: 800), () {
      widget.onScanComplete(
        capturedImageBase64,
        passed,
        challengeMs: challengeMs,
        challengeToken: _challengeToken,
      );
      if (mounted) {
        Navigator.pop(context);
      }
    });
  }

  // Blink and Nod cues hang under the status chip; the turn arrows stay beside the face.
  bool get _cueUnderChip => _currentChallenge == "Blink" || _currentChallenge == "Nod";

  // Animated directional cue (arrow / icon) that nudges toward the gesture.
  Widget _buildDirectionArrow() {
    final (IconData icon, Alignment align, Offset move) = switch (_currentChallenge) {
      "Turn Left" => (Icons.arrow_back_rounded, const Alignment(-0.74, 0.0), const Offset(-12, 0)),
      "Turn Right" => (Icons.arrow_forward_rounded, const Alignment(0.74, 0.0), const Offset(12, 0)),
      // Blink and Nod sit just under the status chip on the live screen (see _cueUnderChip).
      "Nod" => (Icons.keyboard_double_arrow_down_rounded, const Alignment(0.0, -0.66), const Offset(0, 10)),
      _ => (Icons.visibility_rounded, const Alignment(0.0, -0.66), Offset.zero),
    };
    final blink = _currentChallenge == "Blink";
    // Reduced motion: the cue stays still (the clock keeps running, as the scan sweep already redraws every frame).
    final still = MediaQuery.disableAnimationsOf(context);
    // The web's primary button colour.
    const webBlue = Color(0xFF2563EB);
    return Align(
      alignment: align,
      child: AnimatedBuilder(
        animation: _cueController,
        builder: (context, child) {
          final v = still ? 0.0 : _cueController.value;
          if (blink) {
            // Eyes close and open once per cycle: a quick squash of the eye, like a real blink.
            final phase = ((v - .38) / .2).clamp(0.0, 1.0);
            final squash = 1 - .9 * math.sin(math.pi * phase);
            return Transform.scale(scaleX: 1, scaleY: squash, child: child);
          }
          // Arrows glide the way to move and fade, then start again.
          final t = Curves.easeInOut.transform(v);
          return Transform.translate(
            offset: move * t,
            child: Opacity(opacity: (1 - t * .55).clamp(0.0, 1.0), child: child),
          );
        },
        child: Container(
          width: 46,
          height: 46,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: webBlue,
            border: Border.all(color: Colors.white.withValues(alpha: .7), width: 1.4),
            boxShadow: [BoxShadow(color: webBlue.withValues(alpha: .45), blurRadius: 14, offset: const Offset(0, 4))],
          ),
          child: Icon(icon, color: Colors.white, size: blink ? 22 : 24),
        ),
      ),
    );
  }


  @override
  Widget build(BuildContext context) => _buildLensScreen(context);

  Widget _buildLensScreen(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final primary = isDark ? const Color(0xFF60A5FA) : const Color(0xFF2563EB);
    final primaryText = isDark ? Colors.white : const Color(0xFF0F172A);
    final secondaryText = isDark ? Colors.white60 : const Color(0xFF64748B);
    final panelColor = isDark ? const Color(0xFF181818) : Colors.white;
    final panelBorder = isDark ? Colors.white12 : const Color(0xFFE2E8F0);
    final chipTurned = !isScanning && _faceDetected && !_frontalNow;
    final chipRing = _captureReady
        ? const [Color(0xFF22C55E), Color(0xFFA3E635)]
        : chipTurned
        ? const [Color(0xFFEF4444), Color(0xFFF472B6)]
        : [panelBorder, panelBorder];
    final chipGlow = _captureReady
        ? const Color(0xFF22C55E).withValues(alpha: .35)
        : chipTurned
        ? const Color(0xFFEF4444).withValues(alpha: .3)
        : (isDark ? Colors.black26 : const Color(0xFF2563EB).withValues(alpha: .10));
    final chipIcon = _captureReady ? const Color(0xFF16A34A) : chipTurned ? const Color(0xFFEF4444) : primary;
    final bottomInset = MediaQuery.paddingOf(context).bottom;
    // The web's status colours: plenty of time green, 3-2 s yellow, 1-0 s red.
    final secondsLeft = _countdownSeconds.ceil();
    final countdownColor = secondsLeft >= 4
        ? const Color(0xFF10B981)
        : secondsLeft >= 2
        ? const Color(0xFFF59E0B)
        : const Color(0xFFEF4444);
    final statusText = isScanning ? scanningStatusText : _trackingMessage;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: isDark ? Brightness.light : Brightness.dark,
        statusBarBrightness: isDark ? Brightness.dark : Brightness.light,
        systemNavigationBarColor: isDark
            ? Colors.black
            : const Color(0xFFF8FAFC),
        systemNavigationBarIconBrightness: isDark
            ? Brightness.light
            : Brightness.dark,
      ),
      child: Scaffold(
        backgroundColor: isDark ? Colors.black : const Color(0xFFF8FAFC),
        body: Stack(
          fit: StackFit.expand,
          children: [
            if (_isCameraInitialized && _cameraController != null)
              FittedBox(
                fit: BoxFit.cover,
                child: SizedBox(
                  width: 100,
                  height: _cameraController!.value.aspectRatio > 1
                      ? 100 * _cameraController!.value.aspectRatio
                      : 100 / _cameraController!.value.aspectRatio,
                  child: CameraPreview(_cameraController!),
                ),
              )
            else
              Container(
                color: const Color(0xFF050505),
                child: Center(
                  child: _cameraError == null
                      ? const CircularProgressIndicator(color: Colors.white)
                      : const Icon(
                          Icons.videocam_off_rounded,
                          color: Colors.white38,
                          size: 54,
                        ),
                ),
              ),

            DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: isDark
                      ? const [
                          Color(0xCC000000),
                          Color(0x22000000),
                          Color(0x11000000),
                          Color(0xE6000000),
                        ]
                      : const [
                          Color(0xE6F8FAFC),
                          Color(0x66F8FAFC),
                          Color(0x00F8FAFC),
                          Color(0x55F8FAFC),
                          Color(0xF2F8FAFC),
                        ],
                  stops: isDark
                      ? const [0, .2, .56, 1]
                      : const [0, .16, .38, .64, 1],
                ),
              ),
            ),

            // Always drawn: with no face yet it idles in the middle with the scan wave.
            RepaintBoundary(
                child: CustomPaint(
                  painter: FaceTargetPainter(
                    face: _shownFace,
                    imageSize: _trackingImageSize ?? const Size(480, 640),
                    rotation: _trackingRotation,
                    lensDirection:
                        _cameraController?.description.lensDirection ??
                        CameraLensDirection.front,
                    ready: _captureReady,
                    // During the challenges the head is meant to turn, so a tracked face stays green there.
                    state: !_faceDetected
                        ? FaceFrameState.searching
                        : (isScanning && scanningStatusText != "Look straight at the camera") || _frontalNow
                        ? FaceFrameState.frontal
                        : FaceFrameState.turned,
                    animation: _scannerAnimController,
                  ),
                ),
              ),

            if (isScanning && _isWaitingForGesture && !_showSuccessPulse && !_cueUnderChip)
              _buildDirectionArrow(),

            SafeArea(
              bottom: false,
              child: Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                    child: Row(
                      children: [
                        IconButton(
                          onPressed: () => Navigator.pop(context),
                          icon: Icon(
                            Icons.arrow_back_rounded,
                            color: primaryText,
                          ),
                          style: IconButton.styleFrom(
                            backgroundColor: isDark
                                ? Colors.black.withValues(alpha: .38)
                                : Colors.white.withValues(alpha: .9),
                            side: BorderSide(
                              color: isDark
                                  ? Colors.white12
                                  : const Color(0xFFE2E8F0),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                tr(widget.title),
                                style: GoogleFonts.spaceGrotesk(
                                  color: primaryText,
                                  fontSize: 17,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              Text(
                                tr('Live face tracking'),
                                style: GoogleFonts.inter(
                                  color: secondaryText,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 7,
                          ),
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(colors: [Color(0xFFDC2626), Color(0xFFF87171)]),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: Colors.white.withValues(alpha: .55)),
                            boxShadow: [
                              BoxShadow(color: const Color(0xFFEF4444).withValues(alpha: .45), blurRadius: 14, offset: const Offset(0, 4)),
                              BoxShadow(color: Colors.white.withValues(alpha: isDark ? .08 : .5), blurRadius: 6, spreadRadius: -1),
                            ],
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              AnimatedBuilder(
                                animation: _scannerAnimController,
                                builder: (context, _) => Container(
                                  width: 7,
                                  height: 7,
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    shape: BoxShape.circle,
                                    boxShadow: [BoxShadow(color: Colors.white.withValues(alpha: .4 + .5 * _scannerAnimController.value), blurRadius: 6, spreadRadius: 1)],
                                  ),
                                ),
                              ),
                              const SizedBox(width: 6),
                              Text(
                                tr('LIVE'),
                                style: GoogleFonts.inter(
                                  color: Colors.white,
                                  fontSize: 9,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: .7,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  Container(
                    margin: const EdgeInsets.symmetric(horizontal: 20),
                    padding: const EdgeInsets.all(1.6),
                    // A gradient ring around the chip: green/lime once locked, red/pink while the face is turned.
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(30),
                      gradient: LinearGradient(colors: chipRing),
                      boxShadow: [
                        BoxShadow(
                          color: chipGlow,
                          blurRadius: 18,
                          offset: const Offset(0, 6),
                        ),
                      ],
                    ),
                    child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 9,
                    ),
                    decoration: BoxDecoration(
                      color: isDark ? const Color(0xF0141414) : Colors.white,
                      borderRadius: BorderRadius.circular(29),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          _captureReady
                              ? Icons.check_circle_rounded
                              : chipTurned
                              ? Icons.error_rounded
                              : _faceDetected
                              ? Icons.face_retouching_natural_rounded
                              : Icons.center_focus_strong_rounded,
                          color: chipIcon,
                          size: 18,
                        ),
                        const SizedBox(width: 8),
                        Flexible(
                          child: Text(
                            tr(statusText),
                            maxLines: 2,
                            textAlign: TextAlign.center,
                            style: GoogleFonts.inter(
                              color: primaryText,
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  ),
                  if (isScanning && _isWaitingForGesture && !_showSuccessPulse && _cueUnderChip)
                    Padding(padding: const EdgeInsets.only(top: 12), child: _buildDirectionArrow()),
                  const Spacer(),
                  if (isScanning)
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 22),
                      child: Column(
                        children: [
                          if (_isWaitingForGesture)
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 7,
                              ),
                              decoration: BoxDecoration(
                                color: isDark
                                    ? Colors.black.withValues(alpha: .66)
                                    : Colors.white.withValues(alpha: .94),
                                borderRadius: BorderRadius.circular(30),
                                border: Border.all(color: countdownColor.withValues(alpha: .5)),
                                boxShadow: [BoxShadow(color: countdownColor.withValues(alpha: .2), blurRadius: 10, offset: const Offset(0, 4))],
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: Stack(alignment: Alignment.center, children: [
                                      CircularProgressIndicator(
                                        value: (_countdownSeconds / _kPerChallengeSeconds).clamp(0.0, 1.0),
                                        strokeWidth: 2.4,
                                        backgroundColor: isDark ? Colors.white12 : const Color(0xFFE2E8F0),
                                        color: countdownColor,
                                      ),
                                      Text('${_countdownSeconds.ceil()}',
                                          style: GoogleFonts.inter(color: countdownColor, fontWeight: FontWeight.w800, fontSize: 9)),
                                    ]),
                                  ),
                                  const SizedBox(width: 8),
                                  Text(
                                    tr(_currentChallenge),
                                    style: GoogleFonts.inter(
                                      color: primaryText,
                                      fontWeight: FontWeight.w800,
                                      fontSize: 11.5,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          const SizedBox(height: 12),
                          Text(
                            '${(progress.clamp(0.0, 1.0) * 100).round()}%',
                            style: GoogleFonts.inter(
                              fontSize: 10.5,
                              fontWeight: FontWeight.w800,
                              color: isDark ? const Color(0xFF6EE7B7) : const Color(0xFF047857),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Semantics(
                            label: tr('{v}% Analysed', {'v': (progress * 100).round()}),
                            child: Container(
                              height: 6,
                              decoration: BoxDecoration(
                                color: isDark ? Colors.white24 : const Color(0xFFD1FAE5),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              alignment: AlignmentDirectional.centerStart,
                              child: FractionallySizedBox(
                                widthFactor: progress.clamp(0.0, 1.0),
                                child: Container(
                                  decoration: BoxDecoration(
                                    gradient: const LinearGradient(colors: [Color(0xFF10B981), Color(0xFF34D399)]),
                                    borderRadius: BorderRadius.circular(8),
                                    boxShadow: [BoxShadow(color: const Color(0xFF10B981).withValues(alpha: .45), blurRadius: 8)],
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  Container(
                    width: double.infinity,
                    margin: const EdgeInsets.only(top: 18),
                    padding: EdgeInsets.fromLTRB(18, 10, 18, 16 + bottomInset),
                    decoration: BoxDecoration(
                      color: panelColor,
                      borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
                      border: Border(top: BorderSide(color: panelBorder)),
                      boxShadow: [
                        BoxShadow(
                          color: isDark
                              ? Colors.black54
                              : const Color(0xFF1E3A8A).withValues(alpha: .12),
                          blurRadius: 28,
                          offset: const Offset(0, -6),
                        ),
                      ],
                    ),
                    child: Column(
                      children: [
                        Container(
                          width: 40,
                          height: 4,
                          margin: const EdgeInsets.only(bottom: 14),
                          decoration: BoxDecoration(
                            color: isDark ? Colors.white24 : const Color(0xFFCBD5E1),
                            borderRadius: BorderRadius.circular(4),
                          ),
                        ),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            // A face the detector can read means the light is good enough.
                            _lensHint(Icons.light_mode_outlined, 'Even light', _faceDetected, isDark: isDark),
                            const SizedBox(width: 18),
                            _lensHint(Icons.face_rounded, _captureReady ? 'Face locked' : 'Look forward', _captureReady, isDark: isDark),
                            const SizedBox(width: 18),
                            _lensHint(Icons.phone_android_rounded, 'Hold steady', _faceDetected && _steady, isDark: isDark),
                          ],
                        ),
                        const SizedBox(height: 14),
                        if (_cameraError != null) ...[
                          Text(
                            tr(_cameraError!),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            textAlign: TextAlign.center,
                            style: GoogleFonts.inter(
                              color: const Color(0xFFFCA5A5),
                              fontSize: 10,
                            ),
                          ),
                          const SizedBox(height: 10),
                        ],
                        Container(
                          width: double.infinity,
                          height: 54,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(18),
                            // The web's primary button: solid #2563eb.
                            color: !isScanning && (_captureReady || _cameraError != null) ? const Color(0xFF2563EB) : null,
                            boxShadow: !isScanning && _captureReady
                                ? [BoxShadow(color: const Color(0xFF2563EB).withValues(alpha: .35), blurRadius: 18, offset: const Offset(0, 7))]
                                : null,
                          ),
                          child: FilledButton.icon(
                            onPressed: isScanning
                                ? null
                                : (_captureReady || _cameraError != null)
                                ? startScanning
                                : null,
                            icon: Icon(
                              isScanning
                                  ? Icons.hourglass_top_rounded
                                  : Icons.center_focus_strong_rounded,
                            ),
                            label: Text(
                              tr(isScanning
                                  ? 'Verifying liveness...'
                                  : _captureReady
                                  ? 'Start secure capture'
                                  : 'Align your face to continue'),
                            ),
                            style: FilledButton.styleFrom(
                              backgroundColor: Colors.transparent,
                              shadowColor: Colors.transparent,
                              foregroundColor: Colors.white,
                              disabledBackgroundColor: isDark
                                  ? Colors.white12
                                  : const Color(0xFFE2E8F0),
                              disabledForegroundColor: isDark
                                  ? Colors.white38
                                  : const Color(0xFF94A3B8),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(18),
                              ),
                              textStyle: GoogleFonts.inter(
                                fontSize: 13.5,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// One requirement under the camera: green with a tick once it is met, grey until then.
  Widget _lensHint(
    IconData icon,
    String label,
    bool met, {
    required bool isDark,
  }) {
    final verified = met;
    final color = met
        ? (isDark ? const Color(0xFF4ADE80) : const Color(0xFF16A34A))
        : (isDark ? Colors.white54 : const Color(0xFF94A3B8));
    return Expanded(
      child: Column(
        children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 220),
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: color.withValues(alpha: isDark ? .16 : .1),
              border: Border.all(color: color.withValues(alpha: verified ? .7 : .25), width: verified ? 1.5 : 1),
            ),
            child: Icon(verified ? Icons.check_rounded : icon, size: 18, color: color),
          ),
          const SizedBox(height: 6),
          Text(
            tr(label),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: GoogleFonts.inter(
              color: color,
              fontSize: 10.5,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  // Retained temporarily as a fallback layout while the live lens UI is exercised
  // across devices with different camera aspect ratios.
  // ignore: unused_element
  Widget _buildLegacyScanner(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;
    final screenHeight = MediaQuery.of(context).size.height;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          tr(widget.title),
          style: GoogleFonts.spaceGrotesk(
            fontSize: 16,
            fontWeight: FontWeight.bold,
          ),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
      ),
      body: Stack(
        children: [
          const AuroraBackground(),

          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  GlassCard(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 10,
                    ),
                    color: _cameraError != null
                        ? Colors.red.withValues(alpha: 0.05)
                        : Colors.white.withValues(alpha: 0.8),
                    borderColor: _cameraError != null
                        ? Colors.red.withValues(alpha: 0.2)
                        : Colors.white.withValues(alpha: 0.2),
                    child: Row(
                      children: [
                        Icon(
                          _cameraError != null
                              ? Icons.error_outline
                              : Icons.info_outline,
                          color: _cameraError != null
                              ? const Color(0xFFDC2626)
                              : const Color(0xFF2563EB),
                          size: 16,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            _cameraError != null
                                ? tr('Camera Connection Issue: {error}\nMake sure to stop the app and run a clean rebuild (flutter clean & flutter run) to link native packages.', {'error': _cameraError})
                                : tr("Hold camera steady and look directly at the center oval."),
                            style: GoogleFonts.inter(
                              fontSize: 10.5,
                              fontWeight: FontWeight.w500,
                              color: _cameraError != null
                                  ? const Color(0xFF991B1B)
                                  : const Color(0xFF475569),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),

                  Expanded(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(24),
                      child: Container(
                        color: Colors.black.withValues(alpha: 0.95),
                        child: GestureDetector(
                          behavior: HitTestBehavior.opaque,
                          onTap: () {
                            if (_isWaitingForGesture &&
                                _currentChallenge == "Blink") {
                              _triggerBlinkSuccess();
                            }
                          },
                          onPanUpdate: _handlePanUpdate,
                          child: Stack(
                            alignment: Alignment.center,
                            children: [
                              // 1. Bottom Layer: Live Camera Preview
                              if (_isCameraInitialized &&
                                  _cameraController != null)
                                Positioned.fill(
                                  child: FittedBox(
                                    fit: BoxFit.cover,
                                    child: SizedBox(
                                      width: 100,
                                      height:
                                          _cameraController!.value.aspectRatio >
                                              1.0
                                          ? 100 *
                                                _cameraController!
                                                    .value
                                                    .aspectRatio
                                          : 100 /
                                                _cameraController!
                                                    .value
                                                    .aspectRatio,
                                      child: CameraPreview(_cameraController!),
                                    ),
                                  ),
                                )
                              else if (_cameraError != null)
                                // High-tech Simulated View for Mock Emulators and failed camera bindings
                                Positioned.fill(
                                  child: Container(
                                    color: const Color(0xFF0F172A), // Slate 900
                                    child: Stack(
                                      alignment: Alignment.center,
                                      children: [
                                        // Technical grid overlay lines
                                        Positioned.fill(
                                          child: GridPaper(
                                            color: const Color(
                                              0xFF10B981,
                                            ).withValues(alpha: 0.05),
                                            interval: 30.0,
                                            divisions: 1,
                                            subdivisions: 1,
                                          ),
                                        ),
                                        // Glowing vector face symbol
                                        Opacity(
                                          opacity: isScanning ? 0.6 : 0.25,
                                          child: Icon(
                                            Icons.face_unlock_outlined,
                                            size: 80,
                                            color: isScanning
                                                ? const Color(0xFF10B981)
                                                : const Color(0xFF3B82F6),
                                          ),
                                        ),
                                        // Top warning status text
                                        Positioned(
                                          top: 20,
                                          child: Container(
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 10,
                                              vertical: 4,
                                            ),
                                            decoration: BoxDecoration(
                                              color: Colors.amber.withValues(
                                                alpha: 0.12,
                                              ),
                                              borderRadius:
                                                  BorderRadius.circular(20),
                                              border: Border.all(
                                                color: Colors.amber.withValues(
                                                  alpha: 0.3,
                                                ),
                                                width: 1,
                                              ),
                                            ),
                                            child: Text(
                                              tr('CAMERA SIMULATION ACTIVE'),
                                              style: GoogleFonts.spaceGrotesk(
                                                fontSize: 7.5,
                                                fontWeight: FontWeight.bold,
                                                color: Colors.amber[600],
                                                letterSpacing: 0.5,
                                              ),
                                            ),
                                          ),
                                        ),
                                        // Display brief error code at the bottom
                                        Positioned(
                                          bottom: 20,
                                          left: 16,
                                          right: 16,
                                          child: Text(
                                            tr('Camera Interface Warning: Clean rebuild is required to link CameraX native packages.'),
                                            style: TextStyle(
                                              color: Colors.white.withValues(
                                                alpha: 0.3,
                                              ),
                                              fontSize: 7.5,
                                              fontWeight: FontWeight.w500,
                                            ),
                                            textAlign: TextAlign.center,
                                            maxLines: 2,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                )
                              else
                                const Center(
                                  child: CircularProgressIndicator(
                                    color: Color(0xFF10B981),
                                  ),
                                ),

                              // 2. Middle Layer: Sliding Scanner Line (only if scanning)
                              if (isScanning)
                                AnimatedBuilder(
                                  animation: _scannerAnimController,
                                  builder: (context, child) {
                                    final ovalHeight = screenHeight * 0.32;
                                    final translationOffset =
                                        (ovalHeight *
                                            _scannerAnimController.value) -
                                        (ovalHeight / 2);
                                    return Transform.translate(
                                      offset: Offset(0, translationOffset),
                                      child: Container(
                                        width: screenWidth * 0.48,
                                        height: 2.0,
                                        decoration: BoxDecoration(
                                          color: const Color(0xFF10B981),
                                          boxShadow: [
                                            BoxShadow(
                                              color: const Color(
                                                0xFF10B981,
                                              ).withValues(alpha: 0.8),
                                              blurRadius: 10,
                                              spreadRadius: 2.0,
                                            ),
                                          ],
                                        ),
                                      ),
                                    );
                                  },
                                ),

                              // Face Mesh Overlay (only if scanning)
                              if (isScanning)
                                Positioned.fill(
                                  child: RepaintBoundary(
                                    child: CustomPaint(
                                      painter: FaceMeshPainter(
                                        progress: progress,
                                        challenge: _currentChallenge,
                                        animationValue:
                                            _scannerAnimController.value,
                                        eyeOpenProbability: _eyeOpenProbability,
                                        headRotationAngle: _headRotationAngle,
                                        headRotationAnglePitch:
                                            _headRotationAnglePitch,
                                      ),
                                    ),
                                  ),
                                ),

                              // 3. Top Layer: Custom black mask overlay with transparent oval cutout
                              Positioned.fill(
                                child: CustomPaint(
                                  painter: OvalCutoutPainter(
                                    screenWidth: screenWidth,
                                    screenHeight: screenHeight,
                                    overlayColor: Colors
                                        .black, // Opaque black mask outside the oval
                                    borderSide: BorderSide(
                                      color: isScanning
                                          ? const Color(
                                              0xFF10B981,
                                            ).withValues(alpha: 0.8)
                                          : Colors.white.withValues(
                                              alpha: 0.35,
                                            ),
                                      width: 2.0,
                                    ),
                                  ),
                                ),
                              ),

                              // 3b. Countdown ring + success pulse around the oval guide
                              if (isScanning &&
                                  (_isWaitingForGesture || _showSuccessPulse))
                                Positioned.fill(
                                  child: RepaintBoundary(
                                    child: CustomPaint(
                                      painter: OvalCountdownPainter(
                                        screenWidth: screenWidth,
                                        screenHeight: screenHeight,
                                        fraction: _isWaitingForGesture
                                            ? (_countdownSeconds /
                                                      _kPerChallengeSeconds)
                                                  .clamp(0.0, 1.0)
                                            : 1.0,
                                        success: _showSuccessPulse,
                                      ),
                                    ),
                                  ),
                                ),

                              // 3c. Animated directional arrow cue for the current challenge
                              if (isScanning &&
                                  _isWaitingForGesture &&
                                  !_showSuccessPulse)
                                _buildDirectionArrow(),

                              // 4. Fallback Shutter Info (only if camera not initialized and no error yet)
                              if (!_isCameraInitialized && _cameraError == null)
                                Positioned.fill(
                                  child: Container(
                                    color: Colors.black.withValues(alpha: 0.85),
                                    child: Column(
                                      mainAxisAlignment:
                                          MainAxisAlignment.center,
                                      children: [
                                        Icon(
                                          Icons.camera_alt,
                                          size: 36,
                                          color: Colors.white.withValues(
                                            alpha: 0.08,
                                          ),
                                        ),
                                        const SizedBox(height: 6),
                                        Text(
                                          tr('CAMERA INITIALIZING...'),
                                          style: TextStyle(
                                            color: Colors.white.withValues(
                                              alpha: 0.08,
                                            ),
                                            fontSize: 10,
                                            fontWeight: FontWeight.bold,
                                            letterSpacing: 1.0,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),

                              // 5. Simulator HUD Helper Cue Pill overlay (only if scanning and waiting for challenge)
                              if (isScanning && _isWaitingForGesture)
                                Positioned(
                                  bottom: 20,
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 14,
                                      vertical: 8,
                                    ),
                                    decoration: BoxDecoration(
                                      color: const Color(
                                        0xFF0F172A,
                                      ).withValues(alpha: 0.95), // Slate 900
                                      borderRadius: BorderRadius.circular(20),
                                      border: Border.all(
                                        color: const Color(
                                          0xFF3B82F6,
                                        ).withValues(alpha: 0.4),
                                        width: 1,
                                      ),
                                      boxShadow: [
                                        BoxShadow(
                                          color: Colors.black.withValues(
                                            alpha: 0.4,
                                          ),
                                          blurRadius: 8,
                                          offset: const Offset(0, 4),
                                        ),
                                      ],
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        const Icon(
                                          Icons.help_outline,
                                          color: Color(0xFF60A5FA),
                                          size: 14,
                                        ),
                                        const SizedBox(width: 8),
                                        Text(
                                          tr(_currentChallenge == "Blink"
                                              ? "SIMULATOR HUD: TAP SCREEN TO BLINK"
                                              : _currentChallenge == "Turn Left"
                                              ? "SIMULATOR HUD: SWIPE LEFT TO TURN LEFT"
                                              : _currentChallenge ==
                                                    "Turn Right"
                                              ? "SIMULATOR HUD: SWIPE RIGHT TO TURN RIGHT"
                                              : "SIMULATOR HUD: SWIPE UP/DOWN TO NOD"),
                                          style: GoogleFonts.spaceGrotesk(
                                            fontSize: 9.5,
                                            fontWeight: FontWeight.bold,
                                            color: const Color(0xFFEFF6FF),
                                            letterSpacing: 0.5,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),

                  GlassCard(
                    child: Column(
                      children: [
                        Text(
                          tr(scanningStatusText),
                          textAlign: TextAlign.center,
                          style: GoogleFonts.inter(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: isScanning
                                ? const Color(0xFF1E293B)
                                : const Color(0xFF64748B),
                          ),
                        ),
                        if (isScanning) ...[
                          const SizedBox(height: 12),
                          // High-tech Gesture Telemetry Tracker Panel
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 8,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF8FAFC),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: const Color(0xFFE2E8F0),
                              ),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                      tr('Active Telemetry:'),
                                      style: GoogleFonts.spaceGrotesk(
                                        fontSize: 9.5,
                                        fontWeight: FontWeight.bold,
                                        color: const Color(0xFF475569),
                                        letterSpacing: 0.5,
                                      ),
                                    ),
                                    Text(
                                      tr(_challengeSuccess
                                          ? "CHALLENGE PASSED ✅"
                                          : "AWAITING ACTION..."),
                                      style: GoogleFonts.inter(
                                        fontSize: 9.0,
                                        fontWeight: FontWeight.bold,
                                        color: _challengeSuccess
                                            ? const Color(0xFF10B981)
                                            : const Color(0xFFF59E0B),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                if (_currentChallenge == "Blink") ...[
                                  Row(
                                    mainAxisAlignment:
                                        MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        tr('Eye Open Probability'),
                                        style: GoogleFonts.inter(
                                          fontSize: 10,
                                          color: const Color(0xFF64748B),
                                        ),
                                      ),
                                      Text(
                                        tr(_eyeOpenProbability.toStringAsFixed(2)),
                                        style: GoogleFonts.spaceGrotesk(
                                          fontSize: 11,
                                          fontWeight: FontWeight.bold,
                                          color: _eyeOpenProbability < 0.2
                                              ? const Color(0xFF10B981)
                                              : const Color(0xFF2563EB),
                                        ),
                                      ),
                                    ],
                                  ),
                                ] else if (_currentChallenge ==
                                    "Turn Left") ...[
                                  Row(
                                    mainAxisAlignment:
                                        MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        tr('Head Yaw Angle'),
                                        style: GoogleFonts.inter(
                                          fontSize: 10,
                                          color: const Color(0xFF64748B),
                                        ),
                                      ),
                                      Text(
                                        "${_headRotationAngle.toStringAsFixed(1)}°",
                                        style: GoogleFonts.spaceGrotesk(
                                          fontSize: 11,
                                          fontWeight: FontWeight.bold,
                                          color: _headRotationAngle >= 20.0
                                              ? const Color(0xFF10B981)
                                              : const Color(0xFF2563EB),
                                        ),
                                      ),
                                    ],
                                  ),
                                ] else if (_currentChallenge ==
                                    "Turn Right") ...[
                                  Row(
                                    mainAxisAlignment:
                                        MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        tr('Head Yaw Angle'),
                                        style: GoogleFonts.inter(
                                          fontSize: 10,
                                          color: const Color(0xFF64748B),
                                        ),
                                      ),
                                      Text(
                                        "${_headRotationAngle.toStringAsFixed(1)}°",
                                        style: GoogleFonts.spaceGrotesk(
                                          fontSize: 11,
                                          fontWeight: FontWeight.bold,
                                          color: _headRotationAngle <= -20.0
                                              ? const Color(0xFF10B981)
                                              : const Color(0xFF2563EB),
                                        ),
                                      ),
                                    ],
                                  ),
                                ] else if (_currentChallenge == "Nod") ...[
                                  Row(
                                    mainAxisAlignment:
                                        MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        tr('Head Pitch Angle'),
                                        style: GoogleFonts.inter(
                                          fontSize: 10,
                                          color: const Color(0xFF64748B),
                                        ),
                                      ),
                                      Text(
                                        "${_headRotationAngle.toStringAsFixed(1)}°",
                                        style: GoogleFonts.spaceGrotesk(
                                          fontSize: 11,
                                          fontWeight: FontWeight.bold,
                                          color: _headRotationAngle >= 15.0
                                              ? const Color(0xFF10B981)
                                              : const Color(0xFF2563EB),
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ],
                            ),
                          ),
                          const SizedBox(height: 12),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(10),
                            child: LinearProgressIndicator(
                              value: progress,
                              backgroundColor: const Color(0xFFE2E8F0),
                              color: const Color(0xFF2563EB),
                              minHeight: 6,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Align(
                            alignment: Alignment.centerRight,
                            child: Text(
                              tr('{v}% Analysed', {'v': (progress * 100).toInt()}),
                              style: const TextStyle(
                                fontSize: 9,
                                color: Color(0xFF64748B),
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  if (_cameraError != null && !_isCameraInitialized) ...[
                    ElevatedButton.icon(
                      onPressed: isScanning
                          ? null
                          : () {
                              setState(() {
                                _cameraError = null;
                              });
                              _initializeCamera();
                            },
                      icon: const Icon(Icons.refresh),
                      label: Text(tr('Retry Camera Initialization')),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF2563EB),
                        foregroundColor: Colors.white,
                        elevation: isScanning ? 0 : 3,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        textStyle: GoogleFonts.inter(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                  ],

                  ElevatedButton.icon(
                    onPressed: isScanning ? null : startScanning,
                    icon: const Icon(Icons.face_unlock_sharp),
                    label: Text(
                      tr(isScanning
                          ? "Processing Scan..."
                          : (_cameraError != null
                                ? "Detect Face (Simulation Mode)"
                                : "Detect Face")),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _cameraError != null
                          ? const Color(0xFF64748B)
                          : const Color(0xFF10B981),
                      foregroundColor: Colors.white,
                      disabledBackgroundColor:
                          (_cameraError != null
                                  ? const Color(0xFF64748B)
                                  : const Color(0xFF10B981))
                              .withValues(alpha: 0.5),
                      disabledForegroundColor: Colors.white.withValues(
                        alpha: 0.8,
                      ),
                      elevation: isScanning ? 0 : 3,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      textStyle: GoogleFonts.inter(
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// What the face frame shows: no face yet (grey/white, idling in the middle), a frontal face (green/lime),
/// or a face that is turned or too far (red/pink).
enum FaceFrameState { searching, frontal, turned }

class FaceTargetPainter extends CustomPainter {
  /// The smoothed face box in camera-image coordinates (null while no face is seen). Repaints on its own every frame.
  final ValueListenable<Rect?> face;
  final Size imageSize;
  final InputImageRotation rotation;
  final CameraLensDirection lensDirection;
  final bool ready;
  final FaceFrameState state;
  final Animation<double> animation;

  FaceTargetPainter({
    required this.face,
    this.state = FaceFrameState.searching,
    required this.imageSize,
    required this.rotation,
    required this.lensDirection,
    required this.ready,
    required this.animation,
  }) : super(repaint: Listenable.merge([animation, face]));

  Rect _displayRect(Rect raw, Size canvasSize) {
    // ML Kit returns the box in its display coordinate space. Rotation selects
    // that space's dimensions and X direction; rotating every point again shifts
    // a portrait face box down to the neck. After translating, apply the same
    // BoxFit.cover scale and center crop as the full-screen CameraPreview.
    final quarterTurn =
        rotation == InputImageRotation.rotation90deg ||
        rotation == InputImageRotation.rotation270deg;
    final sourceSize = quarterTurn && !Platform.isIOS
        ? Size(imageSize.height, imageSize.width)
        : imageSize;

    double translatedX(double x) {
      return switch (rotation) {
        InputImageRotation.rotation90deg => x,
        InputImageRotation.rotation270deg => sourceSize.width - x,
        _ =>
          lensDirection == CameraLensDirection.back ? x : sourceSize.width - x,
      };
    }

    final x1 = translatedX(raw.left);
    final x2 = translatedX(raw.right);
    final left = math.min(x1, x2);
    final right = math.max(x1, x2);
    final top = raw.top;
    final bottom = raw.bottom;

    final scale = math.max(
      canvasSize.width / sourceSize.width,
      canvasSize.height / sourceSize.height,
    );
    final dx = (canvasSize.width - sourceSize.width * scale) / 2;
    final dy = (canvasSize.height - sourceSize.height * scale) / 2;
    return Rect.fromLTRB(
      left * scale + dx,
      top * scale + dy,
      right * scale + dx,
      bottom * scale + dy,
    );
  }

  @override
  void paint(Canvas canvas, Size size) {
    final raw = face.value;
    final mapped = raw == null ? null : _displayRect(raw, size);
    final target = mapped == null
        ? Rect.fromCenter(
            center: Offset(size.width / 2, size.height * .43),
            width: size.width * .54,
            height: size.width * .7,
          )
        : Rect.fromLTRB(
            mapped.left - mapped.width * .07,
            mapped.top - mapped.height * .10,
            mapped.right + mapped.width * .07,
            mapped.bottom + mapped.height * .06,
          );
    final safeTarget = Rect.fromLTRB(
      target.left.clamp(16, size.width - 80),
      target.top.clamp(90, size.height - 160),
      target.right.clamp(80, size.width - 16),
      target.bottom.clamp(160, size.height - 120),
    );
    // No face: grey/white idling in the middle. Frontal: green/lime. Turned or too far: red/pink.
    final shown = raw == null ? FaceFrameState.searching : state;
    final colors = switch (shown) {
      FaceFrameState.frontal => const [Color(0xFF22C55E), Color(0xFFA3E635), Color(0xFF4ADE80)],
      FaceFrameState.turned => const [Color(0xFFEF4444), Color(0xFFF472B6), Color(0xFFFB7185)],
      FaceFrameState.searching => const [Color(0xFFFFFFFF), Color(0xFFCBD5E1), Color(0xFFFFFFFF)],
    };
    final accent = colors[0];
    final shader = LinearGradient(colors: colors, begin: Alignment.topLeft, end: Alignment.bottomRight).createShader(safeTarget);
    final glow = Paint()
      ..color = accent.withValues(alpha: shown == FaceFrameState.searching ? .22 : (ready ? .4 : .3))
      ..style = PaintingStyle.stroke
      ..strokeWidth = ready ? 10 : 8
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 12);
    final line = Paint()
      ..shader = shader
      ..style = PaintingStyle.stroke
      ..strokeWidth = ready ? 3.4 : 2.6
      ..strokeCap = StrokeCap.round;
    final contrastLine = Paint()
      ..color = Colors.black.withValues(alpha: .28)
      ..style = PaintingStyle.stroke
      ..strokeWidth = line.strokeWidth + 3
      ..strokeCap = StrokeCap.round;

    final radius = Radius.circular(math.min(28, safeTarget.width * .12));
    final rounded = RRect.fromRectAndRadius(safeTarget, radius);
    canvas.drawRRect(rounded, glow);
    if (shown != FaceFrameState.searching) {
      // A faint wash inside the frame in its colour.
      canvas.drawRRect(rounded, Paint()..color = accent.withValues(alpha: ready ? .08 : .05));
    }

    final corner = math.min(34.0, safeTarget.width * .22);
    final path = Path()
      ..moveTo(safeTarget.left, safeTarget.top + corner)
      ..lineTo(safeTarget.left, safeTarget.top + radius.x)
      ..quadraticBezierTo(safeTarget.left, safeTarget.top, safeTarget.left + radius.x, safeTarget.top)
      ..lineTo(safeTarget.left + corner, safeTarget.top)
      ..moveTo(safeTarget.right - corner, safeTarget.top)
      ..lineTo(safeTarget.right - radius.x, safeTarget.top)
      ..quadraticBezierTo(safeTarget.right, safeTarget.top, safeTarget.right, safeTarget.top + radius.x)
      ..lineTo(safeTarget.right, safeTarget.top + corner)
      ..moveTo(safeTarget.right, safeTarget.bottom - corner)
      ..lineTo(safeTarget.right, safeTarget.bottom - radius.x)
      ..quadraticBezierTo(safeTarget.right, safeTarget.bottom, safeTarget.right - radius.x, safeTarget.bottom)
      ..lineTo(safeTarget.right - corner, safeTarget.bottom)
      ..moveTo(safeTarget.left + corner, safeTarget.bottom)
      ..lineTo(safeTarget.left + radius.x, safeTarget.bottom)
      ..quadraticBezierTo(safeTarget.left, safeTarget.bottom, safeTarget.left, safeTarget.bottom - radius.x)
      ..lineTo(safeTarget.left, safeTarget.bottom - corner);
    // A soft dark edge under the frame keeps it visible against a bright wall or the light theme.
    canvas.drawPath(path, contrastLine);
    canvas.drawPath(path, line);

    // The scan wave sweeps the frame with a fading tail, also while idling for a face.
    final scanY = safeTarget.top + safeTarget.height * animation.value;
    final band = Rect.fromLTRB(safeTarget.left + 14, scanY - 22, safeTarget.right - 14, scanY);
    canvas.drawRect(band, Paint()
      ..shader = LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter,
              colors: [accent.withValues(alpha: 0), accent.withValues(alpha: shown == FaceFrameState.searching ? .12 : .18)])
          .createShader(band));
    canvas.drawLine(
      Offset(safeTarget.left + 14, scanY),
      Offset(safeTarget.right - 14, scanY),
      Paint()
        ..shader = LinearGradient(colors: [accent.withValues(alpha: 0), accent, accent.withValues(alpha: 0)])
            .createShader(Rect.fromLTRB(safeTarget.left, scanY - 1, safeTarget.right, scanY + 1))
        ..strokeWidth = 1.8,
    );
    if (raw != null) {
      canvas.drawCircle(safeTarget.center, 3.5, Paint()..color = accent.withValues(alpha: .9));
    }
  }

  @override
  bool shouldRepaint(covariant FaceTargetPainter oldDelegate) =>
      oldDelegate.face != face ||
      oldDelegate.ready != ready ||
      oldDelegate.state != state ||
      oldDelegate.imageSize != imageSize ||
      oldDelegate.rotation != rotation ||
      oldDelegate.lensDirection != lensDirection;
}

// Custom Painter to mask the camera feed outside the oval guide
class OvalCutoutPainter extends CustomPainter {
  final Color overlayColor;
  final BorderSide borderSide;
  final double screenWidth;
  final double screenHeight;

  OvalCutoutPainter({
    required this.screenWidth,
    required this.screenHeight,
    this.overlayColor = Colors.black,
    this.borderSide = const BorderSide(color: Colors.white, width: 2.0),
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = overlayColor
      ..style = PaintingStyle.fill;

    // Full canvas area path
    final backgroundPath = Path()
      ..addRect(Rect.fromLTWH(0, 0, size.width, size.height));

    // Centered oval shape cutout path matching guide dimensions
    final ovalWidth = screenWidth * 0.52;
    final ovalHeight = screenHeight * 0.32;
    final ovalRect = Rect.fromCenter(
      center: Offset(size.width / 2, size.height / 2),
      width: ovalWidth,
      height: ovalHeight,
    );
    final ovalPath = Path()..addOval(ovalRect);

    // Subtract the oval path from the background path
    final maskPath = Path.combine(
      PathOperation.difference,
      backgroundPath,
      ovalPath,
    );

    // Draw the solid mask outside the oval
    canvas.drawPath(maskPath, paint);

    // Draw the oval border stroke
    if (borderSide.style != BorderStyle.none) {
      final borderPaint = Paint()
        ..color = borderSide.color
        ..style = PaintingStyle.stroke
        ..strokeWidth = borderSide.width;
      canvas.drawOval(ovalRect, borderPaint);
    }
  }

  @override
  bool shouldRepaint(covariant OvalCutoutPainter oldDelegate) {
    return oldDelegate.borderSide.color != borderSide.color ||
        oldDelegate.screenWidth != screenWidth ||
        oldDelegate.screenHeight != screenHeight;
  }
}

// Draws a depleting countdown ring around the oval guide, plus a green
// success pulse ring when a gesture is detected.
class OvalCountdownPainter extends CustomPainter {
  final double screenWidth;
  final double screenHeight;
  final double fraction; // 1.0 = full time left, 0.0 = expired
  final bool success;

  OvalCountdownPainter({
    required this.screenWidth,
    required this.screenHeight,
    required this.fraction,
    required this.success,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final ovalRect = Rect.fromCenter(
      center: Offset(size.width / 2, size.height / 2),
      width: screenWidth * 0.52 + 14,
      height: screenHeight * 0.32 + 14,
    );

    if (success) {
      // Solid green pulse ring on success.
      final pulse = Paint()
        ..color = const Color(0xFF10B981)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 5.0;
      canvas.drawOval(ovalRect, pulse);
      return;
    }

    // Track (faint) + remaining-time arc.
    final track = Paint()
      ..color = Colors.white.withValues(alpha: 0.12)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4.0;
    canvas.drawOval(ovalRect, track);

    final urgent = fraction < 0.35;
    final arc = Paint()
      ..color = urgent ? const Color(0xFFF59E0B) : const Color(0xFF10B981)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4.0
      ..strokeCap = StrokeCap.round;
    final sweep = 2 * math.pi * fraction.clamp(0.0, 1.0);
    canvas.drawArc(ovalRect, -math.pi / 2, sweep, false, arc);
  }

  @override
  bool shouldRepaint(covariant OvalCountdownPainter oldDelegate) {
    return oldDelegate.fraction != fraction || oldDelegate.success != success;
  }
}

// Custom Painter to draw a dynamic simulated 468-point face mesh
class FaceMeshPainter extends CustomPainter {
  final double progress;
  final String challenge;
  final double animationValue;
  final double eyeOpenProbability;
  final double headRotationAngle;
  final double headRotationAnglePitch;

  FaceMeshPainter({
    required this.progress,
    required this.challenge,
    required this.animationValue,
    required this.eyeOpenProbability,
    required this.headRotationAngle,
    required this.headRotationAnglePitch,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final paint = Paint()
      ..color = const Color(0xFF10B981).withValues(alpha: 0.18)
      ..strokeWidth = 0.8
      ..style = PaintingStyle.stroke;

    final meshLinePaint = Paint()
      ..color = const Color(0xFF10B981).withValues(alpha: 0.35)
      ..strokeWidth = 0.5
      ..style = PaintingStyle.stroke;

    final dotPaint = Paint()
      ..color = const Color(0xFF10B981).withValues(alpha: 0.8)
      ..strokeWidth = 2.0
      ..style = PaintingStyle.fill;

    // Determine coordinate offsets based on dynamic liveness state variables
    double dx = 0;
    double dy = 0;
    double eyeHeightFactor = 1.0;

    if (challenge == "Turn Left") {
      // headRotationAngle goes negative when turning left (e.g. down to -35.0)
      dx = (headRotationAngle / 30.0) * 20.0;
    } else if (challenge == "Nod") {
      // headRotationAnglePitch increases up to 18.0
      dy = (headRotationAnglePitch / 15.0) * 12.0;
    } else if (challenge == "Blink") {
      eyeHeightFactor = eyeOpenProbability < 0.4 ? 0.15 : 1.0;
    }

    final scaleX = size.width * 0.38;
    final scaleY = size.height * 0.28;

    // Normalized relative landmark coordinate sets
    final jawNormalized = [
      Offset(-0.55, -0.2),
      Offset(-0.48, 0.15),
      Offset(-0.3, 0.48),
      Offset(0.0, 0.65),
      Offset(0.3, 0.48),
      Offset(0.48, 0.15),
      Offset(0.55, -0.2),
    ];

    final leftEyebrowNorm = [
      Offset(-0.38, -0.38),
      Offset(-0.24, -0.42),
      Offset(-0.1, -0.36),
    ];
    final rightEyebrowNorm = [
      Offset(0.1, -0.36),
      Offset(0.24, -0.42),
      Offset(0.38, -0.38),
    ];

    final leftEyeNorm = [
      Offset(-0.30, -0.23), // top
      Offset(-0.18, -0.21), // right
      Offset(-0.30, -0.19), // bottom
      Offset(-0.42, -0.21), // left
    ];
    final rightEyeNorm = [
      Offset(0.18, -0.21), // left
      Offset(0.30, -0.23), // top
      Offset(0.42, -0.21), // right
      Offset(0.30, -0.19), // bottom
    ];

    final noseNorm = [
      Offset(0.0, -0.38), // bridge top
      Offset(0.0, 0.12), // tip
      Offset(-0.08, 0.12), // left nostril
      Offset(0.08, 0.12), // right nostril
    ];

    final mouthNorm = [
      Offset(-0.22, 0.32), // left corner
      Offset(0.0, 0.26), // top lip
      Offset(0.22, 0.32), // right corner
      Offset(0.0, 0.42), // bottom lip
    ];

    Offset transformPoint(Offset norm) {
      double px = norm.dx;
      double py = norm.dy;

      // Shrink eye points vertically to simulate blinking
      if (leftEyeNorm.contains(norm) || rightEyeNorm.contains(norm)) {
        double centerY = -0.21;
        py = centerY + (py - centerY) * eyeHeightFactor;
      }

      return Offset(center.dx + px * scaleX + dx, center.dy + py * scaleY + dy);
    }

    void drawPathPoints(List<Offset> normList, {bool closed = false}) {
      final points = normList.map(transformPoint).toList();
      final path = Path();
      if (points.isNotEmpty) {
        path.moveTo(points.first.dx, points.first.dy);
        for (int i = 1; i < points.length; i++) {
          path.lineTo(points[i].dx, points[i].dy);
        }
        if (closed) {
          path.close();
        }
        canvas.drawPath(path, paint);

        for (final pt in points) {
          canvas.drawCircle(pt, 1.5, dotPaint);
        }
      }
    }

    // Draw main structure lines
    drawPathPoints(jawNormalized);
    drawPathPoints(leftEyebrowNorm);
    drawPathPoints(rightEyebrowNorm);
    drawPathPoints(leftEyeNorm, closed: true);
    drawPathPoints(rightEyeNorm, closed: true);
    drawPathPoints(noseNorm);
    drawPathPoints(mouthNorm, closed: true);

    // Draw high-density cross-contour grid lines (468 landmarks simulation)
    final jawPoints = jawNormalized.map(transformPoint).toList();
    final mouthPoints = mouthNorm.map(transformPoint).toList();
    final nosePoints = noseNorm.map(transformPoint).toList();
    final eyeLPoints = leftEyeNorm.map(transformPoint).toList();
    final eyeRPoints = rightEyeNorm.map(transformPoint).toList();
    final eyebrowL = leftEyebrowNorm.map(transformPoint).toList();
    final eyebrowR = rightEyebrowNorm.map(transformPoint).toList();

    if (jawPoints.length >= 7 &&
        mouthPoints.length >= 4 &&
        eyebrowL.length >= 3) {
      // Connect jaw nodes to mouth/eyebrow edges
      canvas.drawLine(jawPoints[0], eyebrowL[0], meshLinePaint);
      canvas.drawLine(jawPoints[6], eyebrowR[2], meshLinePaint);
      canvas.drawLine(jawPoints[1], eyeLPoints[3], meshLinePaint);
      canvas.drawLine(jawPoints[5], eyeRPoints[2], meshLinePaint);
      canvas.drawLine(jawPoints[2], mouthPoints[0], meshLinePaint);
      canvas.drawLine(jawPoints[4], mouthPoints[2], meshLinePaint);
      canvas.drawLine(jawPoints[3], mouthPoints[3], meshLinePaint);

      // Connect mouth corners to nose tip
      canvas.drawLine(mouthPoints[0], nosePoints[1], meshLinePaint);
      canvas.drawLine(mouthPoints[2], nosePoints[1], meshLinePaint);
      canvas.drawLine(mouthPoints[1], nosePoints[1], meshLinePaint);

      // Connect nose bridge to eyebrow corners
      canvas.drawLine(nosePoints[0], eyebrowL[2], meshLinePaint);
      canvas.drawLine(nosePoints[0], eyebrowR[0], meshLinePaint);
      canvas.drawLine(nosePoints[0], eyeLPoints[1], meshLinePaint);
      canvas.drawLine(nosePoints[0], eyeRPoints[0], meshLinePaint);

      // Connect eyebrows to forehead top boundary (simulated)
      final foreheadPoints = [
        Offset(center.dx - scaleX * 0.4 + dx, center.dy - scaleY * 0.6 + dy),
        Offset(center.dx + dx, center.dy - scaleY * 0.75 + dy),
        Offset(center.dx + scaleX * 0.4 + dx, center.dy - scaleY * 0.6 + dy),
      ];
      for (final pt in foreheadPoints) {
        canvas.drawCircle(pt, 1.5, dotPaint);
      }
      canvas.drawLine(eyebrowL[0], foreheadPoints[0], meshLinePaint);
      canvas.drawLine(eyebrowL[1], foreheadPoints[1], meshLinePaint);
      canvas.drawLine(eyebrowR[1], foreheadPoints[1], meshLinePaint);
      canvas.drawLine(eyebrowR[2], foreheadPoints[2], meshLinePaint);
    }
  }

  @override
  bool shouldRepaint(covariant FaceMeshPainter oldDelegate) {
    return oldDelegate.progress != progress ||
        oldDelegate.challenge != challenge ||
        oldDelegate.animationValue != animationValue ||
        oldDelegate.eyeOpenProbability != eyeOpenProbability ||
        oldDelegate.headRotationAngle != headRotationAngle ||
        oldDelegate.headRotationAnglePitch != headRotationAnglePitch;
  }
}
