import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

/**
 * Real-time sparkline graph using SVG for continuous lines.
 */
export const SensorGraph = ({
  data = [],
  maxPoints = 60,
  height = 40,
  color = '#818CF8',
  bgColor = 'transparent',
  showFill = true,
  strokeWidth = 1.5,
}) => {
  if (data.length < 2) {
    return (
      <View style={[styles.container, { height, backgroundColor: bgColor }]}>
        <View style={styles.emptyLine} />
      </View>
    );
  }

  // Take the last N points
  const visibleData = data.slice(-maxPoints);
  
  // Normalize values to 0-1 based on the visible range
  const min = Math.min(...visibleData);
  const max = Math.max(...visibleData);
  const range = max - min || 1;
  
  // Viewport setup
  const padding = 2;
  const graphHeight = height - padding * 2;
  const width = 100; // SVG uses 0-100 viewBox usually for easy scaling

  // Create path points
  const points = visibleData.map((val, idx) => {
    const x = (idx / (maxPoints - 1)) * width;
    const y = padding + (graphHeight - ((val - min) / range) * graphHeight);
    return { x, y };
  });

  // Generate SVG Path string (L for line-to)
  const linePath = points.reduce((path, point, i) => {
    return path + (i === 0 ? `M ${point.x} ${point.y}` : ` L ${point.x} ${point.y}`);
  }, "");

  // Generate Fill Path string (closes the shape at the bottom)
  const fillPath = `${linePath} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  return (
    <View style={[styles.container, { height, backgroundColor: bgColor }]}>
      <Svg height="100%" width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.2" />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        
        {showFill && (
          <Path
            d={fillPath}
            fill="url(#grad)"
          />
        )}
        
        <Path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
};

/**
 * Animated pulsing dot for active sensor indication
 */
export const PulseDot = ({ color = '#22C55E', size = 8 }) => {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity: pulse,
      }}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  emptyLine: {
    height: 1,
    backgroundColor: 'rgba(128,128,128,0.1)',
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
  },
});
