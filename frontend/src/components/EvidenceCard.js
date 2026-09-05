/**
 * EvidenceCard — Physical Evidence Fingerprint Display
 *
 * Shows the raw EXIF + visual forensics evidence that proves
 * whether an image came from a real camera or was AI-generated.
 *
 * Each row shows one piece of physical evidence with:
 *  • A pass/fail indicator
 *  • The actual value found (or "MISSING")
 *  • A plain-English explanation of why it matters
 */

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from './Card';

// ── Evidence field definitions ─────────────────────────────────────────────

const EVIDENCE_FIELDS = [
  {
    id: 'camera_make',
    label: 'Camera Manufacturer',
    icon: '📷',
    getValue: (fp) => fp?.make || fp?.Make || fp?.['{TIFF}']?.Make || null,
    isReal: (val) => !!val,
    realText: (val) => val,
    fakeText: () => 'MISSING',
    weight: 'critical',
    explanation: 'Real cameras always embed their manufacturer (Apple, Samsung, Canon…). AI-generated images have no hardware to report.',
  },
  {
    id: 'camera_model',
    label: 'Camera Model',
    icon: '📱',
    getValue: (fp) => fp?.model || fp?.Model || fp?.['{TIFF}']?.Model || null,
    isReal: (val) => !!val,
    realText: (val) => val,
    fakeText: () => 'MISSING',
    weight: 'critical',
    explanation: 'Every physical camera records its exact model string. No model = no physical camera.',
  },
  {
    id: 'shutter_speed',
    label: 'Shutter Speed',
    icon: '⚡',
    getValue: (fp) => fp?.shutterSpeed ?? fp?.exposureTime ?? fp?.ExposureTime ?? fp?.ShutterSpeedValue ?? null,
    isReal: (val) => val != null,
    realText: (val) => {
      const s = parseFloat(val);
      if (!s) return String(val);
      return s < 1 ? `1/${Math.round(1 / s)}s` : `${s.toFixed(1)}s`;
    },
    fakeText: () => 'MISSING',
    weight: 'high',
    explanation: 'The physical shutter must open and close to expose a sensor. No shutter speed = no physical exposure event.',
  },
  {
    id: 'aperture',
    label: 'Aperture (f-stop)',
    icon: '🔍',
    getValue: (fp) => fp?.aperture ?? fp?.fNumber ?? fp?.FNumber ?? fp?.ApertureValue ?? null,
    isReal: (val) => val != null,
    realText: (val) => `f/${parseFloat(val).toFixed(1)}`,
    fakeText: () => 'MISSING',
    weight: 'high',
    explanation: 'Real lenses have physical iris blades. Aperture is a fundamental optical measurement AI images cannot fabricate.',
  },
  {
    id: 'iso',
    label: 'ISO Sensitivity',
    icon: '☀️',
    getValue: (fp) => fp?.isoSpeedRating ?? fp?.isoSpeedRatings ?? fp?.ISOSpeedRatings ?? fp?.iso ?? fp?.ISO ?? null,
    isReal: (val) => val != null,
    realText: (val) => `ISO ${val}`,
    fakeText: () => 'MISSING',
    weight: 'high',
    explanation: 'ISO is the sensor\'s light sensitivity setting. It is physically impossible to omit from real camera captures.',
  },
  {
    id: 'focal_length',
    label: 'Focal Length',
    icon: '🔭',
    getValue: (fp) => fp?.focalLength ?? fp?.FocalLength ?? null,
    isReal: (val) => val != null,
    realText: (val) => `${parseFloat(val).toFixed(0)}mm`,
    fakeText: () => 'MISSING',
    weight: 'medium',
    explanation: 'Physical lenses embed their focal length in every shot. AI has no optics.',
  },
  {
    id: 'gps',
    label: 'GPS Coordinates',
    icon: '📍',
    getValue: (fp) => {
      if (!fp) return null;
      const lat = fp.latitude ?? fp.gpsLatitude ?? fp.GPSLatitude ?? fp['{GPS}']?.Latitude ?? fp['{GPS}']?.GPSLatitude ?? null;
      const lon = fp.longitude ?? fp.gpsLongitude ?? fp.GPSLongitude ?? fp['{GPS}']?.Longitude ?? fp['{GPS}']?.GPSLongitude ?? null;
      return (lat != null && lon != null) ? { lat: Number(lat), lon: Number(lon) } : null;
    },
    isReal: (val) => val != null,
    realText: (val) => `${parseFloat(val.lat).toFixed(4)}°, ${parseFloat(val.lon).toFixed(4)}°`,
    fakeText: () => 'MISSING',
    weight: 'medium',
    explanation: 'Smartphone cameras embed GPS at capture. Coordinates verify physical spatiotemporal ground truth.',
  },
  {
    id: 'software',
    label: 'Software Tag',
    icon: '💻',
    getValue: (fp) => fp?.software || fp?.Software || null,
    isReal: (val) => {
      if (!val || typeof val !== 'string' || val.trim() === '') return false;
      const AI_TOOLS = [
        'stable diffusion', 'dall-e', 'dall·e', 'midjourney', 'adobe firefly',
        'dreamstudio', 'runway', 'novelai', 'automatic1111', 'comfyui',
        'invoke ai', 'image creator', 'canva ai', 'ideogram', 'gpt-4o',
        'photoshop', 'gimp', 'canvas',
      ];
      return !AI_TOOLS.some((t) => val.toLowerCase().includes(t));
    },
    realText: (val) => val,
    fakeText: (val) => (val ? `Synthetic Tool (${val})` : 'MISSING'),
    weight: 'high',
    explanation: 'Real cameras embed manufacturer firmware strings. Missing or AI tool strings indicate synthetic or stripped origins.',
  },
  {
    id: 'exif_version',
    label: 'EXIF Version',
    icon: '🔐',
    getValue: (fp) => fp?.exifVersion || fp?.ExifVersion || null,
    isReal: (val) => !!val,
    realText: (val) => `v${val}`,
    fakeText: () => 'MISSING',
    weight: 'low',
    explanation: 'Camera firmware always writes the EXIF standard version used. Its absence indicates the image did not originate from camera hardware.',
  },
];

