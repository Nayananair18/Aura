import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../components/Button';
import { Card, SectionTitle } from '../components/Card';
import { Header } from '../components/Header';
import { LoadingSpinner } from '../components/Indicators';
import { analyzeImageMetadata, storeVerificationResult, verifyMedia, verifyProofId } from '../services/api';
import * as FileService from '../services/fileService';

// ─── Helpers & Styles ───

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

    // Tabs
    tabRow: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 4,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tabButton: {
      flex: 1,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      borderRadius: 8,
    },
    tabActive: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.accent,
    },
    tabText: {
      ...typography.footnote,
      fontWeight: '600',
      color: colors.textMuted,
    },
    tabTextActive: {
      color: colors.accent,
    },

    // Upload Area
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

    // Form Input
    inputLabel: {
      ...typography.footnote,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
      fontWeight: '600',
    },
    textInput: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: spacing.md,
      color: colors.text,
      fontFamily: 'monospace',
      fontSize: 16,
      marginBottom: spacing.md,
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
  const [activeTab, setActiveTab] = useState('upload'); // 'upload' | 'proofId'
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyStep, setVerifyStep] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [proofIdInput, setProofIdInput] = useState('');
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

  /**
   * Helper to sanitize and normalize Proof ID from URL or raw string
   * Uses broadened regex to capture full 4-block hex pattern (e.g. AURA-4555-B6F6-2449-D419)
   */
  const extractProofId = (text) => {
    if (!text || typeof text !== 'string') return '';
    let clean = text.trim();
    if (clean.includes('/verify/')) {
      const parts = clean.split('/verify/');
      clean = parts[parts.length - 1].trim();
    } else if (clean.includes('/')) {
      const parts = clean.split('/');
      clean = parts[parts.length - 1].trim();
    }
    
    // Clean string of non-alphanumeric except hyphen
    clean = clean.replace(/[^A-Za-z0-9-]/g, '').toUpperCase();

    // 1. Broad 4-block standard hex format: AURA-HHHH-HHHH-HHHH-HHHH
    const fourBlockAura = clean.match(/AURA-([A-F0-9]{4}-){3}[A-F0-9]{4}/i);
    if (fourBlockAura) return fourBlockAura[0].toUpperCase();

    // 2. Unprefixed 4-block hex format: HHHH-HHHH-HHHH-HHHH
    const fourBlockRaw = clean.match(/^([A-F0-9]{4}-){3}[A-F0-9]{4}$/i);
    if (fourBlockRaw) return `AURA-${fourBlockRaw[0].toUpperCase()}`;

    // 3. Dynamic block matching
    const multiBlockAura = clean.match(/AURA-([A-Za-z0-9]{4}-)+[A-Za-z0-9]{4}/i);
    if (multiBlockAura) return multiBlockAura[0].toUpperCase();

    // 4. Any AURA- prefix match
    const anyAura = clean.match(/AURA-[A-Za-z0-9_-]+/i);
    if (anyAura) return anyAura[0].toUpperCase();

    // 5. Fallback for raw unprefixed manual string
    if (clean.length >= 8 && !clean.startsWith('AURA-')) {
      return `AURA-${clean}`;
    }

    return clean;
  };

  /**
   * Centralized Unified Verification Entry Point
   * Handles Upload, Proof ID, and QR Scanner/Gallery methods seamlessly
   */
  const handleUnifiedVerify = async (overrides = {}) => {
    const targetFile = overrides.uploadedFile || (activeTab === 'upload' ? uploadedFile : null);
    
    let rawProofId = overrides.proofId;
    if (!rawProofId && activeTab === 'proofId') {
      rawProofId = proofIdInput;
    }

    const cleanInputId = (rawProofId || '').trim().toUpperCase().replace(/\s+/g, '');
    const targetProofId = extractProofId(cleanInputId);

    if (activeTab === 'proofId' && cleanInputId) {
      console.log('[MANUAL LOOKUP]', cleanInputId, '-> Normalized:', targetProofId);
    }

    if (!targetFile && !targetProofId) {
      Alert.alert('Required', 'Please pick an image file or enter a Proof ID.');
      return;
    }

    try {
      setIsVerifying(true);
      setError(null);

      // Branch 1: Direct Proof ID Lookup
      if (targetProofId && !targetFile) {
        setVerifyStep('Looking up Proof ID in ledger...');
        const result = await verifyProofId(targetProofId);

        if (!result || result.success === false || result.proofFound === false || result.status === 404) {
          setIsVerifying(false);
          setVerifyStep('');
          const msg = result?.message || `Proof ID "${targetProofId}" was not found in the ledger.`;
          setError(msg);
          Alert.alert('Proof Not Found', msg);
          return;
        }

        const verification = result?.verification || result;
        const proofData = result?.proof || verification?.proofDetails || { id: targetProofId, proofId: targetProofId };

        navigation.navigate('Result', {
          status: result.status || verification?.status || (result.auraFlag === 'GREEN' ? 'verified' : 'tampered'),
          verification: verification,
          proof: proofData,
          auraFlag: result.auraFlag || verification?.auraFlag || 'GREEN',
          hashMatch: result.hashMatch ?? verification?.hashMatch ?? 100,
          sensorsPassed: result.sensorsPassed ?? verification?.sensorsPassed ?? true,
          aiProbability: result.aiProbability ?? verification?.aiProbability ?? 0.02,
          sensorData: verification?.sensorMetrics || proofData?.sensorData || proofData?.sensorMetrics || null,
          fileHash: verification?.hashValidation?.storedHash || proofData?.imageHash || proofData?.sha256Hash || proofData?.hash,
          fileName: targetProofId || 'AURA Proof Verification',
          photoData: (proofData?.imageData || verification?.proofDetails?.imageData)
            ? { uri: `data:image/jpeg;base64,${proofData?.imageData || verification?.proofDetails?.imageData}`, name: targetProofId } 
            : null,
          mlAnalysis: null,
          isCaptureMode: false,
        });
        return;
      }

      // Branch 2: File Upload Verification
      let fileHash = null;
      let base64Image = null;

      if (targetFile) {
        setVerifyStep('Computing cryptographic hash...');
        fileHash = await FileService.hashFile(targetFile.uri);

        setVerifyStep('Extracting metadata fingerprint...');
        const FILE_SIZE_LIMIT_FOR_ML = 10 * 1024 * 1024;
        if (targetFile.fullSize <= FILE_SIZE_LIMIT_FOR_ML) {
          try {
            base64Image = await FileService.getFileAsBase64(targetFile.uri);
          } catch (b64Err) {
            console.warn('[Verify] Could not read base64:', b64Err.message);
          }
        }
      }

      setVerifyStep('Querying AURA Proof Ledger & verifying physics...');
      const metadataPayload = {
        fileName: targetFile?.name || targetProofId || 'proof_verification.jpg',
        fileType: targetFile?.type || 'image/jpeg',
        fileSize: targetFile?.fullSize || null,
        uploadedAt: new Date().toISOString(),
      };

      const [result, mlResponse] = await Promise.all([
        verifyMedia(
          fileHash,
          metadataPayload,
          fileHash,
          targetProofId
        ),
        base64Image
          ? analyzeImageMetadata(base64Image, targetFile.name, targetFile.type)
          : Promise.resolve({ success: false, analysis: null }),
      ]);

      if (!result || result.success === false || result.proofFound === false || result.status === 404) {
        setIsVerifying(false);
        setVerifyStep('');
        const msg = result?.message || `Verification failed: Media was not found in the ledger.`;
        setError(msg);
        Alert.alert('Proof Not Found', msg);
        return;
      }

      const verification = result?.verification || result;
      const proofData = result?.proof || verification?.proofDetails || { id: targetProofId };

      setVerifyStep('Recording verification result...');
      if (fileHash || verification?.proofId) {
        try {
          await storeVerificationResult(
            fileHash || verification?.proofId,
            verification,
            metadataPayload
          );
        } catch (storeErr) {
          console.warn('[VerificationScreen] Store verification result warning:', storeErr.message);
        }
      }

      navigation.navigate('Result', {
        status: result.status || verification?.status || (result.auraFlag === 'GREEN' ? 'verified' : (verification?.auraFlag === 'YELLOW' ? 'unverified' : 'tampered')),
        verification: verification,
        proof: proofData,
        auraFlag: result.auraFlag || verification?.auraFlag || 'GREEN',
        hashMatch: result.hashMatch ?? verification?.hashMatch ?? (result.status === 'verified' || result.status === 'authentic' ? 100 : 0),
        sensorsPassed: result.sensorsPassed ?? verification?.sensorsPassed ?? true,
        aiProbability: result.aiProbability ?? verification?.aiProbability ?? (mlResponse?.analysis?.aiProbability ?? 0.02),
        sensorData: verification?.sensorMetrics || proofData?.sensorData || null,
        fileHash: fileHash || verification?.hashValidation?.storedHash || proofData?.imageHash || proofData?.hash,
        fileName: targetFile?.name || targetProofId || 'AURA Proof Verification',
        photoData: (proofData?.imageData || verification?.proofDetails?.imageData)
          ? { uri: `data:image/jpeg;base64,${proofData?.imageData || verification?.proofDetails?.imageData}`, name: targetProofId || 'Verified Capture' } 
          : (targetFile ? { uri: targetFile.uri, name: targetFile.name, size: targetFile.fullSize } : null),
        mlAnalysis: mlResponse?.analysis || verification?.mlAnalysis || null,
        isCaptureMode: false,
      });
    } catch (err) {
      console.error('Error verifying media:', err);
      const errMsg = err?.response?.data?.message || err?.message || 'Verification failed. Please try again.';
      setError(errMsg);
      Alert.alert('Verification Failed', errMsg);
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

        {/* Tab Switcher */}
        <View style={styles.tabRow}>
          <Pressable
            onPress={() => setActiveTab('upload')}
            style={[styles.tabButton, activeTab === 'upload' && styles.tabActive]}
          >
            <Text style={[styles.tabText, activeTab === 'upload' && styles.tabTextActive]}>📁 Upload</Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab('proofId')}
            style={[styles.tabButton, activeTab === 'proofId' && styles.tabActive]}
          >
            <Text style={[styles.tabText, activeTab === 'proofId' && styles.tabTextActive]}>🔑 Proof ID</Text>
          </Pressable>
        </View>

        {/* Tab 1: Upload Photo */}
        {activeTab === 'upload' && (
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
                <Text style={styles.uploadIcon}>📷</Text>
                <Text style={styles.uploadTitle}>Verify Photo</Text>
                <Text style={styles.uploadHint}>Upload photo to validate A.U.R.A. seal</Text>
              </View>
            )}
          </Pressable>
        )}

        {/* Tab 2: Enter Proof ID */}
        {activeTab === 'proofId' && (
          <Card theme={theme}>
            <Text style={styles.inputLabel}>ENTER AURA PROOF ID</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. AURA-4555-B6F6-2449-D419"
              placeholderTextColor={theme.colors.textMuted}
              value={proofIdInput}
              onChangeText={(txt) => setProofIdInput(txt.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <Text style={styles.uploadHint}>
              Enter the Proof ID from the lower banner of any shared AURA photo.
            </Text>
          </Card>
        )}

        {/* Protocol Checks Summary */}
        <SectionTitle title="A.U.R.A. PROTOCOL CHECKS" theme={theme} />
        <Card theme={theme}>
          <CheckRow icon="🔬" label="Environmental Physics" desc="Check light/magnetic consistency" theme={theme} />
          <View style={styles.divider} />
          <CheckRow icon="⏱️" label="Spatiotemporal Seal" desc="Verify capture location and time" theme={theme} />
          <View style={styles.divider} />
          <CheckRow icon="🔐" label="Cryptographic Match" desc="Validate SHA-256 seal integrity" theme={theme} />
        </Card>

        {/* Verifying Spinner */}
        {isVerifying && (
          <Card theme={theme} style={{ marginTop: theme.spacing.md }}>
            <View style={styles.verifyingRow}>
              <LoadingSpinner theme={theme} size={24} />
              <Text style={styles.verifyingText}>{verifyStep || 'Running verification checks...'}</Text>
            </View>
          </Card>
        )}

        {/* Actions */}
        <Button
          title={isVerifying ? 'Verifying...' : 'Verify Media Authenticity'}
          onPress={() => handleUnifiedVerify()}
          variant="primary"
          size="large"
          theme={theme}
          loading={isVerifying}
          disabled={isVerifying}
          style={{ marginTop: theme.spacing.lg }}
        />
      </View>
    </ScrollView>
  );
};
