import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image, Animated } from 'react-native';

/**
 * A.U.R.A. Premium Loading Screen
 * Authenticated Unforgeable Reality Architecture
 */
export const SplashScreen = ({ onFinish, theme }) => {
  const { colors, typography } = theme;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }).start(() => {
        if (onFinish) onFinish();
      });
    }, 2800);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.View style={[
        styles.content, 
        { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }
      ]}>
        <View style={styles.logoContainer}>
          <Image 
            source={require('../../assets/authenticity.png')} 
            style={styles.logo} 
            resizeMode="contain"
          />
          <View style={[styles.glow, { shadowColor: colors.accent }]} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>A.U.R.A.</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          AUTHENTICATED UNFORGEABLE{"\n"}REALITY ARCHITECTURE
        </Text>
      </Animated.View>
      <View style={styles.footer}>
        <Text style={[styles.tagline, { color: colors.textMuted }]}>
          The ISI Mark for Digital Truth
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  logoContainer: {
    position: 'relative',
    width: 140,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    width: 120,
    height: 120,
    zIndex: 1,
  },
  glow: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 4,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.5,
    textAlign: 'center',
    lineHeight: 16,
    opacity: 0.8,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
  },
  tagline: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