const WEIGHT_COLOR = {
  critical: '#EF4444',
  high: '#F59E0B',
  medium: '#6366F1',
  low: '#A1A1AA',
};

const WEIGHT_LABEL = {
  critical: 'CRITICAL',
  high: 'HIGH',
  medium: 'MEDIUM',
  low: 'LOW',
};

// ── Sub-components ─────────────────────────────────────────────────────────

const EvidenceRow = ({ field, fingerprint, isLast, theme }) => {
  const [expanded, setExpanded] = useState(false);
  const { colors, spacing, typography } = theme;

  const rawValue = field.getValue(fingerprint);
  const real = field.isReal(rawValue);
  const displayValue = real
    ? field.realText(rawValue)
    : field.fakeText(rawValue);

  const dotColor = real ? colors.authentic || '#22C55E' : colors.error || '#EF4444';
  const weightColor = WEIGHT_COLOR[field.weight];

  return (
    <View>
      <Pressable
        onPress={() => setExpanded(!expanded)}
        style={({ pressed }) => [
          styles.row,
          pressed && { opacity: 0.75 },
        ]}
      >
        {/* Status dot */}
        <View style={[styles.dot, { backgroundColor: dotColor }]} />

        {/* Icon + label */}
        <Text style={styles.rowIcon}>{field.icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowLabel, { color: colors.text, ...typography.callout }]}>
            {field.label}
          </Text>
          <Text
            style={[
              styles.rowValue,
              {
                color: real ? colors.textSecondary : colors.error || '#EF4444',
                fontWeight: real ? '400' : '700',
              },
            ]}
            numberOfLines={1}
          >
            {displayValue}
          </Text>
        </View>

        <Text style={[styles.chevron, { color: colors.textMuted }]}>
          {expanded ? '▲' : '▼'}
        </Text>
      </Pressable>

      {/* Explanation panel */}
      {expanded && (
        <View style={[styles.explanation, { backgroundColor: colors.surface, borderColor: dotColor }]}>
          <Text style={[styles.explanationText, { color: colors.textSecondary, ...typography.footnote }]}>
            {field.explanation}
          </Text>
        </View>
      )}

      {!isLast && <View style={[styles.divider, { backgroundColor: colors.divider }]} />}
    </View>
  );
};

