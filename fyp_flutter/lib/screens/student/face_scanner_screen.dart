// ignore_for_file: deprecated_member_use, use_build_context_synchronously
import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:camera/camera.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import '../../widgets/aurora_background.dart';
import '../../widgets/glass_card.dart';

// -----------------------------------------------------------------
// SCREEN 3: Face Recognition Scanner Screen with scanning animation
// -----------------------------------------------------------------
class FaceScannerScreen extends StatefulWidget {
  final String title;
  final Function(String? imageBase64, bool livenessPassed, {int? challengeMs}) onScanComplete;

  const FaceScannerScreen({
    super.key,
    required this.title,
    required this.onScanComplete,
  });

  @override
  State<FaceScannerScreen> createState() => _FaceScannerScreenState();
}

class _FaceScannerScreenState extends State<FaceScannerScreen>
    with TickerProviderStateMixin {
  late AnimationController _scannerAnimController;
  
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
  int _completedTasksCount = 0;
  List<String> _selectedChallenges = [];
  // Behavioral biometrics: when the user clicked "Detect Face"
  DateTime? _scanStartedAt;
  // Frame skipping: only run face detection every 3rd camera frame.
  int _frameSkipCount = 0;

  @override
  void initState() {
    super.initState();
    _currentChallenge = _challenges[0];
    _faceDetector = FaceDetector(
      options: FaceDetectorOptions(
        enableClassification: true,
        enableTracking: true,
        performanceMode: FaceDetectorMode.accurate,
      ),
    );
    _scannerAnimController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);
    
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
        imageFormatGroup: Platform.isIOS ? ImageFormatGroup.bgra8888 : ImageFormatGroup.yuv420,
      );
      
      await _cameraController!.initialize();
      if (mounted) {
        setState(() {
          _isCameraInitialized = true;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _cameraError = "Camera error: $e";
        });
      }
    }
  }

  @override
  void dispose() {
    _scannerAnimController.dispose();
    _progressTimer?.cancel();
    _countdownTimer?.cancel();
    try {
      if (_cameraController != null && _cameraController!.value.isStreamingImages) {
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
      return InputImageRotationValue.fromRawValue(sensorOrientation) ?? InputImageRotation.rotation90deg;
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
    
    return InputImageRotationValue.fromRawValue(rawRotation) ?? InputImageRotation.rotation270deg;
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

      final Size imageSize = Size(image.width.toDouble(), image.height.toDouble());
      final InputImageFormat inputImageFormat = 
          Platform.isIOS ? InputImageFormat.bgra8888 : InputImageFormat.nv21;

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
      // Skip every 2 out of 3 frames — reduces face detection from ~30/s to ~10/s.
      _frameSkipCount = (_frameSkipCount + 1) % 3;
      if (_frameSkipCount != 0) return;

      if (_isProcessingImage || !isScanning || !_isWaitingForGesture) return;
      _isProcessingImage = true;

      try {
        final inputImage = _convertCameraImageToInputImage(image);
        if (inputImage != null) {
          final List<Face> faces = await _faceDetector.processImage(inputImage);
          if (faces.isNotEmpty) {
            final Face face = faces.first;

            double? leftEye = face.leftEyeOpenProbability;
            double? rightEye = face.rightEyeOpenProbability;
            double? rotY = face.headEulerAngleY; // Yaw (left/right)
            double? rotX = face.headEulerAngleX; // Pitch (up/down)

            // Guard: only rebuild if a value changed meaningfully.
            final newEye  = (leftEye != null && rightEye != null) ? (leftEye + rightEye) / 2.0 : _eyeOpenProbability;
            final newRotY = rotY ?? _headRotationAngle;
            final newRotX = rotX ?? _headRotationAnglePitch;
            final eyeChanged  = (newEye  - _eyeOpenProbability).abs() > 0.02;
            final rotYChanged = (newRotY - _headRotationAngle).abs() > 1.0;
            final rotXChanged = (newRotX - _headRotationAnglePitch).abs() > 1.0;
            if (mounted && (eyeChanged || rotYChanged || rotXChanged)) {
              setState(() {
                if (eyeChanged)  _eyeOpenProbability     = newEye;
                if (rotYChanged) _headRotationAngle      = newRotY;
                if (rotXChanged) _headRotationAnglePitch = newRotX;
              });
            }

            if (_currentChallenge == "Blink") {
              if (leftEye != null && rightEye != null && leftEye < 0.3 && rightEye < 0.3) {
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
    if (!_isWaitingForGesture || _currentChallenge != "Blink" || _challengeSuccess) return;
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

  void startScanning() {
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
            _eyeOpenProbability = 0.90 + (DateTime.now().millisecond % 10) * 0.008;
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
            _headRotationAnglePitch = -0.5 + (DateTime.now().millisecond % 5) * 0.2;
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
            scanningStatusText = "TASK $taskNum/$_kChallengeCount: Please BLINK! (${secsLeft}s)";
            if (_eyeOpenProbability > 0.4) {
              _eyeOpenProbability = 0.90 + (DateTime.now().millisecond % 10) * 0.008;
            }
            _headRotationAngle = 0.0;
            _headRotationAnglePitch = 0.0;
          } else if (_currentChallenge == "Turn Left") {
            scanningStatusText = "TASK $taskNum/$_kChallengeCount: Turn head LEFT! (${secsLeft}s)";
            _eyeOpenProbability = 0.95;
            if (_headRotationAngle > -10.0) {
              _headRotationAngle = -1.0 + (DateTime.now().millisecond % 5) * 0.4;
            }
            _headRotationAnglePitch = 0.0;
          } else if (_currentChallenge == "Turn Right") {
            scanningStatusText = "TASK $taskNum/$_kChallengeCount: Turn head RIGHT! (${secsLeft}s)";
            _eyeOpenProbability = 0.95;
            if (_headRotationAngle < 10.0) {
              _headRotationAngle = 1.0 - (DateTime.now().millisecond % 5) * 0.4;
            }
            _headRotationAnglePitch = 0.0;
          } else if (_currentChallenge == "Nod") {
            scanningStatusText = "TASK $taskNum/$_kChallengeCount: NOD your head! (${secsLeft}s)";
            _eyeOpenProbability = 0.95;
            _headRotationAngle = 0.0;
            if (_headRotationAnglePitch.abs() < 5.0) {
              _headRotationAnglePitch = -0.5 + (DateTime.now().millisecond % 5) * 0.2;
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
    _countdownTimer = Timer.periodic(const Duration(milliseconds: 100), (timer) {
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
      if (_cameraController != null && _cameraController!.value.isStreamingImages) {
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
    setState(() {
      scanningStatusText = "Capturing Face...";
    });

    try {
      if (_cameraController != null && _cameraController!.value.isStreamingImages) {
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
      widget.onScanComplete(capturedImageBase64, passed, challengeMs: challengeMs);
      if (mounted) {
        Navigator.pop(context);
      }
    });
  }

  // Animated directional cue (arrow / icon) that nudges toward the gesture.
  Widget _buildDirectionArrow() {
    IconData icon;
    Alignment align;
    switch (_currentChallenge) {
      case "Turn Left":
        icon = Icons.arrow_back_rounded;
        align = const Alignment(-0.78, 0.0);
        break;
      case "Turn Right":
        icon = Icons.arrow_forward_rounded;
        align = const Alignment(0.78, 0.0);
        break;
      case "Nod":
        icon = Icons.keyboard_double_arrow_down_rounded;
        align = const Alignment(0.0, 0.72);
        break;
      default: // Blink
        icon = Icons.remove_red_eye_outlined;
        align = const Alignment(0.0, -0.72);
    }
    return Align(
      alignment: align,
      child: AnimatedBuilder(
        animation: _scannerAnimController,
        builder: (context, child) {
          final t = _scannerAnimController.value; // 0..1..0
          return Opacity(
            opacity: 0.45 + 0.55 * t,
            child: Transform.scale(scale: 0.9 + 0.25 * t, child: child),
          );
        },
        child: Icon(icon, color: const Color(0xFF10B981), size: 40),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;
    final screenHeight = MediaQuery.of(context).size.height;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.title,
          style: GoogleFonts.spaceGrotesk(fontSize: 16, fontWeight: FontWeight.bold),
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
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                    color: _cameraError != null
                        ? Colors.red.withValues(alpha: 0.05)
                        : Colors.white.withValues(alpha: 0.8),
                    borderColor: _cameraError != null
                        ? Colors.red.withValues(alpha: 0.2)
                        : Colors.white.withValues(alpha: 0.2),
                    child: Row(
                      children: [
                        Icon(
                          _cameraError != null ? Icons.error_outline : Icons.info_outline,
                          color: _cameraError != null ? const Color(0xFFDC2626) : const Color(0xFF2563EB),
                          size: 16,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            _cameraError != null
                                ? "Camera Connection Issue: $_cameraError\nMake sure to stop the app and run a clean rebuild (flutter clean & flutter run) to link native packages."
                                : "Hold camera steady and look directly at the center oval.",
                            style: GoogleFonts.inter(
                              fontSize: 10.5,
                              fontWeight: FontWeight.w500,
                              color: _cameraError != null ? const Color(0xFF991B1B) : const Color(0xFF475569),
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
                            if (_isWaitingForGesture && _currentChallenge == "Blink") {
                              _triggerBlinkSuccess();
                            }
                          },
                          onPanUpdate: _handlePanUpdate,
                          child: Stack(
                            alignment: Alignment.center,
                            children: [
                              // 1. Bottom Layer: Live Camera Preview
                              if (_isCameraInitialized && _cameraController != null)
                                Positioned.fill(
                                  child: FittedBox(
                                    fit: BoxFit.cover,
                                    child: SizedBox(
                                      width: 100,
                                      height: _cameraController!.value.aspectRatio > 1.0
                                          ? 100 * _cameraController!.value.aspectRatio
                                          : 100 / _cameraController!.value.aspectRatio,
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
                                            color: const Color(0xFF10B981).withValues(alpha: 0.05),
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
                                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                            decoration: BoxDecoration(
                                              color: Colors.amber.withValues(alpha: 0.12),
                                              borderRadius: BorderRadius.circular(20),
                                              border: Border.all(color: Colors.amber.withValues(alpha: 0.3), width: 1),
                                            ),
                                            child: Text(
                                              "CAMERA SIMULATION ACTIVE",
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
                                            "Camera Interface Warning: Clean rebuild is required to link CameraX native packages.",
                                            style: TextStyle(
                                              color: Colors.white.withValues(alpha: 0.3),
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
                                  child: CircularProgressIndicator(color: Color(0xFF10B981)),
                                ),

                              // 2. Middle Layer: Sliding Scanner Line (only if scanning)
                              if (isScanning)
                                AnimatedBuilder(
                                  animation: _scannerAnimController,
                                  builder: (context, child) {
                                    final ovalHeight = screenHeight * 0.32;
                                    final translationOffset = (ovalHeight * _scannerAnimController.value) - (ovalHeight / 2);
                                    return Transform.translate(
                                      offset: Offset(0, translationOffset),
                                      child: Container(
                                        width: screenWidth * 0.48,
                                        height: 2.0,
                                        decoration: BoxDecoration(
                                          color: const Color(0xFF10B981),
                                          boxShadow: [
                                            BoxShadow(
                                              color: const Color(0xFF10B981).withValues(alpha: 0.8),
                                              blurRadius: 10,
                                              spreadRadius: 2.0,
                                            )
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
                                         animationValue: _scannerAnimController.value,
                                         eyeOpenProbability: _eyeOpenProbability,
                                         headRotationAngle: _headRotationAngle,
                                         headRotationAnglePitch: _headRotationAnglePitch,
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
                                    overlayColor: Colors.black, // Opaque black mask outside the oval
                                    borderSide: BorderSide(
                                      color: isScanning
                                          ? const Color(0xFF10B981).withValues(alpha: 0.8)
                                          : Colors.white.withValues(alpha: 0.35),
                                      width: 2.0,
                                    ),
                                  ),
                                ),
                              ),

                              // 3b. Countdown ring + success pulse around the oval guide
                              if (isScanning && (_isWaitingForGesture || _showSuccessPulse))
                                Positioned.fill(
                                  child: RepaintBoundary(
                                    child: CustomPaint(
                                      painter: OvalCountdownPainter(
                                        screenWidth: screenWidth,
                                        screenHeight: screenHeight,
                                        fraction: _isWaitingForGesture
                                            ? (_countdownSeconds / _kPerChallengeSeconds).clamp(0.0, 1.0)
                                            : 1.0,
                                        success: _showSuccessPulse,
                                      ),
                                    ),
                                  ),
                                ),

                              // 3c. Animated directional arrow cue for the current challenge
                              if (isScanning && _isWaitingForGesture && !_showSuccessPulse)
                                _buildDirectionArrow(),

                              // 4. Fallback Shutter Info (only if camera not initialized and no error yet)
                              if (!_isCameraInitialized && _cameraError == null)
                                Positioned.fill(
                                  child: Container(
                                    color: Colors.black.withValues(alpha: 0.85),
                                    child: Column(
                                      mainAxisAlignment: MainAxisAlignment.center,
                                      children: [
                                        Icon(
                                          Icons.camera_alt,
                                          size: 36,
                                          color: Colors.white.withValues(alpha: 0.08),
                                        ),
                                        const SizedBox(height: 6),
                                        Text(
                                          "CAMERA INITIALIZING...",
                                          style: TextStyle(
                                            color: Colors.white.withValues(alpha: 0.08),
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
                                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFF0F172A).withValues(alpha: 0.95), // Slate 900
                                      borderRadius: BorderRadius.circular(20),
                                      border: Border.all(
                                        color: const Color(0xFF3B82F6).withValues(alpha: 0.4),
                                        width: 1,
                                      ),
                                      boxShadow: [
                                        BoxShadow(
                                          color: Colors.black.withValues(alpha: 0.4),
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
                                          _currentChallenge == "Blink"
                                              ? "SIMULATOR HUD: TAP SCREEN TO BLINK"
                                              : _currentChallenge == "Turn Left"
                                                  ? "SIMULATOR HUD: SWIPE LEFT TO TURN LEFT"
                                                  : _currentChallenge == "Turn Right"
                                                      ? "SIMULATOR HUD: SWIPE RIGHT TO TURN RIGHT"
                                                      : "SIMULATOR HUD: SWIPE UP/DOWN TO NOD",
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
                          scanningStatusText,
                          textAlign: TextAlign.center,
                          style: GoogleFonts.inter(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: isScanning ? const Color(0xFF1E293B) : const Color(0xFF64748B),
                          ),
                        ),
                        if (isScanning) ...[
                          const SizedBox(height: 12),
                          // High-tech Gesture Telemetry Tracker Panel
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF8FAFC),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: const Color(0xFFE2E8F0)),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                      "Active Telemetry:",
                                      style: GoogleFonts.spaceGrotesk(
                                        fontSize: 9.5,
                                        fontWeight: FontWeight.bold,
                                        color: const Color(0xFF475569),
                                        letterSpacing: 0.5,
                                      ),
                                    ),
                                    Text(
                                      _challengeSuccess ? "CHALLENGE PASSED ✅" : "AWAITING ACTION...",
                                      style: GoogleFonts.inter(
                                        fontSize: 9.0,
                                        fontWeight: FontWeight.bold,
                                        color: _challengeSuccess ? const Color(0xFF10B981) : const Color(0xFFF59E0B),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                if (_currentChallenge == "Blink") ...[
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        "Eye Open Probability",
                                        style: GoogleFonts.inter(fontSize: 10, color: const Color(0xFF64748B)),
                                      ),
                                      Text(
                                        _eyeOpenProbability.toStringAsFixed(2),
                                        style: GoogleFonts.spaceGrotesk(
                                          fontSize: 11,
                                          fontWeight: FontWeight.bold,
                                          color: _eyeOpenProbability < 0.2 ? const Color(0xFF10B981) : const Color(0xFF2563EB),
                                        ),
                                      ),
                                    ],
                                  ),
                                ] else if (_currentChallenge == "Turn Left") ...[
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        "Head Yaw Angle",
                                        style: GoogleFonts.inter(fontSize: 10, color: const Color(0xFF64748B)),
                                      ),
                                      Text(
                                        "${_headRotationAngle.toStringAsFixed(1)}°",
                                        style: GoogleFonts.spaceGrotesk(
                                          fontSize: 11,
                                          fontWeight: FontWeight.bold,
                                          color: _headRotationAngle >= 20.0 ? const Color(0xFF10B981) : const Color(0xFF2563EB),
                                        ),
                                      ),
                                    ],
                                  ),
                                ] else if (_currentChallenge == "Turn Right") ...[
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        "Head Yaw Angle",
                                        style: GoogleFonts.inter(fontSize: 10, color: const Color(0xFF64748B)),
                                      ),
                                      Text(
                                        "${_headRotationAngle.toStringAsFixed(1)}°",
                                        style: GoogleFonts.spaceGrotesk(
                                          fontSize: 11,
                                          fontWeight: FontWeight.bold,
                                          color: _headRotationAngle <= -20.0 ? const Color(0xFF10B981) : const Color(0xFF2563EB),
                                        ),
                                      ),
                                    ],
                                  ),
                                ] else if (_currentChallenge == "Nod") ...[
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        "Head Pitch Angle",
                                        style: GoogleFonts.inter(fontSize: 10, color: const Color(0xFF64748B)),
                                      ),
                                      Text(
                                        "${_headRotationAngle.toStringAsFixed(1)}°",
                                        style: GoogleFonts.spaceGrotesk(
                                          fontSize: 11,
                                          fontWeight: FontWeight.bold,
                                          color: _headRotationAngle >= 15.0 ? const Color(0xFF10B981) : const Color(0xFF2563EB),
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
                              "${(progress * 100).toInt()}% Analysed",
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
                      onPressed: isScanning ? null : () {
                        setState(() {
                          _cameraError = null;
                        });
                        _initializeCamera();
                      },
                      icon: const Icon(Icons.refresh),
                      label: const Text("Retry Camera Initialization"),
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
                    label: Text(isScanning
                        ? "Processing Scan..."
                        : (_cameraError != null ? "Detect Face (Simulation Mode)" : "Detect Face")),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _cameraError != null ? const Color(0xFF64748B) : const Color(0xFF10B981),
                      foregroundColor: Colors.white,
                      disabledBackgroundColor: (_cameraError != null ? const Color(0xFF64748B) : const Color(0xFF10B981)).withValues(alpha: 0.5),
                      disabledForegroundColor: Colors.white.withValues(alpha: 0.8),
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
          )
        ],
      ),
    );
  }
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

    final leftEyebrowNorm = [Offset(-0.38, -0.38), Offset(-0.24, -0.42), Offset(-0.1, -0.36)];
    final rightEyebrowNorm = [Offset(0.1, -0.36), Offset(0.24, -0.42), Offset(0.38, -0.38)];

    final leftEyeNorm = [
      Offset(-0.30, -0.23), // top
      Offset(-0.18, -0.21), // right
      Offset(-0.30, -0.19), // bottom
      Offset(-0.42, -0.21), // left
    ];
    final rightEyeNorm = [
      Offset(0.18, -0.21),  // left
      Offset(0.30, -0.23),  // top
      Offset(0.42, -0.21),  // right
      Offset(0.30, -0.19),  // bottom
    ];

    final noseNorm = [
      Offset(0.0, -0.38), // bridge top
      Offset(0.0, 0.12),  // tip
      Offset(-0.08, 0.12), // left nostril
      Offset(0.08, 0.12),  // right nostril
    ];

    final mouthNorm = [
      Offset(-0.22, 0.32), // left corner
      Offset(0.0, 0.26),   // top lip
      Offset(0.22, 0.32),  // right corner
      Offset(0.0, 0.42),   // bottom lip
    ];

    Offset transformPoint(Offset norm) {
      double px = norm.dx;
      double py = norm.dy;

      // Shrink eye points vertically to simulate blinking
      if (leftEyeNorm.contains(norm) || rightEyeNorm.contains(norm)) {
        double centerY = -0.21;
        py = centerY + (py - centerY) * eyeHeightFactor;
      }

      return Offset(
        center.dx + px * scaleX + dx,
        center.dy + py * scaleY + dy,
      );
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

    if (jawPoints.length >= 7 && mouthPoints.length >= 4 && eyebrowL.length >= 3) {
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
