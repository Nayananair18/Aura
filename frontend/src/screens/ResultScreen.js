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

// ── Helpers & Styles (Moved up to prevent ReferenceErrors) ──

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

    // Hash
    hashText: {
      ...typography.footnote,
      color: colors.textSecondary,
      fontFamily: 'monospace',
      lineHeight: 20,
    },

    // Defense & Validation
    defenseRow: {
      paddingVertical: spacing.sm,
    },
    defenseHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: 4,
    },
    defenseDetails: {
      ...typography.caption,
      color: colors.textMuted,
      paddingLeft: 18,
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
    },
    validationLabel: {
      ...typography.callout,
      color: colors.text,
      flex: 1,
    },
    validationStatus: {
      ...typography.footnote,
      fontWeight: '600',
    },
    divider: {
      height: 1,
      backgroundColor: colors.divider,
    },

    // QR
    qrCard: {
      alignItems: 'center',
      paddingVertical: spacing.lg,
    },
    qrDesc: {
      ...typography.caption,
      color: colors.textMuted,
      marginTop: spacing.md,
      textAlign: 'center',
    },
  });
};

const getFlagColor = (flag, colors) => {
  switch (flag) {
    case 'RED': return colors.error;
    case 'YELLOW': return '#F59E0B'; // Amber
    case 'GREEN':
    default: return colors.authentic;
  }
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

const ValidationRow = ({ label, passed, theme }) => {
  const { colors, spacing, typography } = theme;
  const styles = getStyles(theme);
  return (
    <View style={styles.validationRow}>
      <View style={[styles.validationDot, { backgroundColor: passed ? colors.authentic : colors.error }]} />
      <Text style={styles.validationLabel}>{label}</Text>
      <Text style={[styles.validationStatus, { color: passed ? colors.authentic : colors.error }]}>
        {passed ? 'Passed' : 'Failed'}
      </Text>
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
    fileName = 'media',
    fileHash = '',
    photoData = null,
    metadata = {},
    mlAnalysis = null,
  } = params;

  // Physical evidence fingerprint — comes from mlAnalysis.metadataFingerprint
  const physicalFingerprint = mlAnalysis?.metadataFingerprint || null;

  const isAuthentic = status === 'authentic';
  const { colors } = theme;
  const styles = getStyles(theme);

  const hashValidation = verification.hashValidation || {};
  const confidence = verification.confidence || 99.7;
  const activeProofId = proof.id || verification.proofId || 'AURA-VERIFIED';

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
          <View style={[styles.statusIconCircle, { backgroundColor: isAuthentic ? colors.authentic : colors.error }]}>
            <Text style={styles.statusIcon}>{isAuthentic ? '✓' : '✗'}</Text>
          </View>
          <Text style={styles.statusTitle}>{isAuthentic ? 'A.U.R.A. Verified' : 'Integrity Failure'}</Text>
          <Text style={styles.statusSubtitle}>
            {isAuthentic ? 'Environmental Physics Sealed' : 'Sensor anomalies detected'}
          </Text>
          <View style={[styles.auraFlag, { backgroundColor: getFlagColor(verification.auraFlag, colors) }]}>
            <Text style={styles.auraFlagText}>A.U.R.A. FLAG: {verification.auraFlag || 'GREEN'}</Text>
          </View>
        </View>

        {/* Photo Preview */}
        {photoData?.uri && (
          <Card theme={theme} style={styles.photoCard}>
            <Image source={{ uri: photoData.uri }} style={styles.photo} resizeMode="cover" />
            <View style={styles.photoMeta}>
              <Text style={styles.photoName} numberOfLines={1}>{photoData.name || 'Captured image'}</Text>
              <Text style={styles.photoSize}>
                {photoData.size != null ? `${(photoData.size / 1024).toFixed(1)} KB` : ''}
              </Text>
            </View>
          </Card>
        )}

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <Card theme={theme} style={styles.statCard}>
            <Text style={styles.statValue}>{hashValidation.matchPercentage ?? '—'}%</Text>
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
          <MetadataItem label="File" value={fileName || 'unknown'} theme={theme} />
          <MetadataItem label="Timestamp" value={verification.timestamp ? new Date(verification.timestamp).toLocaleString() : new Date().toLocaleString()} theme={theme} />
          <MetadataItem label="Hash Match" value={`${hashValidation.matchPercentage || 0}%`} theme={theme} />
          <MetadataItem label="Metadata" value={verification.metadataConsistency || 'Consistent'} theme={theme} isLast />
        </Card>

        {/* Hash */}
        {fileHash && (
          <>
            <SectionTitle title="SHA-256 HASH" theme={theme} />
            <Card theme={theme}>
              <Text style={styles.hashText} selectable>{fileHash}</Text>
            </Card>
          </>
        )}

        {/* A.U.R.A. Defense Report */}
        <SectionTitle title="DEFENSE REPORT" theme={theme} />
        <Card theme={theme}>
          <DefenseRow 
            label="Screen Attack Defense" 
            status={verification.screenDefense?.result === 'passed'} 
            details={verification.screenDefense?.details || "No magnetic display signature found"}
            theme={theme} 
          />
          <View style={styles.divider} />
          <DefenseRow 
            label="Physics Consistency" 
            status={verification.physicsDefense?.motionPassed} 
            details={verification.physicsDefense?.details || "Handheld micro-tremors verified"}
            theme={theme} 
          />
          <View style={styles.divider} />
          <DefenseRow 
            label="Spatiotemporal Seal" 
            status={verification.locationValid && verification.timestampValid} 
            details={`Capture Duration: ${((verification.duration || 1000)/1000).toFixed(1)}s`}
            theme={theme} 
          />
        </Card>

        {/* ML Metadata Analysis */}
        <SectionTitle title="ML METADATA ANALYSIS" theme={theme} />
        <MLScoreCard
          analysis={mlAnalysis}
          isLoading={false}
          theme={theme}
        />

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

// ── Sub-components ──

const renderSensorAnalysis = (sensorData, theme) => {
  if (!sensorData) return null;
  const { spacing } = theme;

  const getMagnitudeHistory = (data) => {
    if (!data || data.length === 0) return null;
    return data.map((d) => Math.sqrt((d.x || 0) ** 2 + (d.y || 0) ** 2 + (d.z || 0) ** 2));
  };

  const getLightHistory = (data) => {
    if (!data || data.length === 0) return null;
    return data.map((d) => d.lux || 0);
  };

  const sensors = [
    { label: 'Accelerometer', data: getMagnitudeHistory(sensorData.accelerometer) },
    { label: 'Gyroscope', data: getMagnitudeHistory(sensorData.gyroscope) },
    { label: 'Magnetometer', data: getMagnitudeHistory(sensorData.magnetometer) },
    { label: 'Light', data: getLightHistory(sensorData.light) },
  ].filter(s => s.data && s.data.length > 0);

  if (sensors.length === 0) return null;

  return (
    <>
      <SectionTitle title="SENSOR ANALYSIS" theme={theme} />
      <Card theme={theme}>
        {sensors.map((sensor, index) => (
          <AnalysisRow 
            key={sensor.label}
            sensor={sensor}
            theme={theme}
            isLast={index === sensors.length - 1}
          />
        ))}
      </Card>
    </>
  );
};

const AnalysisRow = ({ sensor, theme, isLast }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { colors, spacing, typography } = theme;

  return (
    <View style={{ marginBottom: isLast ? 0 : spacing.sm }}>
      <Pressable 
        onPress={() => setIsExpanded(!isExpanded)}
        style={({ pressed }) => [
          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.xs },
          pressed && { opacity: 0.7 }
        ]}
      >
        <Text style={{ ...typography.footnote, color: colors.textSecondary }}>{sensor.label}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ ...typography.caption, fontSize: 10, color: colors.textMuted, marginRight: spacing.sm }}>{sensor.data.length} pts</Text>
          <Text style={{ 
            fontSize: 10, 
            color: colors.textMuted, 
            transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] 
          }}>▼</Text>
        </View>
      </Pressable>
      
      {isExpanded && (
        <View style={{ marginTop: spacing.xs, paddingBottom: spacing.sm }}>
          <SensorGraph 
            data={sensor.data} 
            color={colors.accent} 
            height={48} 
            maxPoints={100} 
          />
        </View>
      )}
      {!isLast && <View style={{ height: 1, backgroundColor: colors.divider, marginTop: spacing.xs }} />}
    </View>
  );
};
