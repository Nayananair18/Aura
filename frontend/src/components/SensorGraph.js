import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

/**
 * Extract a finite numeric value from any data point format (number, {x,y,z}, {lux}, {value}, etc.)
 */
const extractNumericValue = (item) => {
  if (item == null) return 0;
  if (typeof item === 'number') return Number.isFinite(item) ? item : 0;
  if (typeof item === 'object') {
    if (item.value != null && Number.isFinite(Number(item.value))) return Number(item.value);
    if (item.val != null && Number.isFinite(Number(item.val))) return Number(item.val);
    if (item.lux != null && Number.isFinite(Number(item.lux))) return Number(item.lux);
    if (item.magneticField != null && Number.isFinite(Number(item.magneticField))) return Number(item.magneticField);
    if (item.x != null && item.y != null && item.z != null) {
      const nx = Number(item.x) || 0;
      const ny = Number(item.y) || 0;
      const nz = Number(item.z) || 0;
      const mag = Math.sqrt(nx ** 2 + ny ** 2 + nz ** 2);
      return Number.isFinite(mag) ? mag : 0;
    }
    if (item.x != null && Number.isFinite(Number(item.x))) return Number(item.x);
    if (item.y != null && Number.isFinite(Number(item.y))) return Number(item.y);
  }
  const parsed = Number(item);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Real-time sparkline graph using SVG for continuous lines.
 * Guaranteed 100% crash-proof against NaN, undefined, or malformed data points.
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
  if (!Array.isArray(data) || data.length < 2) {
    return (
      <View style={[styles.container, { height, backgroundColor: bgColor }]}>
        <View style={styles.emptyLine} />
      </View>
    );
  }

  // Sanitize all data points into finite numbers
  const sanitizedData = data.map(extractNumericValue).filter(Number.isFinite);

  if (sanitizedData.length < 2) {
    return (
      <View style={[styles.container, { height, backgroundColor: bgColor }]}>
        <View style={styles.emptyLine} />
      </View>
    );
  }

  // Take the last N points
  const visibleData = sanitizedData.slice(-maxPoints);
  const numPoints = visibleData.length;
  
  // Normalize values to 0-1 based on the visible range
  const rawMin = Math.min(...visibleData);
  const rawMax = Math.max(...visibleData);
  const min = Number.isFinite(rawMin) ? rawMin : 0;
  const max = Number.isFinite(rawMax) ? rawMax : 1;
  const range = (max - min) === 0 ? 1 : (max - min);
  
  // Viewport setup
  const padding = 2;
  const graphHeight = Math.max(height - padding * 2, 1);
  const width = 100;

  // Create path points with safe coordinate clamping
  const points = visibleData.map((val, idx) => {
    const normalizedVal = Number.isFinite(val) ? val : min;
    const x = (idx / (numPoints - 1 || 1)) * width;
    const y = padding + (graphHeight - ((normalizedVal - min) / range) * graphHeight);
    
    const safeX = Number.isFinite(x) ? parseFloat(x.toFixed(3)) : 0;
    const safeY = Number.isFinite(y) ? parseFloat(y.toFixed(3)) : graphHeight / 2;
    return { x: safeX, y: safeY };
  });

  if (points.length < 2) {
    return (
      <View style={[styles.container, { height, backgroundColor: bgColor }]}>
        <View style={styles.emptyLine} />
      </View>
    );
  }

  // Generate safe SVG Path strings (guaranteed no NaNs)
  const linePath = points.map((p, i) => (i === 0 ? 'M ' : 'L ') + p.x + ' ' + p.y).join(' ');
  const lastPoint = points[points.length - 1];
  const firstPoint = points[0];
  const fillPath = linePath + ' L ' + lastPoint.x + ' ' + height + ' L ' + firstPoint.x + ' ' + height + ' Z';

  // Unique gradient ID to prevent clash across multiple graphs
  const gradId = 'grad_' + color.replace(/[^a-zA-Z0-9]/g, '_');

  return (
    <View style={[styles.container, { height, backgroundColor: bgColor }]}>
      <Svg height="100%" width="100%" viewBox={'0 0 ' + width + ' ' + height} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.25" />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        
        {showFill && (
          <Path
            d={fillPath}
            fill={'url(#' + gradId + ')'}
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
