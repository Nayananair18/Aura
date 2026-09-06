import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Card, MetadataItem, SectionTitle } from '../components/Card';
import { EvidenceCard } from '../components/EvidenceCard';
import { Header } from '../components/Header';
import { MLScoreCard } from '../components/MLScoreCard';
import { GroqScoreCard } from '../components/GroqScoreCard';
import { QrCode } from '../components/QrCode';
import { SensorGraph } from '../components/SensorGraph';
import * as FileService from '../services/fileService';

// ── Sub-components & Helpers ──

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



    // Status
    statusBadge: {
      alignItems: 'center',
      paddingVertical: spacing.xl,
      marginBottom: spacing.md,
    },
    statusIconCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    statusIcon: {
      fontSize: 28,
      color: '#FFFFFF',
      fontWeight: '700',
    },
    statusTitle: {
      ...typography.title,
      color: colors.text,
      marginBottom: 4,
    },
    statusSubtitle: {
      ...typography.callout,
      color: colors.textSecondary,
      marginBottom: spacing.md,
      textAlign: 'center',
    },
    auraFlag: {
      paddingHorizontal: spacing.md,
      paddingVertical: 4,
      borderRadius: 4,
    },
    auraFlagText: {
      ...typography.caption,
      color: '#FFFFFF',
      fontWeight: '700',
    },

    // Photo
    photoCard: {
      padding: 0,
      overflow: 'hidden',
      marginBottom: spacing.md,
    },
    photo: {
      width: '100%',
      aspectRatio: 16 / 9,
      backgroundColor: colors.surface,
    },
    photoMeta: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      padding: spacing.md,
    },
    photoName: {
      ...typography.footnote,
      color: colors.text,
      fontWeight: '600',
      flex: 1,
    },
    photoSize: {
      ...typography.footnote,
      color: colors.textMuted,
      marginLeft: spacing.sm,
    },

    // Stats
    statsRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    statCard: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.lg,
    },
    statValue: {
      ...typography.title,
      color: colors.text,
      marginBottom: 4,
    },
    statLabel: {
      ...typography.footnote,
      color: colors.textMuted,
    },

    // Sections & Hash
    sectionBlock: {
      marginTop: spacing.md,
      marginBottom: spacing.xs,
    },
    hashSection: {
      marginTop: spacing.sm,
      marginBottom: spacing.lg,
    },
    hashCard: {
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderRadius: 12,
    },
    hashText: {
      ...typography.footnote,
      color: colors.textSecondary,
      fontFamily: 'monospace',
      fontSize: 12,
      lineHeight: 19,
      letterSpacing: 0.5,
      flexWrap: 'wrap',
    },

    // Defense & Validation
    defenseRow: {
      paddingVertical: spacing.sm,
    },
    defenseHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      marginBottom: 6,
    },
    defenseDetails: {
      ...typography.caption,
      color: colors.textMuted,
      paddingLeft: 16,
      lineHeight: 16,
    },
    validationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm + 2,
      gap: spacing.sm + 2,
    },
    validationDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      flexShrink: 0,
    },
    validationLabel: {
      ...typography.callout,
      color: colors.text,
      flex: 1,
      fontWeight: '600',
    },
    validationStatus: {
      ...typography.footnote,
      fontWeight: '700',
      flexShrink: 0,
    },
    divider: {
      height: 1,
      backgroundColor: colors.divider,
    },

    // Proof ID
    proofIdCard: {
      padding: spacing.lg,
      alignItems: 'center',
      borderRadius: 14,
      marginBottom: spacing.md,
    },
    proofIdLabel: {
      ...typography.caption,
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1,
      marginBottom: spacing.xs,
    },
    proofIdValue: {
      ...typography.callout,
      fontFamily: 'monospace',
      fontWeight: '700',
      color: colors.primary || colors.accent || '#818CF8',
      fontSize: 15,
      letterSpacing: 0.5,
      textAlign: 'center',
    },
  });
};

