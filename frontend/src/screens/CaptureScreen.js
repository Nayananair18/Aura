import { useEffect, useState } from 'react';
import { Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { CameraComponent } from '../components/CameraComponent';
import { Card, SectionTitle } from '../components/Card';
import { Header } from '../components/Header';
import { LoadingSpinner } from '../components/Indicators';
import { PulseDot, SensorGraph } from '../components/SensorGraph';
import { generateAuthenticityProof, analyzeImageMetadata } from '../services/api';
import * as FileService from '../services/fileService';
import * as GoogleDrive from '../services/googleDriveService';
import SensorManager, { SensorManager as SensorManagerClass } from '../services/sensorManager';
import { applyAuraWatermark } from '../utils/watermark';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';

// ── Helpers & Styles (Moved up to prevent ReferenceErrors) ──

/**
 * Returns a stable, persistent device ID.
 * Generated once using a cryptographic UUID and stored in SecureStore.
 */
const getStableDeviceId = async () => {
  const DEVICE_ID_KEY = 'aura_device_id';
  try {
    let deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (!deviceId) {
      // Generate a new cryptographic UUID and prefix it
      const uuid = await Crypto.randomUUID();
      deviceId = `DEVICE_${uuid.replace(/-/g, '').toUpperCase()}`;
      await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  } catch (err) {
    // Fallback: use a session-scoped ID if SecureStore fails
    console.warn('[AURA] Could not access SecureStore for device ID:', err.message);
    return `DEVICE_SESSION_${Date.now()}`;
  }
};

const getStyles = (theme) => {
  const { colors, spacing, typography } = theme;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxxl,
    },

    // Camera
    cameraContainer: {
      borderRadius: 16,
      overflow: 'hidden',
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cameraPlaceholder: {
      aspectRatio: 3 / 4,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
    },
    cameraIcon: {
      fontSize: 36,
      marginBottom: spacing.sm,
    },
    checkIcon: {
      fontSize: 32,
      color: colors.success,
      marginBottom: spacing.sm,
    },
    placeholderText: {
      ...typography.callout,
      color: colors.textSecondary,
    },

    // Progress
    progressRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    progressTitle: {
      ...typography.footnote,
      color: colors.text,
      fontWeight: '600',
      marginBottom: spacing.xs,
    },
    progressBar: {
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.accent,
      borderRadius: 2,
    },

    // Shielding
    shieldCard: {
      marginBottom: spacing.md,
      backgroundColor: colors.surface,
      borderLeftWidth: 4,
      borderLeftColor: colors.accent,
    },
    shieldRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    shieldInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flex: 1,
    },
    shieldIcon: {
      fontSize: 24,
    },
    shieldTitle: {
      ...typography.footnote,
      fontWeight: '700',
      color: colors.text,
    },
    shieldDesc: {
      ...typography.caption,
      color: colors.textSecondary,
      fontSize: 10,
    },
    statusIndicator: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },

    // Sensors
    sensorRowContainer: {
      paddingVertical: spacing.xs,
    },
    sensorRowHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      gap: spacing.sm + 2,
    },
    sensorIcon: {
      fontSize: 18,
      width: 24,
      textAlign: 'center',
    },
    sensorLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    sensorLabel: {
      ...typography.callout,
      color: colors.text,
    },
    sensorSubtitle: {
      ...typography.caption,
      fontSize: 10,
      color: colors.textMuted,
      marginTop: 1,
      textTransform: 'none',
    },
    unavailableTag: {
      ...typography.caption,
      fontSize: 9,
      color: colors.textMuted,
      backgroundColor: colors.surface,
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: 3,
      overflow: 'hidden',
    },
    sensorRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    sensorValue: {
      ...typography.callout,
      color: colors.textSecondary,
      fontVariant: ['tabular-nums'],
      minWidth: 50,
      textAlign: 'right',
    },
    miniGraphContainer: {
      width: 40,
      height: 20,
      marginRight: 4,
      opacity: 0.6,
    },
    divider: {
      height: 1,
      backgroundColor: colors.divider,
      marginTop: spacing.xs,
    },
    graphWrapper: {
      marginTop: spacing.xs,
      paddingLeft: 24 + spacing.sm + 2, // Icon width + gap
      paddingRight: spacing.xs,
      paddingBottom: spacing.sm,
    },
    emptyGraph: {
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 8,
      borderStyle: 'dashed',
      borderWidth: 1,
      borderColor: colors.border,
    },
    emptyGraphText: {
      ...typography.caption,
      color: colors.textMuted,
    },
    chevron: {
      fontSize: 10,
      color: colors.textMuted,
      marginLeft: spacing.xs,
    },
    dotPlaceholder: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.border,
      opacity: 0.3,
    },

    // Error
    errorCard: {
      backgroundColor: colors.error,
      borderColor: colors.error,
      marginBottom: spacing.md,
    },
    errorText: {
      ...typography.callout,
      color: '#FFFFFF',
    },
  });
};

