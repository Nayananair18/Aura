import { StyleSheet, Text, View } from 'react-native';

export const Card = ({ children, style, theme }) => {
  const styles = getStyles(theme);
  return (
    <View style={[styles.card, style]}>
      {children}
    </View>
  );
};

export const MetadataItem = ({ label, value, theme, isLast }) => {
  const styles = getStyles(theme);
  return (
    <View style={[styles.metadataItem, isLast && styles.metadataItemLast]}>
      <Text style={styles.metadataLabel}>{label}</Text>
      <Text style={styles.metadataValue} numberOfLines={2}>{value}</Text>
    </View>
  );
};

export const SectionTitle = ({ title, theme }) => {
  const styles = getStyles(theme);
  return <Text style={styles.sectionTitle}>{title}</Text>;
};

const getStyles = (theme) => {
  const { colors, spacing, typography } = theme;

  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: spacing.lg,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    metadataItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.sm + 2,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
      minHeight: 42,
    },
    metadataItemLast: {
      borderBottomWidth: 0,
    },
    metadataLabel: {
      ...typography.callout,
      color: colors.textSecondary,
      flexShrink: 0,
      marginRight: spacing.sm,
    },
    metadataValue: {
      ...typography.callout,
      color: colors.text,
      fontWeight: '600',
      textAlign: 'right',
      flex: 1,
    },
    sectionTitle: {
      ...typography.caption,
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: spacing.xs + 2,
      marginTop: spacing.lg,
      letterSpacing: 1.2,
    },
  });
};
