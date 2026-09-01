import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

/** How long (ms) to record sensors before snapping the photo */
const SENSOR_RECORD_MS = 800;

export const CameraComponent = ({
  onPhotoTaken,
  isCaptureActive,
  theme,
  onPermissionDenied,
}) => {
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [isReady, setIsReady] = useState(false);

  // ── Sensor-recording state ──
  const [capturePhase, setCapturePhase] = useState(null); // null | 'recording' | 'snapping'
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef(null);

  useEffect(() => {
    const ensurePermission = async () => {
      try {
        const result = await requestPermission();
        if (result?.status !== 'granted') {
          onPermissionDenied?.('Camera');
        }
      } catch (error) {
        console.error('Error requesting camera permission:', error);
      }
    };
    ensurePermission();
  }, [onPermissionDenied, requestPermission]);

  // Start / stop the pulse animation
  useEffect(() => {
    if (capturePhase === 'recording') {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 350,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 350,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      pulseAnim.setValue(1);
    }

    return () => {
      pulseLoop.current?.stop();
    };
  }, [capturePhase, pulseAnim]);

  const handleTakePhoto = async () => {
    if (!cameraRef.current || !isReady || capturePhase) return;

    try {
      // Phase 1 – record sensors
      setCapturePhase('recording');
      await new Promise((resolve) => setTimeout(resolve, SENSOR_RECORD_MS));

      // Phase 2 – snap
      setCapturePhase('snapping');
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.95,
        exif: true,
        skipProcessing: true, // MUST be true on Android to prevent EXIF stripping
      });

      setCapturePhase(null);
      onPhotoTaken?.(photo);
    } catch (error) {
      console.error('Error taking photo:', error);
      setCapturePhase(null);
    }
  };

  if (!permission) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
        <Text style={{ color: theme.colors.textSecondary, fontSize: 14 }}>Requesting permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
        <Text style={{ color: theme.colors.error, fontSize: 14 }}>Camera access denied</Text>
      </View>
    );
  }

  // ── Status overlay config ──
  const statusConfig = {
    recording: {
      label: '⚡ Recording Sensors…',
      dot: theme.colors.warning ?? '#F59E0B',
      bg: 'rgba(245,158,11,0.18)',
    },
    snapping: {
      label: '📸 Capturing…',
      dot: theme.colors.success ?? '#22C55E',
      bg: 'rgba(34,197,94,0.18)',
    },
  };
  const status = capturePhase ? statusConfig[capturePhase] : null;

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        type="back"
        onCameraReady={() => setIsReady(true)}
      />

      {/* ── Sensor-recording status overlay ── */}
      {status && (
        <View style={[styles.statusOverlay, { backgroundColor: status.bg }]}>
          <Animated.View
            style={[
              styles.statusDot,
              { backgroundColor: status.dot, transform: [{ scale: pulseAnim }] },
            ]}
          />
          <Text style={[styles.statusText, { color: '#FFFFFF' }]}>{status.label}</Text>
        </View>
      )}

      {/* ── Shutter button ── */}
      {isCaptureActive && isReady && (
        <View style={styles.controls}>
          <Pressable
            onPress={handleTakePhoto}
            disabled={!!capturePhase}
            style={({ pressed }) => [
              styles.shutterOuter,
              pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
              !!capturePhase && { opacity: 0.4 },
            ]}
          >
            <View style={styles.shutterInner} />
          </Pressable>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 3 / 4,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  controls: {
    position: 'absolute',
    bottom: 28,
    alignSelf: 'center',
  },
  shutterOuter: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FFFFFF',
  },

  // ── Sensor-recording overlay ──
  statusOverlay: {
    position: 'absolute',
    top: 16,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    // semi-transparent pill
    backdropFilter: 'blur(8px)',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