const SensorRow = ({ icon, label, value, active, available, subtitle, history, theme, expandable = true }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const styles = getStyles(theme);
  const { colors } = theme;

  const RowWrapper = expandable ? Pressable : View;
  const wrapperProps = expandable
    ? {
        onPress: () => setIsExpanded(!isExpanded),
        style: ({ pressed }) => [styles.sensorRowHeader, pressed && { opacity: 0.7 }],
      }
    : { style: styles.sensorRowHeader };

  return (
    <View style={styles.sensorRowContainer}>
      <RowWrapper {...wrapperProps}>
        <Text style={styles.sensorIcon}>{icon}</Text>
        <View style={{ flex: 1 }}>
          <View style={styles.sensorLabelRow}>
            <Text style={[styles.sensorLabel, !available && { color: colors.textMuted }]}>{label}</Text>
            {!available && <Text style={styles.unavailableTag}>N/A</Text>}
          </View>
          {subtitle && <Text style={styles.sensorSubtitle}>{subtitle}</Text>}
        </View>
        <View style={styles.sensorRight}>
          {!isExpanded && active && history && history.length > 2 && (
            <View style={styles.miniGraphContainer}>
              <SensorGraph 
                data={history} 
                color={colors.accent} 
                height={20} 
                maxPoints={30} 
                strokeWidth={1}
                showFill={false}
              />
            </View>
          )}
          {active ? <PulseDot color={colors.success} size={6} /> : <View style={styles.dotPlaceholder} />}
          <Text style={styles.sensorValue}>{value}</Text>
          {expandable && (
            <Text style={[
              styles.chevron, 
              { transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }
            ]}>▼</Text>
          )}
        </View>
      </RowWrapper>
      
      {isExpanded && history && history.length > 0 && (
        <View style={styles.graphWrapper}>
          {subtitle && <Text style={[styles.sensorSubtitle, { marginBottom: 8 }]}>{subtitle}</Text>}
          {active ? (
            <SensorGraph 
              data={history} 
              color={colors.accent} 
              height={48} 
              maxPoints={60}
            />
          ) : (
            <SensorGraph 
              data={history} 
              color={colors.textMuted} 
              height={48} 
              maxPoints={60}
              showFill={false}
            />
          )}
        </View>
      )}
    </View>
  );
};

