import { Pressable, StyleSheet, Text, View } from 'react-native';

export const Button = ({
  title,
  onPress,
  variant = 'primary',
  size = 'large',
  disabled = false,
  style,
  theme,
}) => {
  const styles = getStyles(theme, variant, size);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={styles.text} numberOfLines={1}>{title}</Text>
    </Pressable>
  );
};

const getStyles = (theme, variant, size) => {
  const { colors, spacing, typography } = theme;

  const sizes = {
    large: {
      paddingVertical: 16,
      paddingHorizontal: spacing.lg,
      borderRadius: 14,
    },
    medium: {
      paddingVertical: 12,
      paddingHorizontal: spacing.lg,
      borderRadius: 12,
    },
    small: {
      paddingVertical: 8,
      paddingHorizontal: spacing.md,
      borderRadius: 10,
    },
  };

  const variants = {
    primary: {
      bg: colors.accent,
      border: colors.accent,
      text: '#FFFFFF',
    },
    secondary: {
      bg: colors.surface,
      border: colors.border,
      text: colors.text,
    },
    success: {
      bg: colors.success,
      border: colors.success,
      text: '#FFFFFF',
    },
    danger: {
      bg: colors.error,
      border: colors.error,
      text: '#FFFFFF',
    },
    ghost: {
      bg: 'transparent',
      border: 'transparent',
      text: colors.accent,
    },
  };

  const v = variants[variant] || variants.primary;
  const s = sizes[size] || sizes.large;

  return StyleSheet.create({
    button: {
      ...s,
      backgroundColor: v.bg,
      borderWidth: 1,
      borderColor: v.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: {
      opacity: 0.7,
      transform: [{ scale: 0.98 }],
    },
    disabled: {
      opacity: 0.4,
    },
    text: {
      ...typography.headline,
      color: v.text,
    },
  });
};
