import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { pingBackend } from '../services/api';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Header } from '../components/Header';
import * as Google from 'expo-auth-session/providers/google';
import * as GoogleDrive from '../services/googleDriveService';

export const HomeScreen = ({ navigation, theme }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [driveAuthenticated, setDriveAuthenticated] = useState(false);
  const styles = getStyles(theme);
  const { colors } = theme;

  const [request, response, promptAsync] = Google.useAuthRequest(
    GoogleDrive.getDriveAuthConfig()
  );

  useEffect(() => {
    const checkConnection = async () => {
      const result = await pingBackend();
      setIsConnected(result.status === 'connected');
      
      const driveAuth = await GoogleDrive.isAuthenticated();
      setDriveAuthenticated(driveAuth);
    };
    checkConnection();
  }, []);

  useEffect(() => {
    if (response) {
      console.log('\n[Google Auth] Session Response:', response.type);
      if (response.type === 'error') {
        console.error('[Google Auth] Error Details:', response.error);
      }
    }
    if (response?.type === 'success') {
      const { access_token } = response.params;
      GoogleDrive.storeAuthToken(access_token).then(() => {
        setDriveAuthenticated(true);
        console.log('[Google Auth] ✅ Login Successful');
      });
    }
  }, [response]);

  const handleDriveLogout = async () => {
    await GoogleDrive.logout();
    setDriveAuthenticated(false);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Header
        title="A.U.R.A."
        subtitle="The ISI Mark for Digital Reality"
        theme={theme}
      />

      <View style={styles.content}>
        {/* Status Bar */}
        <Card theme={theme} style={styles.statusBar}>
          <View style={[styles.statusDot, { backgroundColor: isConnected ? colors.success : colors.error }]} />
          <Text style={styles.statusText}>
            {isConnected ? 'Backend Connected' : 'Running in Offline/Mock Mode'}
          </Text>
        </Card>

        {/* Primary Actions */}
        <ActionCard
          icon="📷"
          title="Capture"
          description="Take a photo with sensor-backed proof"
          buttonTitle="Start Capture"
          onPress={() => navigation.navigate('Capture')}
          theme={theme}
          accent
        />

        {/* Cloud Storage */}
        <Text style={styles.sectionLabel}>CLOUD STORAGE</Text>
        <Card theme={theme}>
          <View style={[styles.actionRow, { paddingVertical: theme.spacing.sm }]}>
            <View style={styles.actionInfo}>
              <Text style={styles.actionIcon}>📁</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.actionTitle, { fontSize: 16 }]}>Google Drive</Text>
                <Text style={styles.actionDesc}>
                  {driveAuthenticated ? 'Connected. Photos will sync to Drive.' : 'Connect to automatically save photos.'}
                </Text>
              </View>
            </View>
            <Button
              title={driveAuthenticated ? "Disconnect" : "Connect"}
              variant={driveAuthenticated ? "ghost" : "primary"}
              size="small"
              onPress={() => driveAuthenticated ? handleDriveLogout() : promptAsync()}
              theme={theme}
            />
          </View>
        </Card>

        {/* How it Works  */}
        <Text style={styles.sectionLabel}>HOW IT WORKS</Text>

        <Card theme={theme}>
          <StepItem number="1" title="Secure Capture" desc="Extract raw telemetry from 6 sensors" theme={theme} />
          <View style={styles.stepDivider} />
          <StepItem number="2" title="On-Device ML" desc="Analyze physics patterns for consistency" theme={theme} />
          <View style={styles.stepDivider} />
          <StepItem number="3" title="Crypto Sealing" desc="Fuse media and sensors into SHA-256 seal" theme={theme} isLast />
        </Card>

        {/* 6 Sensors */}
        <Text style={styles.sectionLabel}>6 SENSORS</Text>

        <Card theme={theme}>
          <SensorInfo icon="💡" name="Light" desc="Ambient brightness (lux)" theme={theme} />
          <View style={styles.stepDivider} />
          <SensorInfo icon="📱" name="Accelerometer" desc="Device motion & orientation" theme={theme} />
          <View style={styles.stepDivider} />
          <SensorInfo icon="🔄" name="Gyroscope" desc="Device rotation tracking" theme={theme} />
          <View style={styles.stepDivider} />
          <SensorInfo icon="🧲" name="Magnetometer" desc="EM field (screen replay detection)" theme={theme} />
          <View style={styles.stepDivider} />
          <SensorInfo icon="📍" name="GPS" desc="Capture location coordinates" theme={theme} />
          <View style={styles.stepDivider} />
          <SensorInfo icon="⏱" name="Timestamp" desc="Exact capture time recording" theme={theme} />
        </Card>
      </View>
    </ScrollView>
  );
};

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

    // Status bar
    statusBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.lg,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.success,
      marginRight: spacing.sm,
    },
    statusText: {
      ...typography.footnote,
      color: colors.textSecondary,
    },

    // Action cards
    accentCard: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    actionInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: spacing.md,
    },
    actionIcon: {
      fontSize: 28,
    },
    actionTitle: {
      ...typography.headline,
      color: colors.text,
    },
    actionDesc: {
      ...typography.footnote,
      color: colors.textSecondary,
      marginTop: 2,
    },
    actionArrow: {
      fontSize: 20,
      color: colors.textMuted,
      marginLeft: spacing.sm,
    },
    whiteText: {
      color: '#FFFFFF',
    },
    whiteTextMuted: {
      color: 'rgba(255,255,255,0.75)',
    },

    // Section label
    sectionLabel: {
      ...typography.caption,
      color: colors.textMuted,
      marginBottom: spacing.sm,
      marginTop: spacing.md,
    },

    // Steps
    stepRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
    },
    stepDivider: {
      height: 1,
      backgroundColor: colors.divider,
      marginLeft: 44,
    },
    stepNumber: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
    },
    stepNumberText: {
      ...typography.footnote,
      color: colors.accent,
      fontWeight: '700',
    },
    stepTitle: {
      ...typography.headline,
      color: colors.text,
      fontSize: 15,
    },
    stepDesc: {
      ...typography.footnote,
      color: colors.textSecondary,
      marginTop: 1,
    },
  });
};

const ActionCard = ({ icon, title, description, buttonTitle, onPress, theme, accent }) => {
  const styles = getStyles(theme);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.9 }]}>
      <Card theme={theme} style={accent ? styles.accentCard : undefined}>
        <View style={styles.actionRow}>
          <View style={styles.actionInfo}>
            <Text style={styles.actionIcon}>{icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.actionTitle, accent && styles.whiteText]}>{title}</Text>
              <Text style={[styles.actionDesc, accent && styles.whiteTextMuted]}>{description}</Text>
            </View>
          </View>
          <Text style={[styles.actionArrow, accent && styles.whiteText]}>→</Text>
        </View>
      </Card>
    </Pressable>
  );
};

const StepItem = ({ number, title, desc, theme, isLast }) => {
  const styles = getStyles(theme);
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepNumber}>
        <Text style={styles.stepNumberText}>{number}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepDesc}>{desc}</Text>
      </View>
    </View>
  );
};

const SensorInfo = ({ icon, name, desc, theme }) => {
  const styles = getStyles(theme);
  return (
    <View style={styles.stepRow}>
      <Text style={{ fontSize: 18, width: 28, textAlign: 'center' }}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.stepTitle}>{name}</Text>
        <Text style={styles.stepDesc}>{desc}</Text>
      </View>
    </View>
  );
};