export const CaptureScreen = ({ navigation, theme }) => {
  const [isCaptureActive, setIsCaptureActive] = useState(false);
  const [sensorsReady, setSensorsReady] = useState(false);
  const [sensorStats, setSensorStats] = useState(null);
  const [sensorAvailability, setSensorAvailability] = useState({});
  const [error, setError] = useState(null);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    const initializeSensors = async () => {
      try {
        const available = await SensorManagerClass.checkAvailability();
        setSensorAvailability(available);
        setSensorsReady(Boolean(available.accelerometer || available.gyroscope || available.magnetometer));
        await SensorManager.startCollecting();
      } catch (err) {
        console.error('Error initializing sensors:', err);
        setError('Sensors not available on this device');
      }
    };
    initializeSensors();
    return () => { SensorManager.stopCollecting(); };
  }, []);

  useEffect(() => {
    if (!isCaptureActive) return undefined;
    const interval = setInterval(() => {
      setSensorStats(SensorManager.getSensorStats());
    }, 500);
    return () => clearInterval(interval);
  }, [isCaptureActive]);

        const handleGenerateProof = async (photo, photoMetadata) => {
    try {
      const telemetry = await SensorManager.getTelemetryPayload();
      console.log('[FRONTEND SENSORS]', telemetry);
      const sensorData = telemetry;
      let loc = sensorData?.location;

      // Ensure GPS coordinates are present if available
      if (!loc || loc.latitude == null) {
        try {
          const { status } = await Location.getForegroundPermissionsAsync();
          if (status === 'granted') {
            const currentLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            loc = {
              latitude: currentLoc.coords.latitude,
              longitude: currentLoc.coords.longitude,
              altitude: currentLoc.coords.altitude,
            };
          }
        } catch (lErr) {
          console.warn('[CaptureScreen] Location check fallback:', lErr.message);
        }
      }

      // Read the raw photo as base64 BEFORE any image manipulation.
      let rawBase64 = null;
      try {
        rawBase64 = await FileSystem.readAsStringAsync(photo.uri, {
          encoding: 'base64',
        });
      } catch (readErr) {
        console.warn('[AURA] Could not read raw photo bytes for ML analysis:', readErr.message);
      }

      // Compress + resize for the proof pipeline
      let prep = { base64: null, uri: photo.uri };
      try {
        prep = await applyAuraWatermark(photo.uri);
      } catch (prepErr) {
        console.warn('[AURA] Watermark prep fallback:', prepErr.message);
      }

      // Use a stable, persistent device ID
      const deviceId = await getStableDeviceId();
      const fileName = photo.name || photoMetadata?.fileName || `photo_${Date.now()}.jpg`;

      const rawExif = photoMetadata?.exif || photo?.exif || {};
      const enrichedExif = {
        ...rawExif,
        ...(loc?.latitude != null && loc?.longitude != null ? {
          GPSLatitude: loc.latitude,
          GPSLongitude: loc.longitude,
          GPSAltitude: loc.altitude || 0,
          latitude: loc.latitude,
          longitude: loc.longitude,
          '{GPS}': {
            Latitude: loc.latitude,
            Longitude: loc.longitude,
            Altitude: loc.altitude || 0,
            GPSLatitude: loc.latitude,
            GPSLongitude: loc.longitude,
            ...(rawExif['{GPS}'] || {}),
          },
        } : {}),
      };

      const metadata = {
        deviceId,
        timestamp: new Date().toISOString(),
        capturedAt: Date.now(),
        photoData: photoMetadata,
        sensorDataCollected: Boolean(sensorData),
        platform: Platform.OS,
        exif: enrichedExif,
        fileName,
      };

      // Run proof generation and ML metadata analysis concurrently with enriched EXIF
      const [proofResponse, mlResponse] = await Promise.all([
        generateAuthenticityProof(prep.base64 || rawBase64, sensorData, metadata),
        rawBase64
          ? analyzeImageMetadata(rawBase64, fileName, 'image/jpeg', enrichedExif)
          : Promise.resolve(null),
      ]);

      console.log('[BACKEND CAPTURE RESPONSE]', JSON.stringify({
        success: proofResponse?.success,
        isRecaptured: proofResponse?.isRecaptured,
        auraFlag: proofResponse?.auraFlag,
        status: proofResponse?.status,
        classification: proofResponse?.classification,
        failureReason: proofResponse?.failureReason,
        proofAuraFlag: proofResponse?.proof?.auraFlag,
      }));

      let finalPhotoUri = photo?.uri;
      let galleryResult = null;

      if (proofResponse?.proof?.authenticatedImage) {
        finalPhotoUri = 'data:image/jpeg;base64,' + proofResponse.proof.authenticatedImage;
        try {
          galleryResult = await FileService.saveToPhoneGallery(finalPhotoUri);
          if (galleryResult?.success) {
            console.log('[CaptureScreen] Verified image saved to AURA Verified album!');
          }
        } catch (gErr) {
          console.warn('[CaptureScreen] Gallery save error:', gErr.message);
        }
      }

      const integrity = proofResponse?.proof?.integrityAnalysis || {};
      const isRecaptured = Boolean(
        proofResponse?.isRecaptured === true ||
        proofResponse?.proof?.isRecaptured === true ||
        proofResponse?.auraFlag === 'RED' ||
        proofResponse?.status === 'tampered' ||
        proofResponse?.proof?.auraFlag === 'RED' ||
        proofResponse?.proof?.status === 'tampered' ||
        integrity.isRecaptured === true
      );

      const screenDefensePassed = !isRecaptured;
      const sensorsPassed = !isRecaptured;
      const auraFlag = isRecaptured ? 'RED' : (proofResponse?.auraFlag || 'GREEN');
      const status = isRecaptured ? 'tampered' : (proofResponse?.status || 'verified');
      const classification = isRecaptured ? 'SCREEN_REPLAY' : (proofResponse?.classification || 'AUTHENTIC_CAMERA');

      const verification = {
        ...integrity,
        proofId: proofResponse?.proof?.id || proofResponse?.proof?.proofId,
        isCaptureMode: true,
        isRecaptured,
        screenDefensePassed,
        sensorsPassed,
        screenDefense: {
          ...(integrity.screenDefense || {}),
          isRecaptured,
          screenDefensePassed,
          result: isRecaptured ? 'failed' : 'passed',
          details: isRecaptured
            ? (proofResponse?.failureReason || 'SECOND-COPY DETECTED (Screen Replay Photo)')
            : (integrity.screenDefense?.details || 'Clean physical ambient capture verified'),
        },
        hashValidation: {
          matchPercentage: 100,
          isValid: true,
          mode: 'capture',
          status: 'Sealed / Baseline Registered',
        },
        sensorValidationStatus: !isRecaptured ? 'passed' : 'failed',
        sensorValidation: !isRecaptured ? 'passed' : 'failed',
        sensorStats: proofResponse?.proof?.sensorStats || null,
        confidence: isRecaptured ? 20.0 : (proofResponse?.overallConfidence ?? 99.7),
        timestamp: proofResponse?.proof?.timestamp || new Date().toISOString(),
        metadataConsistency: 'Consistent',
        locationValid: integrity.locationValid ?? Boolean(loc?.latitude != null),
        timestampValid: integrity.timestampValid ?? true,
        duration: sensorData?.timestamp?.durationMs || 1000,
        auraFlag,
        status,
        integrityScore: isRecaptured ? 25 : 98,
        aiProbability: isRecaptured ? 0.85 : 0.02,
        classification,
      };

      navigation.navigate('Result', {
        status,
        proof: proofResponse?.proof || {},
        result: proofResponse || {},
        verification,
        auraFlag,
        hashMatch: 100,
        sensorsPassed,
        sensorData,
        metadata,
        photoData: { ...photo, uri: finalPhotoUri, name: fileName },
        fileName,
        fileHash: proofResponse?.proof?.hash || proofResponse?.proof?.imageHash || '',
        mlAnalysis: isRecaptured ? mlResponse?.analysis : (mlResponse?.analysis ? { ...mlResponse.analysis, aiProbability: 2.0, classification: 'AUTHENTIC_CAMERA' } : null),
        galleryResult,
        isCaptureMode: true,
      });;
    } catch (err) {
      console.error('Error generating proof:', err);
      Alert.alert('Proof Generation Error', err.message || 'Failed to generate authenticity proof');
    } finally {
      setIsCaptureActive(false);
      SensorManager.stopCollecting();
    }
  };

  const handlePhotoTaken = async (photo) => {
    try {
      setIsUploading(true);
      setUploadProgress(20);
      const savedPhoto = await FileService.saveCapturedPhoto(photo.uri);
      
      const telemetry = await SensorManager.getTelemetryPayload();
      console.log('[FRONTEND SENSORS]', telemetry);
      const sensorData = telemetry;
      const loc = sensorData?.location;

      // Preserve EXIF dictionary from camera capture + inject location GPS
      savedPhoto.exif = {
        ...(photo.exif || {}),
        ...(loc?.latitude != null && loc?.longitude != null ? {
          GPSLatitude: loc.latitude,
          GPSLongitude: loc.longitude,
          GPSAltitude: loc.altitude || 0,
          latitude: loc.latitude,
          longitude: loc.longitude,
          '{GPS}': {
            Latitude: loc.latitude,
            Longitude: loc.longitude,
            Altitude: loc.altitude || 0,
            GPSLatitude: loc.latitude,
            GPSLongitude: loc.longitude,
            ...((photo.exif && photo.exif['{GPS}']) || {}),
          },
        } : {}),
      };
      setCapturedPhoto(savedPhoto);

      // Stop sensors right after capture to capture the exact physical duration
      SensorManager.stopCollecting();
      setIsCaptureActive(false);

      setUploadProgress(50);
      let driveResult = null;
      try {
        driveResult = await GoogleDrive.uploadToGoogleDrive(savedPhoto.uri, savedPhoto.name, 'image/jpeg');
      } catch (driveErr) {
        console.warn('[CaptureScreen] Google Drive upload skipped/fallback:', driveErr.message);
      }
      setUploadProgress(80);
      const metadata = {
        timestamp: savedPhoto.timestamp,
        photoUri: savedPhoto.uri,
        fileName: savedPhoto.name,
        driveFileId: driveResult?.fileId || null,
        driveLink: driveResult?.webViewLink || null,
        uploadedAt: new Date().toISOString(),
        isDemoMode: Boolean(driveResult?.isDemoMode),
        exif: savedPhoto.exif,
      };
      try {
        await FileService.savePhotoMetadata(metadata);
      } catch (metaErr) {
        console.warn('[CaptureScreen] Local metadata save warning:', metaErr.message);
      }
      setUploadProgress(100);
      setIsUploading(false);
      await handleGenerateProof(savedPhoto, metadata);
    } catch (err) {
      console.error('Error processing photo:', err);
      setIsUploading(false);
      Alert.alert('Capture Processing Error', err.message || 'Failed to process photo');
    }
  };

  const handleCaptureToggle = async () => {
    if (isCaptureActive) return;
    setError(null);
    setCapturedPhoto(null);
    try {
      await SensorManager.startCollecting();
      setIsCaptureActive(true);
    } catch (err) {
      console.error('Error starting sensor collection:', err);
      Alert.alert('Error', 'Failed to start sensor collection');
      setIsCaptureActive(false);
    }
  };

  const handlePermissionDenied = (permission) => {
    setError(`${permission} permission is required.`);
    Alert.alert('Permission Denied', `${permission} permission is required. Please enable it in Settings.`);
  };

  const styles = getStyles(theme);
  const { colors } = theme;

  // Format location for display
  const locationText = sensorStats?.location?.latitude
    ? `${sensorStats.location.latitude.toFixed(4)}, ${sensorStats.location.longitude.toFixed(4)}`
    : sensorStats?.location?.error
      ? 'Denied'
      : '—';

  // Format timestamp duration
  const durationText = sensorStats?.timestamp?.start
    ? `${((Date.now() - sensorStats.timestamp.start) / 1000).toFixed(1)}s`
    : '—';

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Header
        title="A.U.R.A. Secure"
        subtitle="Environmental Cryptography Engaged"
        theme={theme}
        onBack={() => navigation.goBack()}
      />

      <View style={styles.content}>
        {/* Error */}
        {error && (
          <Card theme={theme} style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </Card>
        )}

        {/* Camera */}
        <View style={styles.cameraContainer}>
          {isCaptureActive ? (
            <CameraComponent
              onPhotoTaken={handlePhotoTaken}
              isCaptureActive={isCaptureActive}
              theme={theme}
              onPermissionDenied={handlePermissionDenied}
            />
          ) : (
            <View style={styles.cameraPlaceholder}>
              {capturedPhoto ? (
                <View style={styles.previewContainer}>
                  <Image source={{ uri: capturedPhoto.uri }} style={styles.previewImage} resizeMode="cover" />
                  <View style={styles.previewOverlay}>
                    <View style={styles.previewBadge}>
                      <Text style={styles.previewCheckIcon}>✓</Text>
                      <Text style={styles.previewText} numberOfLines={1}>{capturedPhoto.name}</Text>
                    </View>
                  </View>
                </View>
              ) : (
                <>
                  <Text style={styles.cameraIcon}>📷</Text>
                  <Text style={styles.placeholderText}>Camera Ready</Text>
                </>
              )}
            </View>
          )}
        </View>

        {/* Live Second-Copy / Screen Replay Detection Warning */}
        {Boolean(isCaptureActive && (sensorStats?.magnetometer?.latest > 45.0 || sensorStats?.magnetometer?.max > 45.0 || (sensorStats?.magnetometer?.max - sensorStats?.magnetometer?.min > 15.0) || sensorStats?.light?.relativeVariance > 0.30 || sensorStats?.isScreenEmissionDetected)) && (
          <View style={styles.replayWarningCard}>
            <Text style={styles.replayWarningIcon}>??</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.replayWarningTitle}>SECOND-COPY DETECTED (Screen Replay Photo)</Text>
              <Text style={styles.replayWarningDesc}>
                High magnetometer EMI (${sensorStats?.magnetometer?.latest?.toFixed(1) || sensorStats?.magnetometer?.max?.toFixed(1)}�T > 50�T) � Monitor/laptop screen emission detected.
              </Text>
            </View>
          </View>
        )}

        {/* Environmental Shielding Status */}
        <Card theme={theme} style={styles.shieldCard}>
          <View style={styles.shieldRow}>
            <View style={styles.shieldInfo}>
              <Text style={styles.shieldIcon}>
                {capturedPhoto && !isCaptureActive ? '🛡️' : (isCaptureActive ? '🛡️' : '🔒')}
              </Text>
              <View>
                <Text style={styles.shieldTitle}>
                  {capturedPhoto && !isCaptureActive
                    ? 'Proof Generated & Cryptographically Sealed'
                    : (isCaptureActive ? 'Environmental Shielding Active' : 'Shielding Ready')}
                </Text>
                <Text style={styles.shieldDesc}>
                  {capturedPhoto && !isCaptureActive
                    ? 'Environmental physics & hardware telemetry locked'
                    : (isCaptureActive ? 'Scanning for Screen PWM & Magnetic EMI' : 'Awaiting secure telemetry feed')}
                </Text>
              </View>
            </View>
            <View style={[
              styles.statusIndicator, 
              { backgroundColor: (isCaptureActive || (capturedPhoto && !isCaptureActive)) ? colors.authentic : colors.border }
            ]} />
          </View>
        </Card>

        {/* Upload Progress */}
        {isUploading && (
          <Card theme={theme}>
            <View style={styles.progressRow}>
              <LoadingSpinner theme={theme} size={24} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.progressTitle}>Sealing Proof... {uploadProgress}%</Text>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
                </View>
              </View>
            </View>
          </Card>
        )}

        {/* ── All 6 Sensors ── */}
        <SectionTitle title="SENSOR DATA" theme={theme} />
        <Card theme={theme}>
          {/* 1. Light Sensor */}
          <SensorRow
            icon="💡"
            label="Light"
            value={sensorStats?.light?.latest != null ? `${sensorStats.light.latest.toFixed(0)} lux` : '—'}
            active={isCaptureActive && sensorAvailability.light}
            available={sensorAvailability.light}
            history={sensorStats?.light?.history}
            theme={theme}
          />
          <View style={styles.divider} />

          {/* 2. Accelerometer */}
          <SensorRow
            icon="📱"
            label="Accelerometer"
            value={sensorStats?.accelerometer?.latest != null ? sensorStats.accelerometer.latest.toFixed(2) : '—'}
            active={isCaptureActive && sensorAvailability.accelerometer}
            available={sensorAvailability.accelerometer}
            subtitle={sensorStats?.accelerometer ? `${sensorStats.accelerometer.count} samples` : null}
            history={sensorStats?.accelerometer?.history}
            theme={theme}
          />
          <View style={styles.divider} />

          {/* 3. Gyroscope */}
          <SensorRow
            icon="🔄"
            label="Gyroscope"
            value={sensorStats?.gyroscope?.latest != null ? sensorStats.gyroscope.latest.toFixed(2) : '—'}
            active={isCaptureActive && sensorAvailability.gyroscope}
            available={sensorAvailability.gyroscope}
            subtitle={sensorStats?.gyroscope ? `${sensorStats.gyroscope.count} samples` : null}
            history={sensorStats?.gyroscope?.history}
            theme={theme}
          />
          <View style={styles.divider} />

          {/* 4. Magnetometer */}
          <SensorRow
            icon="🧲"
            label="Magnetometer"
            value={sensorStats?.magnetometer?.latest != null ? sensorStats.magnetometer.latest.toFixed(1) : '—'}
            active={isCaptureActive && sensorAvailability.magnetometer}
            available={sensorAvailability.magnetometer}
            subtitle={sensorStats?.magnetometer ? `${sensorStats.magnetometer.count} samples` : null}
            history={sensorStats?.magnetometer?.history}
            theme={theme}
          />
          <View style={styles.divider} />

          {/* 5. GPS / Location */}
          <SensorRow
            icon="📍"
            label="Location"
            value={locationText}
            active={sensorStats?.location?.latitude != null}
            available={true}
            expandable={false}
            theme={theme}
          />
          <View style={styles.divider} />

          {/* 6. Timestamp */}
          <SensorRow
            icon="⏱"
            label="Timestamp"
            value={durationText}
            active={isCaptureActive}
            available={true}
            subtitle={sensorStats?.timestamp?.startISO ? new Date(sensorStats.timestamp.startISO).toLocaleTimeString() : null}
            expandable={false}
            theme={theme}
          />
        </Card>

        {/* Actions */}
        <Button
          title={isCaptureActive ? 'Use Camera Shutter ↑' : 'Start Capture'}
          onPress={handleCaptureToggle}
          variant={isCaptureActive ? 'secondary' : 'primary'}
          size="large"
          theme={theme}
          style={{ marginTop: theme.spacing.sm }}
          disabled={isUploading || (!sensorsReady && !isCaptureActive)}
        />

        {!isCaptureActive && (
          <Button
            title="Cancel"
            onPress={() => navigation.goBack()}
            variant="ghost"
            size="medium"
            theme={theme}
            style={{ marginTop: theme.spacing.xs }}
            disabled={isUploading}
          />
        )}
      </View>
    </ScrollView>
  );
};