const DefenseRow = ({ label, status, details, theme }) => {
  const { colors, spacing, typography } = theme;
  const styles = getStyles(theme);
  return (
    <View style={styles.defenseRow}>
      <View style={styles.defenseHeader}>
        <View style={[styles.validationDot, { backgroundColor: status ? colors.authentic : colors.error }]} />
        <Text style={styles.validationLabel}>{label}</Text>
        <Text style={[styles.validationStatus, { color: status ? colors.authentic : colors.error }]}>
          {status ? 'PASSED' : 'FAILED'}
        </Text>
      </View>
      <Text style={styles.defenseDetails}>{details}</Text>
    </View>
  );
};

const ResultSensorRow = ({ icon, label, points, color, unit = '', theme }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { colors, spacing, typography } = theme;

  if (!points || points.length < 2) return null;

  const latestVal = points[points.length - 1];
  const displayVal = typeof latestVal === 'number' ? `${latestVal.toFixed(1)}${unit}` : '—';

  return (
    <View style={{ paddingVertical: spacing.xs }}>
      <Pressable
        onPress={() => setIsExpanded((prev) => !prev)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: spacing.xs,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={{ fontSize: 18 }}>{icon}</Text>
          <View>
            <Text style={{ ...typography.callout, fontWeight: '700', color: colors.text }}>{label}</Text>
            <Text style={{ ...typography.caption, color: colors.textMuted }}>{points.length} telemetry samples</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={{ ...typography.callout, fontWeight: '600', color: colors.textSecondary }}>{displayVal}</Text>
          <Text style={{ fontSize: 12, color: colors.textMuted, fontWeight: '700' }}>{isExpanded ? '▲' : '▼'}</Text>
        </View>
      </Pressable>

      {isExpanded && (
        <View style={{ marginTop: spacing.xs, marginBottom: spacing.xs }}>
          <SensorGraph data={points} color={color} height={52} maxPoints={60} />
        </View>
      )}
    </View>
  );
};

const renderSensorAnalysis = (sensorData, theme) => {
  if (!sensorData) return null;

  const accelPoints = Array.isArray(sensorData.accelerometer)
    ? sensorData.accelerometer.map(r => (r && typeof r === 'object' && r.x != null ? Math.sqrt((r.x||0)**2 + (r.y||0)**2 + (r.z||0)**2) : Number(r) || 0)).filter(Number.isFinite)
    : [];

  const gyroPoints = Array.isArray(sensorData.gyroscope)
    ? sensorData.gyroscope.map(r => (r && typeof r === 'object' && r.x != null ? Math.sqrt((r.x||0)**2 + (r.y||0)**2 + (r.z||0)**2) : Number(r) || 0)).filter(Number.isFinite)
    : [];

  const magPoints = Array.isArray(sensorData.magnetometer)
    ? sensorData.magnetometer.map(r => (r && typeof r === 'object' && r.magneticField != null ? Number(r.magneticField) : (r && typeof r === 'object' && r.x != null ? Math.sqrt((r.x||0)**2 + (r.y||0)**2 + (r.z||0)**2) : Number(r) || 0))).filter(Number.isFinite)
    : [];

  const lightPoints = Array.isArray(sensorData.light)
    ? sensorData.light.map(r => (r && typeof r === 'object' && r.lux != null ? Number(r.lux) || 0 : Number(r) || 0)).filter(Number.isFinite)
    : [];

  if (accelPoints.length < 2 && gyroPoints.length < 2 && magPoints.length < 2 && lightPoints.length < 2) return null;

  const { colors, spacing } = theme;

  return (
    <View style={{ marginTop: spacing.md, marginBottom: spacing.md }}>
      <SectionTitle title="SENSOR TELEMETRY & GRAPHS" theme={theme} />
      <Card theme={theme}>
        {lightPoints.length >= 2 && (
          <ResultSensorRow
            icon="💡"
            label="Light Sensor"
            points={lightPoints}
            color="#F59E0B"
            unit=" lux"
            theme={theme}
          />
        )}
        {lightPoints.length >= 2 && accelPoints.length >= 2 && <View style={{ height: 1, backgroundColor: colors.divider, marginVertical: spacing.xs }} />}

        {accelPoints.length >= 2 && (
          <ResultSensorRow
            icon="📱"
            label="Accelerometer"
            points={accelPoints}
            color={colors.accent || '#818CF8'}
            theme={theme}
          />
        )}
        {accelPoints.length >= 2 && gyroPoints.length >= 2 && <View style={{ height: 1, backgroundColor: colors.divider, marginVertical: spacing.xs }} />}

        {gyroPoints.length >= 2 && (
          <ResultSensorRow
            icon="🔄"
            label="Gyroscope"
            points={gyroPoints}
            color="#34D399"
            theme={theme}
          />
        )}
        {gyroPoints.length >= 2 && magPoints.length >= 2 && <View style={{ height: 1, backgroundColor: colors.divider, marginVertical: spacing.xs }} />}

        {magPoints.length >= 2 && (
          <ResultSensorRow
            icon="🧲"
            label="Magnetometer"
            points={magPoints}
            color="#F43F5E"
            unit=" µT"
            theme={theme}
          />
        )}
      </Card>
    </View>
  );
};

export const ResultScreen = ({ route, navigation, theme }) => {
  const params = route?.params || {};
  const {
    status = 'authentic',
    verification = {},
    proof = {},
    sensorData = null,
    fileName = null,
    fileHash = '',
    photoData = null,
    metadata = {},
    mlAnalysis = null,
    groqAnalysis = null,
  } = params;

  const resolvedGroq = groqAnalysis || params.groq || proof?.groq || mlAnalysis?.groq || null;

    // Differentiate between "Capture Mode" (brand new baseline) and "Verification Mode"
  const isCaptureMode = Boolean(params.isCaptureMode === true || verification.isCaptureMode === true);

  // Resolve display filename
  const displayFileName = fileName || photoData?.name || metadata?.fileName || 'photo_capture.jpg';
  const physicalFingerprint = mlAnalysis?.metadataFingerprint || proof?.exif || metadata?.exif || photoData?.exif || proof?.metadata || metadata || {};

  const hashValidation = verification.hashValidation || {};
  const rawHashMatch = params.matchPercentage ?? params.hashMatch ?? verification.hashMatch ?? hashValidation.matchPercentage;
  const hashMatchNum = rawHashMatch != null ? Number(rawHashMatch) : (isCaptureMode ? 100 : (hashValidation.isValid ? 100 : 0));
  const isHashMatch = isCaptureMode ? true : (hashMatchNum === 100 || Boolean(hashValidation.isValid));

  // Detect screen capture from ML analysis classification or high screen score
  const screenCaptureByML = Boolean(
    mlAnalysis?.classification === 'SCREEN_RECAPTURE' ||
    mlAnalysis?.classification === 'SCREEN_REPLAY' ||
    (mlAnalysis?.screenScore ?? 0) >= 0.50 ||
    (mlAnalysis?.screenScore ?? 0) >= 50
  );

  // Replay check: True if flagged by ML visual analysis, Groq analysis, or active screen defense
  const isRecaptured = Boolean(
    params.isRecaptured === true ||
    params.result?.isRecaptured === true ||
    verification.isRecaptured === true ||
    verification.screenDefense?.isRecaptured === true ||
    verification.screenDefense?.result === 'failed' ||
    proof.isRecaptured === true ||
    screenCaptureByML ||
    resolvedGroq?.screenReplay?.isScreenReplay === true
  );

  const isGroqConfirmedRealWorld = Boolean(
    resolvedGroq?.screenReplay?.success === true &&
    resolvedGroq?.screenReplay?.isScreenReplay === false &&
    (resolvedGroq?.screenReplay?.confidence ?? 0) >= 80
  );

  const isScreenReplayAttack = isGroqConfirmedRealWorld
    ? false
    : (isRecaptured || screenCaptureByML || Boolean(resolvedGroq?.screenReplay?.isScreenReplay));

  const hashValid = isCaptureMode ? true : isHashMatch;
  const aiProbability = mlAnalysis?.aiProbability ?? 0;
  const screenFailed = verification.screenDefense?.result === 'failed' || verification.screenDefense?.isRecaptured === true;
  const physicsFailed = verification.physicsDefense?.result === 'failed';
  const hasHardwareExif = Boolean(
    mlAnalysis?.hasHardwareExif ??
    (physicalFingerprint?.Make || physicalFingerprint?.Model || physicalFingerprint?.ExposureTime || physicalFingerprint?.FNumber)
  );

  // ─── Result Screen Banner Decision Engine ───
  let evaluatedFlag = 'GREEN';

  // PRIORITY 1: Screen replay attack, tampered status, high AI probability, or failed screen/physics defenses trigger RED flag regardless of capture mode
  if (isScreenReplayAttack || status === 'tampered' || aiProbability >= 70 || screenFailed || physicsFailed) {
    evaluatedFlag = 'RED';
  } else if (isCaptureMode) {
    evaluatedFlag = 'GREEN';
  } else if (!isHashMatch && aiProbability >= 70) {
    evaluatedFlag = 'RED';
  } else if (!isHashMatch) {
    // Unregistered external upload without authentic ledger proof -> YELLOW (Unverified External Media)
    evaluatedFlag = 'YELLOW';
  } else if (status === 'unverified' || !hasHardwareExif || aiProbability >= 25) {
    evaluatedFlag = 'YELLOW';
  } else {
    evaluatedFlag = 'GREEN';
  }

  const isAuthentic = evaluatedFlag === 'GREEN';
  const isUncertain = evaluatedFlag === 'YELLOW';
  const isTampered = evaluatedFlag === 'RED';

  const { colors } = theme;
  const styles = getStyles(theme);

  const resolvedScreenConfidence = resolvedGroq?.screenReplay?.confidence || (mlAnalysis?.screenScore ? (mlAnalysis.screenScore <= 1 ? mlAnalysis.screenScore * 100 : mlAnalysis.screenScore) : 95.0);

  const confidence = isScreenReplayAttack
    ? parseFloat(Number(resolvedScreenConfidence).toFixed(1))
    : (verification.confidence != null 
        ? parseFloat(Number(verification.confidence).toFixed(1))
        : (isAuthentic ? 99.7 : (isUncertain ? 50.0 : (aiProbability >= 70 ? parseFloat(Number(aiProbability).toFixed(1)) : 95.0))));
  const activeProofId = proof.id || verification.proofId || 'AURA-VERIFIED';

  const displayHashMatch = isCaptureMode
    ? '100% (Baseline Sealed)'
    : (isHashMatch ? `${hashValidation.matchPercentage}%` : '0% Match / Unregistered');
  const statHashMatch = isCaptureMode
    ? '100%'
    : (isHashMatch ? `${hashValidation.matchPercentage}%` : '0%');

  const handleSaveToGallery = async () => {
    if (!photoData?.uri) {
      Alert.alert('Error', 'No image available to save');
      return;
    }
    const res = await FileService.saveToPhoneGallery(photoData.uri);
    if (res.success) {
      Alert.alert('Saved!', res.message || 'Saved to "AURA Verified" album in your Photos');
    } else {
      Alert.alert('Gallery Save', res.message || 'Could not save to gallery');
    }
  };

  const handleShareVerifiedImage = async () => {
    if (!photoData?.uri) {
      Alert.alert('Error', 'No image available to share');
      return;
    }
    try {
      await Share.share({
        title: 'A.U.R.A. Verified Image',
        message: `🛡️ A.U.R.A. Verified Authentic Capture\nProof ID: ${activeProofId}\nVerify: https://aura-app.com/verify/${activeProofId}`,
        url: photoData.uri,
      });
    } catch (err) {
      console.error('Error sharing image:', err.message);
    }
  };

  // Status Badge visual configurations
  const badgeConfig = {
    GREEN: {
      icon: '✓',
      title: 'A.U.R.A. Verified',
      subtitle: 'Environmental Physics Sealed / Cryptographic Proof Valid',
      color: colors.authentic || '#22C55E',
    },
    YELLOW: {
      icon: '⚠️',
      title: 'Unverified External Media',
      subtitle: 'No physical sensor telemetry sealed in ledger',
      color: colors.warning || '#F59E0B',
    },
    RED: {
      icon: '✗',
      title: isRecaptured ? 'SCREEN RECAPTURE DETECTED' : 'Integrity Failure',
      subtitle: isRecaptured 
        ? 'Photo of a digital screen (Display PWM flicker & subpixel grid detected)' 
        : 'Physics violation or high AI generation probability',
      color: colors.error || '#EF4444',
    },
  };

  const activeBadge = badgeConfig[evaluatedFlag] || badgeConfig.YELLOW;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Header
        title="Result"
        theme={theme}
        onBack={() => navigation.navigate('Home')}
      />

      <View style={styles.content}>
        {/* Status Badge (Single Primary Indicator) */}
        <View style={styles.statusBadge}>
          <View style={[styles.statusIconCircle, { backgroundColor: activeBadge.color }]}>
            <Text style={styles.statusIcon}>{activeBadge.icon}</Text>
          </View>
          <Text style={styles.statusTitle}>{activeBadge.title}</Text>
          <Text style={styles.statusSubtitle}>{activeBadge.subtitle}</Text>
          <View style={[styles.auraFlag, { backgroundColor: activeBadge.color }]}>
            <Text style={styles.auraFlagText}>A.U.R.A. FLAG: {evaluatedFlag}</Text>
          </View>
        </View>

        {/* Photo Preview */}
        {photoData?.uri && (
          <Card theme={theme} style={styles.photoCard}>
            <Image source={{ uri: photoData.uri }} style={styles.photo} resizeMode="cover" />
            <View style={styles.photoMeta}>
              <Text style={styles.photoName} numberOfLines={1}>{displayFileName}</Text>
              <Text style={styles.photoSize}>
                {photoData.size != null ? `${(photoData.size / 1024).toFixed(1)} KB` : ''}
              </Text>
            </View>
          </Card>
        )}

        {/* ML Metadata Analysis */}
        {mlAnalysis && (
          <View style={styles.sectionBlock}>
            <SectionTitle title="AI DETECTION ANALYSIS" theme={theme} />
            <MLScoreCard 
              analysis={mlAnalysis} 
              isRecaptured={isScreenReplayAttack}
              screenConfidence={resolvedScreenConfidence}
              theme={theme} 
            />
          </View>
        )}

        {/* Groq VLM Analysis */}
        {Boolean(resolvedGroq) && (
          <View style={styles.sectionBlock}>
            <SectionTitle title="GROQ VLM ANALYSIS" theme={theme} />
            <GroqScoreCard groq={resolvedGroq} theme={theme} />
          </View>
        )}

        {/* Physical Evidence Card */}
        <View style={styles.sectionBlock}>
          <SectionTitle title="PHYSICAL EVIDENCE" theme={theme} />
          <EvidenceCard
            fingerprint={physicalFingerprint}
            theme={theme}
          />
        </View>

        {/* Proof ID Section */}
        <View style={styles.sectionBlock}>
          <SectionTitle title="PROOF ID" theme={theme} />
          <Card theme={theme} style={styles.proofIdCard}>
            <Text style={styles.proofIdLabel}>CRYPTOGRAPHIC PROOF IDENTIFIER</Text>
            <Text style={styles.proofIdValue} selectable={true}>{activeProofId}</Text>
          </Card>
        </View>

        {/* All Sensor Graphs */}
        {renderSensorAnalysis(sensorData || proof.sensorData, theme)}

        {/* Action Buttons */}
        <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.lg }}>
          <Button
            title="Back to Home"
            onPress={() => navigation.navigate('Home')}
            variant="outline"
            size="large"
            theme={theme}
          />
        </View>
      </View>
    </ScrollView>
  );
};