// ── Summary bar ────────────────────────────────────────────────────────────

const EvidenceSummary = ({ passed, total, theme }) => {
  const { colors, spacing, typography } = theme;
  const failedCount = total - passed;
  const pct = total > 0 ? Math.round((passed / total) * 100) : 0;

  const barColor = pct >= 80
    ? colors.authentic || '#22C55E'
    : pct >= 50
    ? '#F59E0B'
    : colors.error || '#EF4444';

  return (
    <View style={styles.summaryContainer}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ ...typography.footnote, color: colors.textSecondary, fontWeight: '600' }}>
          Physical Evidence Score
        </Text>
        <Text style={{ ...typography.footnote, color: barColor, fontWeight: '800' }}>
          {passed}/{total} fields present
        </Text>
      </View>

      {/* Progress bar */}
      <View style={[styles.bar, { backgroundColor: colors.surface }]}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: barColor }]} />
      </View>

      {/* Verdict chips */}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        {failedCount > 0 && (
          <View style={[styles.chip, { backgroundColor: '#EF444418', borderColor: '#EF4444' }]}>
            <Text style={[styles.chipText, { color: '#EF4444' }]}>✗ {failedCount} missing</Text>
          </View>
        )}
      </View>
    </View>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────

/**
 * @param {object} props
 * @param {object|null} props.fingerprint — metadataFingerprint from backend analysis result
 * @param {object} props.theme
 */
export const EvidenceCard = ({ fingerprint, theme }) => {
  const { colors, spacing, typography } = theme;

  if (!fingerprint) {
    return (
      <Card theme={theme} style={{ marginBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Text style={{ fontSize: 16 }}>🔬</Text>
          <Text style={{ ...typography.callout, color: colors.textMuted }}>
            No EXIF fingerprint available
          </Text>
        </View>
      </Card>
    );
  }

  const results = EVIDENCE_FIELDS.map((field) => {
    const val = field.getValue(fingerprint);
    return { field, passed: field.isReal(val) };
  });

  const passedCount = results.filter((r) => r.passed).length;

  return (
    <Card theme={theme} style={{ marginBottom: spacing.md, overflow: 'hidden' }}>
      {/* Accent bar — color by score */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          backgroundColor:
            passedCount >= 7 ? '#22C55E'
            : passedCount >= 4 ? '#F59E0B'
            : '#EF4444',
        }}
      />

      <View style={{ paddingTop: spacing.xs }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
          <Text style={{ fontSize: 18, marginRight: spacing.xs }}>🔬</Text>
          <Text style={{ ...typography.headline, color: colors.text, fontWeight: '700', flex: 1 }}>
            Physical Evidence
          </Text>
          <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '600' }}>
            EXIF Fingerprint
          </Text>
        </View>

        {/* Summary bar */}
        <EvidenceSummary
          passed={passedCount}
          total={EVIDENCE_FIELDS.length}
          theme={theme}
        />

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: colors.divider, marginVertical: spacing.sm }]} />

        {/* Evidence rows */}
        {results.map(({ field, passed: p }, index) => (
          <EvidenceRow
            key={field.id}
            field={field}
            fingerprint={fingerprint}
            isLast={index === results.length - 1}
            theme={theme}
          />
        ))}
      </View>
    </Card>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
    minHeight: 48,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  rowIcon: {
    fontSize: 16,
    width: 22,
    textAlign: 'center',
    flexShrink: 0,
  },
  rowLabelContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  rowLabel: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  rowValue: {
    fontSize: 11,
    marginTop: 2,
    fontFamily: 'monospace',
    lineHeight: 15,
  },
  weightBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    flexShrink: 0,
  },
  weightText: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  chevron: {
    fontSize: 10,
    marginLeft: 2,
    flexShrink: 0,
  },
  explanation: {
    marginBottom: 8,
    marginLeft: 36,
    padding: 10,
    borderRadius: 8,
    borderLeftWidth: 3,
  },
  explanationText: {
    fontSize: 12,
    lineHeight: 18,
  },
  divider: {
    height: 1,
  },
  summaryContainer: {
    marginBottom: 4,
  },
  bar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
