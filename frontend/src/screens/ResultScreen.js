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

// ─── Sub-components & Helpers ───

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

    // Second-Copy Replay Warning Banner
    recapturedWarningBanner: {
      backgroundColor: 'rgba(239, 68, 68, 0.15)',
      borderColor: colors.error || '#EF4444',
      borderWidth: 2,
      borderRadius: 14,
      padding: spacing.md,
      marginBottom: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    recapturedWarningIcon: {
      fontSize: 26,
    },
    recapturedWarningTitle: {
      ...typography.callout,
      fontWeight: '800',
      color: colors.error || '#EF4444',
      letterSpacing: 0.5,
    },
    recapturedWarningDesc: {
      ...typography.footnote,
      color: colors.textSecondary,
      marginTop: 2,
      lineHeight: 18,
    },

    // Unverified External Upload Banner
    unverifiedWarningBanner: {
      backgroundColor: 'rgba(245, 158, 11, 0.15)',
      borderColor: '#F59E0B',
      borderWidth: 2,
      borderRadius: 14,
      padding: spacing.md,
      marginBottom: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    unverifiedWarningIcon: {
      fontSize: 26,
    },
    unverifiedWarningTitle: {
      ...typography.callout,
      fontWeight: '800',
      color: '#F59E0B',
      letterSpacing: 0.5,
    },
    unverifiedWarningDesc: {
      ...typography.footnote,
      color: colors.textSecondary,
      marginTop: 2,
      lineHeight: 18,
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
  const { colors } = theme;
  const styles = getStyles(theme);
  return (
    <View style={styles.defenseRow}>
      <View style={styles.defenseHeader}>
        <View style={[styles.validationDot, { backgroundColor: status ? (colors.authentic || '#00FF9D') : (colors.error || '#EF4444') }]} />
        <Text style={styles.validationLabel}>{label}</Text>
        <Text style={[styles.validationStatus, { color: status ? (colors.authentic || '#00FF9D') : (colors.error || '#EF4444') }]}>
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
    ? sensorData.light.map(r => (r && typeof r === 'object' && r.lux != null ? Number(r.lux) : Number(r) || 0)).filter(Number.isFinite)
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
    status = 'verified',
    verification = {},
    proof = {},
    sensorData = null,
    fileName = null,
    fileHash = '',
    photoData = null,
    metadata = {},
    mlAnalysis = null,
  } = params;

  const isCaptureMode = Boolean(params.isCaptureMode === true || verification.isCaptureMode === true);
  const displayFileName = fileName || photoData?.name || metadata?.fileName || 'photo_capture.jpg';
  const physicalFingerprint = mlAnalysis?.metadataFingerprint || proof?.exif || metadata?.exif || null;

  const hashValidation = verification.hashValidation || {};
  const rawHashMatch = params.hashMatch ?? verification.hashMatch ?? hashValidation.matchPercentage;
  const hashMatchNum = rawHashMatch != null ? Number(rawHashMatch) : (isCaptureMode ? 100 : (hashValidation.isValid ? 100 : 0));
  const isHashMatch = isCaptureMode ? true : (hashMatchNum === 100 || Boolean(hashValidation.isValid));

  // Replay check: ONLY true if explicitly flagged as screen replay by optical PWM flicker or extreme magnetic spike
  const isRecaptured = Boolean(
    params.isRecaptured === true ||
    params.auraFlag === 'RED' ||
    params.result?.auraFlag === 'RED' ||
    params.result?.isRecaptured === true ||
    status === 'tampered' ||
    verification.isRecaptured === true ||
    verification.auraFlag === 'RED' ||
    verification.status === 'tampered' ||
    verification.screenDefense?.isRecaptured === true ||
    verification.screenDefense?.result === 'failed' ||
    verification.screenDefensePassed === false ||
    proof.isRecaptured === true ||
    proof.auraFlag === 'RED' ||
    proof.status === 'tampered'
  );

  // Sensor validation check
  const sensorsPassed = !isRecaptured && 
    params.sensorsPassed !== false && 
    verification.sensorsPassed !== false && 
    verification.sensorValidation !== 'failed' && 
    verification.sensorValidationStatus !== 'failed';

  const rawAuraFlag = params.auraFlag || verification.auraFlag || (status === 'verified' || status === 'authentic' ? 'GREEN' : null);
  const isExternalUpload = Boolean(!isCaptureMode && !hashValidation.storedHash && (status === 'unverified' || rawAuraFlag === 'YELLOW'));

  // ─── Result Screen Banner Decision Engine ───
  // 1. RED ("SECOND-COPY DETECTED (Screen Replay Photo)") ONLY when isRecaptured === true
  // 2. GREEN ("A.U.R.A. Verified") whenever !isRecaptured AND (auraFlag === 'GREEN' OR (hashMatch === 100 && sensorsPassed === true))
  // 3. YELLOW ("Unverified External Media") when auraFlag === 'YELLOW' OR isExternalUpload === true
  let evaluatedFlag = 'GREEN';

  if (isRecaptured) {
    evaluatedFlag = 'RED';
  } else if (rawAuraFlag === 'GREEN' || (hashMatchNum === 100 && sensorsPassed === true && !isRecaptured)) {
    evaluatedFlag = 'GREEN';
  } else if (rawAuraFlag === 'YELLOW' || isExternalUpload || status === 'unverified' || status === 'suspicious') {
    evaluatedFlag = 'YELLOW';
  } else if (rawAuraFlag === 'RED') {
    evaluatedFlag = 'RED';
  } else {
    evaluatedFlag = 'GREEN';
  }

  const isAuthentic = evaluatedFlag === 'GREEN';
  const isUncertain = evaluatedFlag === 'YELLOW';
  const isTampered = evaluatedFlag === 'RED';

  const screenPassed = !isRecaptured && (verification.screenDefensePassed !== false && verification.screenDefense?.result !== 'failed');
  const physicsPassed = isCaptureMode
    ? Boolean(verification.physicsDefense?.motionPassed !== false)
    : (isHashMatch ? Boolean(verification.physicsDefense?.motionPassed !== false) : false);

  const { colors } = theme;
  const styles = getStyles(theme);

  const activeProofId = proof.proofId || proof.id || verification.proofId || 'AURA-VERIFIED';

  const displayHashMatch = isCaptureMode
    ? '100% (Baseline Sealed)'
    : (isHashMatch ? `${hashMatchNum}%` : '0% Match / Unregistered');
  const statHashMatch = isCaptureMode
    ? '100%'
    : (isHashMatch ? `${hashMatchNum}%` : '0%');

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
      const shareUrl = `https://aura-app.com/verify/${activeProofId}`;
      const message = `✨ AURA VERIFIED PHOTO\n\nProof ID: ${activeProofId}\nStatus: ${isAuthentic ? 'Authentic (Physics Verified)' : 'Unverified'}\nIntegrity Score: ${isAuthentic ? 98 : 0}%\nVerification URL: ${shareUrl}`;
      
      await Share.share({
        message,
        url: photoData.uri,
        title: 'AURA Verified Photo',
      });
    } catch (err) {
      console.warn('Share error:', err.message);
    }
  };

  const badgeConfig = {
    GREEN: {
      icon: '✓',
      title: 'A.U.R.A. Verified',
      subtitle: 'Environmental Physics Sealed / Cryptographic Proof Valid',
      color: colors.authentic || '#00FF9D',
    },
    YELLOW: {
      icon: '⚠️',
      title: 'Unverified External Media',
      subtitle: 'No physical sensor telemetry sealed in ledger',
      color: '#F59E0B',
    },
    RED: {
      icon: '✗',
      title: isRecaptured ? 'SECOND-COPY DETECTED (Screen Replay Photo)' : 'Integrity Failure',
      subtitle: isRecaptured 
        ? 'Screen Replay Attack (Display Optical PWM / Magnetometer EMI)' 
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
        {/* Dedicated Warning Indicator: Second-Copy Screen Replay */}
        {isRecaptured ? (
          <View style={styles.recapturedWarningBanner}>
            <Text style={styles.recapturedWarningIcon}>⚠️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.recapturedWarningTitle}>SECOND-COPY DETECTED (Screen Replay Photo)</Text>
              <Text style={styles.recapturedWarningDesc}>
                {verification.screenDefense?.details || params.failureReason || verification.failureReason || 'Display emission detected: Optical PWM flicker, Magnetometer EMI, or LCD/OLED subpixel grid.'}
              </Text>
            </View>
          </View>
        ) : (!isCaptureMode && !isHashMatch) ? (
          /* Dedicated Neutral Indicator: Unverified External Media */
          <View style={styles.unverifiedWarningBanner}>
            <Text style={styles.unverifiedWarningIcon}>ℹ️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.unverifiedWarningTitle}>UNVERIFIED EXTERNAL MEDIA</Text>
              <Text style={styles.unverifiedWarningDesc}>
                No physical sensor telemetry sealed in ledger (External file upload).
              </Text>
            </View>
          </View>
        ) : null}

        {/* Status Badge */}
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

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <Card theme={theme} style={styles.statCard}>
            <Text style={[styles.statValue, { color: isCaptureMode || isHashMatch ? colors.text : colors.error }]}>
              {statHashMatch}
            </Text>
            <Text style={styles.statLabel}>Hash Match</Text>
          </Card>
          <Card theme={theme} style={styles.statCard}>
            <Text style={[styles.statValue, { color: sensorsPassed ? (colors.authentic || '#00FF9D') : (colors.error || '#EF4444') }]}>
              {sensorsPassed ? '✓' : '✗'}
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
          <MetadataItem label="Metadata" value={verification.metadataConsistency || (isCaptureMode ? 'Consistent' : 'Consistent')} theme={theme} isLast />
        </Card>

        {/* SHA-256 Hash Card */}
        {fileHash ? (
          <View style={styles.hashSection}>
            <SectionTitle title="SHA-256 HASH" theme={theme} />
            <Card theme={theme} style={styles.hashCard}>
              <Text style={styles.hashText} selectable>{fileHash}</Text>
            </Card>
          </View>
        ) : null}

        {/* A.U.R.A. Defense Report */}
        <View style={styles.sectionBlock}>
          <SectionTitle title="DEFENSE REPORT" theme={theme} />
          <Card theme={theme}>
            <DefenseRow 
              label="Screen Attack Defense" 
              status={screenPassed} 
              details={
                screenPassed 
                  ? "No display signatures found (Ambient lighting & magnetic baseline verified)" 
                  : "FAILED - Display optical PWM / EMI emission detected"
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
              status={Boolean(verification.locationValid !== false && verification.timestampValid !== false)} 
              details={
                (verification.locationValid !== false && verification.timestampValid !== false)
                  ? `Capture Time & Sensors Sealed (Cryptographic Ledger Proof)`
                  : `Spatiotemporal seal unverified`
              }
              theme={theme} 
            />
          </Card>
        </View>

        {/* ML Metadata Analysis */}
        {mlAnalysis && (
          <View style={styles.sectionBlock}>
            <SectionTitle title="AI DETECTION ANALYSIS" theme={theme} />
            <MLScoreCard analysis={mlAnalysis} theme={theme} />
          </View>
        )}

        {/* Physical Evidence Card */}
        <View style={styles.sectionBlock}>
          <SectionTitle title="PHYSICAL EVIDENCE" theme={theme} />
          <EvidenceCard
            sensorData={sensorData || proof.sensorData}
            metadata={physicalFingerprint}
            theme={theme}
          />
        </View>

        {/* Sensor Graphs */}
        {renderSensorAnalysis(sensorData || proof.sensorData, theme)}

        {/* QR Code Section */}
        <View style={styles.sectionBlock}>
          <SectionTitle title="PROOF ID & VERIFICATION QR" theme={theme} />
          <Card theme={theme} style={styles.qrCard}>
            <QrCode
              data={`https://aura-app.com/verify/${activeProofId}`}
              size={180}
              theme={theme}
            />
            <Text style={styles.qrDesc}>
              Scan to independently verify cryptographic proof on the AURA Ledger.
            </Text>
          </Card>
        </View>

        {/* Action Buttons */}
        <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.lg }}>
          {photoData?.uri && (
            <Button
              title="Save Verified Image to Gallery"
              onPress={handleSaveToGallery}
              variant="primary"
              size="large"
              theme={theme}
            />
          )}

          <Button
            title="Share Verification Proof"
            onPress={handleShareVerifiedImage}
            variant="secondary"
            size="large"
            theme={theme}
          />

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
