import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { pingBackend } from '../services/api';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Header } from '../components/Header';

export const HomeScreen = ({ navigation, theme }) => {
  const [isConnected, setIsConnected] = useState(false);
  const styles = getStyles(theme);
  const { colors } = theme;

  useEffect(() => {
    const checkConnection = async () => {
      const result = await pingBackend();
      setIsConnected(result.status === 'connected');
    };
    checkConnection();
  }, []);

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

        <ActionCard
          icon="🔬"
          title="Verify"
          description="Check if any image is real or AI-generated"
          onPress={() => navigation.navigate('Verify')}
          theme={theme}
        />

        {/* How it Works - Verification Layers */}
        <Text style={styles.sectionLabel}>VERIFICATION LAYERS</Text>

        <Card theme={theme}>
          <StepItem
            number="1"
            title="Hardware EXIF & Sensors (KNN)"
            desc="Extract camera metadata & 6-sensor environmental physics"
            theme={theme}
          />
          <View style={styles.stepDivider} />
          <StepItem
            number="2"
            title="Visual Optics Forensics (CNN)"
            desc="Analyze spatial noise energy & DCT block variance"
            theme={theme}
          />
          <View style={styles.stepDivider} />
          <StepItem
            number="3"
            title="Screen Recapture & PWM (FFT)"
            desc="2D FFT frequency lattice & optical flicker grid analysis"
            theme={theme}
          />
          <View style={styles.stepDivider} />
          <StepItem
            number="4"
            title="Cryptographic Sealing (SHA-256)"
            desc="Fuse media hashes & sensor proof into immutable seal"
            theme={theme}
            isLast
          />
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
