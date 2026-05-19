import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Card, SectionTitle } from '../components/Card';
import { Header } from '../components/Header';
import { LoadingSpinner } from '../components/Indicators';
import { analyzeImageMetadata, storeVerificationResult, verifyMedia } from '../services/api';
import * as FileService from '../services/fileService';
import * as FileSystem from 'expo-file-system';

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

    // Upload
    uploadArea: {
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: colors.border,
      borderRadius: 16,
      padding: spacing.xl,
      marginBottom: spacing.md,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    uploadAreaFilled: {
      borderStyle: 'solid',
      borderColor: colors.success,
      backgroundColor: colors.card,
      padding: spacing.lg,
    },
    uploadPlaceholder: {
      alignItems: 'center',
    },
    uploadIcon: {
      fontSize: 28,
      color: colors.accent,
      fontWeight: '700',
      marginBottom: spacing.sm,
    },
    uploadTitle: {
      ...typography.headline,
      color: colors.text,
      marginBottom: 4,
    },
    uploadHint: {
      ...typography.footnote,
      color: colors.textMuted,
    },
    fileInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      gap: spacing.md,
    },
    fileIconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.success + '20',
      justifyContent: 'center',
      alignItems: 'center',
    },
    fileCheck: {
      fontSize: 16,
      color: colors.success,
      fontWeight: '700',
    },
    fileName: {
      ...typography.callout,
      color: colors.text,
      fontWeight: '600',
    },
    fileSize: {
      ...typography.footnote,
      color: colors.textSecondary,
      marginTop: 1,
    },
    changeLink: {
      ...typography.footnote,
      color: colors.accent,
      fontWeight: '600',
    },

    // Checks
    checkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm + 2,
      gap: spacing.md,
    },
    checkIcon: {
      fontSize: 20,
    },
    checkLabel: {
      ...typography.callout,
      color: colors.text,
      fontWeight: '600',
    },
    checkDesc: {
      ...typography.footnote,
      color: colors.textSecondary,
      marginTop: 1,
    },
    divider: {
      height: 1,
      backgroundColor: colors.divider,
    },

    // Verifying
    verifyingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    verifyingText: {
      ...typography.callout,
      color: colors.textSecondary,
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

const CheckRow = ({ icon, label, desc, theme }) => {
  const styles = getStyles(theme);
  return (
    <View style={styles.checkRow}>
      <Text style={styles.checkIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.checkLabel}>{label}</Text>
        <Text style={styles.checkDesc}>{desc}</Text>
      </View>
    </View>
  );
};

export const VerificationScreen = ({ navigation, theme }) => {
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyStep, setVerifyStep] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [error, setError] = useState(null);

  const handleUpload = async () => {
    try {
      setError(null);
      const file = await FileService.pickFile();
      if (file) {
        setUploadedFile({
          name: file.name,
          size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
          type: file.mimeType,
          uri: file.uri,
          fullSize: file.size,
        });
      }
    } catch (err) {
      console.error('Error uploading file:', err);
      setError('Failed to pick file');
      Alert.alert('Error', 'Failed to pick file');
    }
  };

  const handleVerify = async () => {
    if (!uploadedFile) return;
    try {
      setIsVerifying(true);
      setError(null);

      // ── Step 1: Hash the file ──
      setVerifyStep('Computing cryptographic hash...');
      const fileHash = await FileService.hashFile(uploadedFile.uri);

      // ── Step 2: Read image as base64 for ML analysis ──
      // Skip if file > 10MB to avoid OOM on low-memory devices (base64 ≈ 13MB string)
      setVerifyStep('Extracting metadata fingerprint...');
      let base64Image = null;
      const FILE_SIZE_LIMIT_FOR_ML = 10 * 1024 * 1024; // 10 MB
      if (uploadedFile.fullSize <= FILE_SIZE_LIMIT_FOR_ML) {
        try {
          base64Image = await FileSystem.readAsStringAsync(uploadedFile.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
        } catch (b64Err) {
          console.warn('[Verify] Could not read base64:', b64Err.message);
        }
      } else {
        console.warn('[Verify] File > 10MB — skipping ML metadata analysis to prevent OOM');
      }

      // ── Step 3: Run hash verify + ML analysis in parallel ──
      setVerifyStep('Running A.U.R.A. & ML analysis...');
      const [result, mlResponse] = await Promise.all([
        verifyMedia(
          fileHash,
          { fileName: uploadedFile.name, fileType: uploadedFile.type, fileSize: uploadedFile.fullSize, uploadedAt: new Date().toISOString() },
          fileHash
        ),
        base64Image
          ? analyzeImageMetadata(base64Image, uploadedFile.name, uploadedFile.type)
          : Promise.resolve({ success: false, analysis: null }),
      ]);

      // ── Step 4: Store result ──
      setVerifyStep('Committing to ledger...');
      await storeVerificationResult(fileHash, result, { fileName: uploadedFile.name, timestamp: new Date().toISOString() });

      navigation.navigate('Result', {
        status: result.verification?.auraFlag === 'RED' ? 'tampered' : 'authentic',
        verification: result.verification,
        fileHash,
        fileName: uploadedFile.name,
        mlAnalysis: mlResponse?.analysis || null,
      });
    } catch (err) {
      console.error('Error verifying media:', err);
      setError('Verification failed. Please try again.');
      Alert.alert('Error', 'Failed to verify media');
    } finally {
      setIsVerifying(false);
      setVerifyStep('');
    }
  };

  const styles = getStyles(theme);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Header
        title="A.U.R.A. Validator"
        subtitle="Authenticate pixels using physics-backed proof"
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

        {/* Upload Area */}
        <Pressable
          onPress={handleUpload}
          disabled={isVerifying}
          style={({ pressed }) => [
            styles.uploadArea,
            uploadedFile && styles.uploadAreaFilled,
            pressed && { opacity: 0.8 },
          ]}
        >
          {uploadedFile ? (
            <View style={styles.fileInfo}>
              <View style={styles.fileIconCircle}>
                <Text style={styles.fileCheck}>✓</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fileName} numberOfLines={1}>{uploadedFile.name}</Text>
                <Text style={styles.fileSize}>{uploadedFile.size}</Text>
              </View>
              <Text style={styles.changeLink}>Change</Text>
            </View>
          ) : (
            <View style={styles.uploadPlaceholder}>
              <Text style={styles.uploadIcon}>🛡️</Text>
              <Text style={styles.uploadTitle}>Verify Authenticity</Text>
              <Text style={styles.uploadHint}>Upload photo to validate A.U.R.A. seal</Text>
            </View>
          )}
        </Pressable>

        {/* What We Check */}
        <SectionTitle title="A.U.R.A. PROTOCOL CHECKS" theme={theme} />
        <Card theme={theme}>
          <CheckRow icon="⚛️" label="Environmental Physics" desc="Check light/magnetic consistency" theme={theme} />
          <View style={styles.divider} />
          <CheckRow icon="🌌" label="Spatiotemporal Seal" desc="Verify capture location and time" theme={theme} />
          <View style={styles.divider} />
          <CheckRow icon="🔐" label="Cryptographic Match" desc="Validate SHA-256 seal integrity" theme={theme} />
        </Card>

        {/* Verifying */}
        {isVerifying && (
          <Card theme={theme}>
            <View style={styles.verifyingRow}>
              <LoadingSpinner theme={theme} size={24} />
              <Text style={styles.verifyingText}>{verifyStep || 'Running verification checks...'}</Text>
            </View>
          </Card>
        )}

        {/* Actions */}
        <Button
          title="Verify"
          onPress={handleVerify}
          variant="primary"
          size="large"
          theme={theme}
          style={{ marginTop: theme.spacing.sm }}
          disabled={!uploadedFile || isVerifying}
        />
        <Button
          title="Cancel"
          onPress={() => navigation.goBack()}
          variant="ghost"
          size="medium"
          theme={theme}
          style={{ marginTop: theme.spacing.xs }}
          disabled={isVerifying}
        />
      </View>
    </ScrollView>
  );
};
