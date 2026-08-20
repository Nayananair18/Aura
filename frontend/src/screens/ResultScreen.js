import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Card, MetadataItem, SectionTitle } from '../components/Card';
import { EvidenceCard } from '../components/EvidenceCard';
import { Header } from '../components/Header';
import { MLScoreCard } from '../components/MLScoreCard';
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

    // QR
    qrCard: {
      alignItems: 'center',
      paddingVertical: spacing.lg,
      marginBottom: spacing.md,
    },
    qrDesc: {
      ...typography.caption,
      color: colors.textMuted,
      marginTop: spacing.md,
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

const renderSensorAnalysis = (sensorData, theme) => {
  if (!sensorData) return null;

  const accelPoints = Array.isArray(sensorData.accelerometer)
    ? sensorData.accelerometer.map(r => (r && typeof r === 'object' && r.x != null ? Math.sqrt((r.x||0)**2 + (r.y||0)**2 + (r.z||0)**2) : Number(r) || 0)).filter(Number.isFinite)
    : [];

  const lightPoints = Array.isArray(sensorData.light)
    ? sensorData.light.map(r => (r && typeof r === 'object' && r.lux != null ? Number(r.lux) || 0 : Number(r) || 0)).filter(Number.isFinite)
    : [];

  if (accelPoints.length < 2 && lightPoints.length < 2) return null;

  const { colors, spacing } = theme;

  return (
    <View style={{ marginTop: spacing.md }}>
      {accelPoints.length >= 2 && (
        <>
          <SectionTitle title="MOTION PROFILE" theme={theme} />
          <Card theme={theme}>
            <SensorGraph
              data={accelPoints}
              color={colors.accent || '#818CF8'}
              height={48}
              maxPoints={60}
            />
          </Card>
        </>
      )}

      {lightPoints.length >= 2 && (
        <>
          <SectionTitle title="OPTICAL DEFENSE METRICS" theme={theme} />
          <Card theme={theme}>
            <SensorGraph
              data={lightPoints}
              color="#F59E0B"
              height={48}
              maxPoints={60}
            />
          </Card>
        </>
      )}
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
  } = params;

    // Differentiate between "Capture Mode" (brand new baseline) and "Verification Mode"
  const isCaptureMode = Boolean(params.isCaptureMode === true || verification.isCaptureMode === true);

  // Resolve display filename
  const displayFileName = fileName || photoData?.name || metadata?.fileName || 'photo_capture.jpg';

  // Physical evidence fingerprint — from mlAnalysis.metadataFingerprint, proof.exif, or metadata
  const physicalFingerprint = mlAnalysis?.metadataFingerprint || proof?.exif || metadata?.exif || null;

  const hasHardwareExif = Boolean(
    physicalFingerprint && (
      (physicalFingerprint.make && String(physicalFingerprint.make).trim() !== '') ||
      (physicalFingerprint.model && String(physicalFingerprint.model).trim() !== '') ||
      physicalFingerprint.shutterSpeed != null ||
      physicalFingerprint.aperture != null ||
      physicalFingerprint.focalLength != null
    )
  );

  const hashValidation = verification.hashValidation || {};
  const isHashMatch = Boolean(hashValidation.isValid && (hashValidation.matchPercentage ?? 0) > 0);
  const hashValid = isCaptureMode ? true : isHashMatch;
  const aiProbability = mlAnalysis?.aiProbability ?? 0;
  const screenPassed = verification.screenDefense?.result === 'passed' || 
    (verification.screenDefense?.magnetometerPassed && verification.screenDefense?.lightFlickerPassed);
  const physicsPassed = Boolean(verification.physicsDefense?.motionPassed);

  // Strict Decision Engine Rule: "No Physical Proof = Not Verified"
  let evaluatedFlag = verification.auraFlag || 'GREEN';

  if (!isCaptureMode && !isHashMatch && (aiProbability >= 70 || status === 'tampered')) {
    evaluatedFlag = 'RED';
  } else if (!isCaptureMode && !isHashMatch) {
    // Unregistered external upload without authentic ledger proof
    evaluatedFlag = aiProbability >= 70 ? 'RED' : 'YELLOW';
  } else if (!screenPassed || !physicsPassed || aiProbability >= 70 || !hashValid || status === 'tampered') {
    evaluatedFlag = 'RED';
  } else if (!hasHardwareExif || aiProbability >= 25 || status === 'unverified' || status === 'suspicious') {
    // Missing EXIF or AI prob in 25%-70% band -> strictly YELLOW / AMBER (NEVER GREEN)
    evaluatedFlag = 'YELLOW';
  } else if (verification.auraFlag === 'GREEN' && screenPassed && physicsPassed && hasHardwareExif && aiProbability < 25 && hashValid) {
    evaluatedFlag = 'GREEN';
  } else {
    evaluatedFlag = 'YELLOW';
  }

  const isAuthentic = evaluatedFlag === 'GREEN';
  const isUncertain = evaluatedFlag === 'YELLOW';
  const isTampered = evaluatedFlag === 'RED';

  const { colors } = theme;
  const styles = getStyles(theme);

  const confidence = verification.confidence != null 
    ? verification.confidence 
    : (isAuthentic ? 99.7 : (isUncertain ? 50.0 : 0.0));
  const activeProofId = proof.id || verification.proofId || 'AURA-VERIFIED';

  // ── ML Classification → Badge mapping ──────────────────────────
  // The ML classification from the backend is the primary result indicator.
  // It is derived from the full forensic fusion: KNN + Visual CNN + ELA + Screen.
  //
  // In verify mode (uploaded image): use mlAnalysis.classification as primary.
  // In capture mode (live capture): sensor proof (auraFlag) is primary.
  //   ML analysis supplements but does not override sensor evidence.
  //
  // This fixes the highlight bug: the badge now always reflects the actual
  // highest-confidence classification from the backend, not a derived sensor flag.
  const mlClassification = mlAnalysis?.classification; // 'REAL' | 'AI_GENERATED' | 'SCREEN_RECAPTURE' | 'NOT_VERIFIED'

  // Map ML classification to a display flag key
  const ML_FLAG_MAP = {
    REAL:             'GREEN',
    REAL_CAMERA:      'GREEN',    // backward compat
    AI_GENERATED:     'RED',
    SCREEN_RECAPTURE: 'SCREEN',
    NOT_VERIFIED:     'YELLOW',
    UNCERTAIN:        'YELLOW',   // backward compat
  };
  const mlFlag = mlClassification ? (ML_FLAG_MAP[mlClassification] || 'YELLOW') : null;

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
  // GREEN  = Authentic (sensor + ML agree)
  // YELLOW = Not verified / uncertain / NOT_VERIFIED
  // RED    = AI generated / tampered
  // SCREEN = Screen recapture detected
  const badgeConfig = {
    GREEN: {
      icon: '✓',
      title: 'A.U.R.A. Verified',
      subtitle: 'Physical camera evidence verified. No strong AI or screen-recapture indicators detected.',
      color: colors.authentic || '#22C55E',
    },
    YELLOW: {
      icon: '?',
      title: 'Not Verified',
      subtitle: 'Insufficient or conflicting forensic evidence to classify this image. Missing physical proof or ambiguous signals.',
      color: '#F59E0B',
    },
    RED: {
      icon: '✗',
      title: 'AI Generated Detected',
      subtitle: 'The image shows strong evidence consistent with AI-generated content.',
      color: colors.error || '#EF4444',
    },
    SCREEN: {
      icon: '🖥',
      title: 'Screen Recapture Detected',
      subtitle: 'This image appears to be a photograph of content displayed on a digital screen. The authenticity of the original displayed content cannot be determined from this capture alone.',
      color: '#8B5CF6',
    },
  };

  // ── Determine which badge to show ──────────────────────────────
  // Priority:
  //   1. In verify mode + mlAnalysis available → use mlFlag (ML classification is primary)
  //   2. In capture mode → use evaluatedFlag (sensor proof is primary)
  //   3. Fallback → evaluatedFlag
  //
  // This ensures the highlighted class always matches the actual backend prediction.
  let activeFlagKey;
  if (!isCaptureMode && mlFlag) {
    // Verify mode: ML classification is the primary result
    // (The image has no sensor telemetry — only visual/EXIF forensics are available)
    activeFlagKey = mlFlag;
  } else {
    // Capture mode: sensor proof is primary
    // Override with ML screen classification if screen is strongly detected
    // (phone photographing screen would have valid sensor data)
    if (mlFlag === 'SCREEN') {
      activeFlagKey = 'SCREEN';
    } else {
      activeFlagKey = evaluatedFlag;
    }
  }

  const activeBadge = badgeConfig[activeFlagKey] || badgeConfig.YELLOW;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Header
        title="Result"
        theme={theme}
        onBack={() => navigation.navigate('Home')}
      />

      <View style={styles.content}>
        {/* Status Badge */}
        <View style={styles.statusBadge}>
          <View style={[styles.statusIconCircle, { backgroundColor: activeBadge.color }]}>
            <Text style={styles.statusIcon}>{activeBadge.icon}</Text>
          </View>
          <Text style={styles.statusTitle}>{activeBadge.title}</Text>
          <Text style={styles.statusSubtitle}>{activeBadge.subtitle}</Text>
          <View style={[styles.auraFlag, { backgroundColor: activeBadge.color }]}>
            <Text style={styles.auraFlagText}>
              {activeFlagKey === 'SCREEN'
                ? 'SCREEN RECAPTURE'
                : (mlClassification && !isCaptureMode
                    ? `ML: ${mlClassification}`
                    : `A.U.R.A. FLAG: ${evaluatedFlag}`
                  )
              }
            </Text>
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

                {/* Quick Stats */}
        <View style={styles.statsRow}>
          <Card theme={theme} style={styles.statCard}>
            <Text style={[styles.statValue, { color: isCaptureMode || isHashMatch ? colors.text : colors.error }]}>
              {statHashMatch}
            </Text>
            <Text style={styles.statLabel}>Hash Match</Text>
          </Card>
          <Card theme={theme} style={styles.statCard}>
            <Text style={[styles.statValue, { color: (verification.sensorValidationStatus === 'passed' || verification.sensorValidation === 'passed') ? colors.authentic : colors.error }]}>
              {(verification.sensorValidationStatus === 'passed' || verification.sensorValidation === 'passed') ? '✓' : '✗'}
            </Text>
            <Text style={styles.statLabel}>Sensors</Text>
          </Card>
        </View>

        {/* Details */}
        <SectionTitle title="DETAILS" theme={theme} />
        <Card theme={theme}>
          <MetadataItem label="File" value={displayFileName} theme={theme} />
          <MetadataItem label="Timestamp" value={verification.timestamp ? new Date(verification.timestamp).toLocaleString() : new Date().toLocaleString()} theme={theme} />
          <MetadataItem 
            label="Hash Match" 
            value={displayHashMatch} 
            theme={theme} 
          />
          <MetadataItem label="Metadata" value={verification.metadataConsistency || (isCaptureMode ? 'Consistent' : 'Unregistered')} theme={theme} isLast />
        </Card>

        {/* SHA-256 Hash Card with explicit vertical padding and margin */}
        {fileHash ? (
          <View style={styles.hashSection}>
            <SectionTitle title="SHA-256 HASH" theme={theme} />
            <Card theme={theme} style={styles.hashCard}>
              <Text style={styles.hashText} selectable>{fileHash}</Text>
            </Card>
          </View>
        ) : null}

        {/* A.U.R.A. Defense Report with clean section margin */}
        <View style={styles.sectionBlock}>
          <SectionTitle title="DEFENSE REPORT" theme={theme} />
          <Card theme={theme}>
            <DefenseRow 
              label="Screen Attack Defense" 
              status={screenPassed} 
              details={
                verification.screenDefense?.details || (screenPassed ? "No display signatures found (Ambient lighting & magnetic baseline verified)" : "Screen replay signature detected")
              }
              theme={theme} 
            />
            <View style={styles.divider} />
            <DefenseRow 
              label="Physics Consistency" 
              status={physicsPassed} 
              details={
                verification.physicsDefense?.details || (physicsPassed ? "Handheld micro-tremors verified" : "Handheld micro-tremors missing or inconsistent")
              }
              theme={theme} 
            />
            <View style={styles.divider} />
            <DefenseRow 
              label="Spatiotemporal Seal" 
              status={Boolean(verification.locationValid && verification.timestampValid)} 
              details={
                (verification.locationValid && verification.timestampValid)
                  ? `Capture Duration: ${((verification.duration || 1000)/1000).toFixed(1)}s (Location & Time Sealed)`
                  : `Spatiotemporal seal unverified${!verification.locationValid ? ' (Location missing)' : ''}${!verification.timestampValid ? ' (Timing inconsistent)' : ''}`
              }
              theme={theme} 
            />
          </Card>
        </View>

        {/* ML Metadata Analysis with clear top spacing */}
        <View style={styles.sectionBlock}>
          <SectionTitle title="ML METADATA ANALYSIS" theme={theme} />
          <MLScoreCard
            analysis={mlAnalysis}
            isLoading={false}
            theme={theme}
          />
        </View>

        {/* Physical Evidence — EXIF Fingerprint */}
        <SectionTitle title="PHYSICAL EVIDENCE" theme={theme} />
        <EvidenceCard
          fingerprint={physicalFingerprint}
          theme={theme}
        />

        {/* Sensor Metrics */}
        {verification.sensorStats && (
          <>
            <SectionTitle title="AVERAGE SENSOR METRICS" theme={theme} />
            <Card theme={theme}>
              <MetadataItem 
                label="Magnetometer" 
                value={`${verification.sensorStats.magnetometer?.avg?.toFixed(1) || 0}µT (±${verification.sensorStats.magnetometer?.spread?.toFixed(1) || 0})`} 
                theme={theme} 
              />
              <MetadataItem 
                label="Environment Light" 
                value={`${verification.sensorStats.light?.avg?.toFixed(1) || 0} Lux (RelVar: ${verification.sensorStats.light?.relativeVariance?.toFixed(2) || 0})`} 
                theme={theme} 
              />
              <MetadataItem 
                label="Applied Physics" 
                value={`${verification.sensorStats.accelerometer?.avg?.toFixed(2) || 0} G (Var: ${verification.sensorStats.accelerometer?.spread?.toFixed(4) || 0})`} 
                theme={theme} 
                isLast
              />
            </Card>
          </>
        )}

        {/* Verification QR */}
        <SectionTitle title="VERIFICATION PASS" theme={theme} />
        <Card theme={theme} style={styles.qrCard}>
          <QrCode
            value={proof.hash || proof.id || 'AURA-NO-PROOF'}
            theme={theme}
          />
          <Text style={styles.qrDesc}>Scan to verify this proof's SHA-256 hash</Text>
        </Card>

        {/* Validation Ledger */}
        <SectionTitle title="VERIFICATION LEDGER" theme={theme} />
        <Card theme={theme}>
          <MetadataItem label="Proof ID" value={proof.id || '—'} theme={theme} />
          <MetadataItem label="Block Hash" value={proof.hash ? proof.hash.slice(0, 16) + '...' : (fileHash ? fileHash.slice(0, 16) + '...' : '—')} theme={theme} />
          <MetadataItem label="Sealing Status" value="COMMITTED" theme={theme} isLast />
        </Card>

        {/* Sensor Analysis Graphs */}
        {renderSensorAnalysis(sensorData, theme)}

        {/* Actions */}
        <Button
          title="Save to AURA Verified"
          onPress={handleSaveToGallery}
          variant="primary"
          size="large"
          theme={theme}
          style={{ marginTop: theme.spacing.md }}
        />
        <Button
          title="Share Verified Image"
          onPress={handleShareVerifiedImage}
          variant="secondary"
          size="large"
          theme={theme}
          style={{ marginTop: theme.spacing.xs }}
        />
        <Button
          title="Back to Home"
          onPress={() => navigation.navigate('Home')}
          variant="ghost"
          size="medium"
          theme={theme}
          style={{ marginTop: theme.spacing.xs }}
        />
      </View>
    </ScrollView>
  );
};
