import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

export const Header = ({ title, subtitle, theme, onBack, style }) => {
  const styles = getStyles(theme);

  return (
    <View style={[styles.container, style]}>
      {onBack && (
        <Pressable onPress={onBack} style={styles.backButton} hitSlop={12}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
      )}
      <View style={styles.textContainer}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
    </View>
  );
};

const getStyles = (theme) => {
  const { colors, spacing, typography } = theme;

  return StyleSheet.create({
    container: {
      paddingHorizontal: spacing.lg,
      paddingTop: Platform.OS === 'ios' ? spacing.xxxl : spacing.xxl,
      paddingBottom: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing.md,
    },
    backIcon: {
      fontSize: 18,
      color: colors.text,
      fontWeight: '600',
    },
    textContainer: {
      flex: 1,
    },
    title: {
      ...typography.largeTitle,
      color: colors.text,
      letterSpacing: -0.8,
    },
    subtitle: {
      ...typography.callout,
      color: colors.textSecondary,
      marginTop: 4,
      fontWeight: '500',
    },
  });
};
