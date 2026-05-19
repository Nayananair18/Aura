import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';

export const SensorIndicator = ({ isActive, theme }) => {
  const styles = getIndicatorStyles(theme);
  return (
    <View style={[styles.dot, isActive && styles.dotActive]} />
  );
};

export const LoadingSpinner = ({ theme, size = 32 }) => {
  const spinValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      })
    ).start();
  }, [spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2.5,
          borderColor: theme.colors.border,
          borderTopColor: theme.colors.accent,
        },
        { transform: [{ rotate: spin }] },
      ]}
    />
  );
};

const getIndicatorStyles = (theme) => {
  const { colors } = theme;
  return StyleSheet.create({
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.border,
    },
    dotActive: {
      backgroundColor: colors.success,
    },
  });
};
