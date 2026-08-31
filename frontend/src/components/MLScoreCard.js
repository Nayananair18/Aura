/**
 * MLScoreCard — AI-Generated vs Real Camera Detection Card
 *
 * Displays the ML metadata forensics result with:
 *  • Animated circular probability gauge
 *  • Classification badge (AI / REAL / UNCERTAIN)
 *  • Collapsible signal breakdown list
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Animated,
  Platform,
} from 'react-native';
import { Card } from './Card';

// ── Classification config ──────────────────────────────────────────────────

const CLASS_CONFIG = {
  AI_GENERATED: {
    label: 'AI GENERATED',
    emoji: '??',
    tagline: 'Metadata fingerprint matches AI synthesis',
    color: (colors) => colors.tampered || '#EF4444',
    gaugeColor: '#EF4444',
    badgeBg: '#EF444420',
    badgeBorder: '#EF4444',
  },
  AUTHENTIC_CAMERA: {
    label: 'AUTHENTIC CAMERA',
    emoji: '??',
    tagline: 'Physical camera hardware EXIF verified',
    color: (colors) => colors.authentic || '#22C55E',
    gaugeColor: '#22C55E',
    badgeBg: '#22C55E20',
    badgeBorder: '#22C55E',
  },
  REAL_CAMERA: {
    label: 'REAL CAMERA',
    emoji: '??',
    tagline: 'Physical camera metadata verified',
    color: (colors) => colors.authentic || '#22C55E',
    gaugeColor: '#22C55E',
    badgeBg: '#22C55E20',
    badgeBorder: '#22C55E',
  },
  UNCERTAIN: {
    label: 'UNCERTAIN',
    emoji: '??',
    tagline: 'Metadata signals are ambiguous / Unverified',
    color: (colors) => colors.warning || '#F59E0B',
    gaugeColor: '#F59E0B',
    badgeBg: '#F59E0B20',
    badgeBorder: '#F59E0B',
  },
};

// ── Circular Gauge ─────────────────────────────────────────────────────────

/**
 * SVG-free circular gauge using border-radius arcs.
 * Renders a styled probability percentage ring.
 */
const CircularGauge = ({ value, color, size = 120, theme }) => {
  const { colors } = theme;
  const strokeWidth = 8;
  const radius = (size - strokeWidth * 2) / 2;

  // We simulate the arc using two overlapping semicircles (pure RN approach)
  const rotation = Math.min(value, 100) * 3.6; // degrees

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      {/* Background ring */}
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: colors.surface || colors.border,
        }}
      />

      {/* Foreground arc using clip-based half-circle technique */}
      {/* Left half */}
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: value >= 50 ? color : 'transparent',
          borderLeftColor: 'transparent',
          borderBottomColor: 'transparent',
          transform: [{ rotate: `${Math.min((value - 50) * 3.6, 180)}deg` }],
        }}
      />
      {/* Right half */}
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: value > 0 ? color : 'transparent',
          borderRightColor: 'transparent',
          borderTopColor: 'transparent',
          transform: [{ rotate: `${-180 + Math.min(value, 50) * 3.6}deg` }],
        }}
      />

      {/* Center label */}
      <View style={{ alignItems: 'center' }}>
        <Text
          style={{
            fontSize: size * 0.22,
            fontWeight: '800',
            color: color,
            letterSpacing: -1,
          }}
        >
          {value}%
        </Text>
        <Text
          style={{
            fontSize: size * 0.09,
            color: colors.textMuted,
            fontWeight: '600',
            marginTop: 1,
          }}
        >
          AI PROB
        </Text>
      </View>
    </View>
  );
};

// ── Signal Row ─────────────────────────────────────────────────────────────

const SignalRow = ({ signal, isLast, theme }) => {
  const { colors, spacing, typography } = theme;
  const triggered = signal.triggered;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: spacing.sm,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.divider,
      }}
    >
      {/* Status dot */}
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: triggered
            ? '#EF444415'
            : '#22C55E15',
          borderWidth: 1.5,
          borderColor: triggered ? '#EF4444' : '#22C55E',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: spacing.sm,
          marginTop: 1,
        }}
      >
        <Text style={{ fontSize: 10, color: triggered ? '#EF4444' : '#22C55E' }}>
          {triggered ? '✗' : '✓'}
        </Text>
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        <Text
          style={{
            ...typography.callout,
            color: triggered ? colors.text : colors.textSecondary,
            fontWeight: triggered ? '600' : '400',
          }}
        >
          {signal.label}
        </Text>
        {triggered && signal.detail && (
          <Text
            style={{
              ...typography.caption,
              color: colors.textMuted,
              marginTop: 2,
            }}
          >
            {signal.detail}
          </Text>
        )}
      </View>

      {/* Weight badge */}
      {triggered && (
        <View
          style={{
            backgroundColor: '#EF444415',
            borderRadius: 4,
            paddingHorizontal: 6,
            paddingVertical: 2,
            marginLeft: spacing.xs,
          }}
        >
          <Text style={{ fontSize: 10, color: '#EF4444', fontWeight: '700' }}>
            +{signal.score}
          </Text>
        </View>
      )}
    </View>
  );
};

// ── Loading Skeleton ────────────────────────────────────────────────────────

const LoadingSkeleton = ({ theme }) => {
  const { colors, spacing } = theme;

  const Bone = ({ width, height = 14, style }) => (
    <View
      style={[
        {
          width,
          height,
          borderRadius: height / 2,
          backgroundColor: colors.surface,
          marginBottom: spacing.xs,
          opacity: 0.7,
        },
        style,
      ]}
    />
  );

  return (
    <View style={{ alignItems: 'center', padding: spacing.lg }}>
      {/* Gauge placeholder */}
      <View
        style={{
          width: 120,
          height: 120,
          borderRadius: 60,
          backgroundColor: colors.surface,
          marginBottom: spacing.lg,
          opacity: 0.5,
        }}
      />
      <Bone width={160} height={18} />
      <Bone width={200} height={12} />
      <View style={{ width: '100%', marginTop: spacing.md }}>
        {[80, 140, 110, 120, 90].map((w, i) => (
          <Bone key={i} width={`${w}%`} style={{ width: w }} />
        ))}
      </View>
    </View>
  );
};

// ── Main Component ──────────────────────────────────────────────────────────

/**
 * @param {object} props
 * @param {object|null} props.analysis — result from analyzeImageMetadata API
 * @param {boolean} props.isLoading  — show skeleton while pending
 * @param {object} props.theme
 */
export const MLScoreCard = ({ analysis, isLoading, theme }) => {
  const [signalsExpanded, setSignalsExpanded] = useState(false);
  const { colors, spacing, typography } = theme;

  if (isLoading) {
    return (
      <Card theme={theme} style={{ marginBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
          <Text style={{ fontSize: 16, marginRight: spacing.xs }}>🧠</Text>
          <Text style={{ ...typography.callout, color: colors.textSecondary, fontWeight: '600' }}>
            Running ML Analysis...
          </Text>
        </View>
        <LoadingSkeleton theme={theme} />
      </Card>
    );
  }

  if (!analysis) {
    return (
      <Card theme={theme} style={{ marginBottom: spacing.md }}>
        <Text style={{ ...typography.callout, color: colors.textMuted, textAlign: 'center' }}>
          ⚠️ ML analysis unavailable
        </Text>
      </Card>
    );
  }

  const cfg = CLASS_CONFIG[analysis.classification] || CLASS_CONFIG.UNCERTAIN;
  const classColor = cfg.color(colors);
  const signals = analysis.signals || [];
  const triggeredCount = analysis.triggeredSignalCount ?? 0;
  const totalCount = analysis.totalSignalCount ?? signals.length;

  return (
    <Card theme={theme} style={{ marginBottom: spacing.md, overflow: 'hidden' }}>
      {/* ── Accent bar ── */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          backgroundColor: classColor,
        }}
      />

      <View style={{ paddingTop: spacing.xs }}>
        {/* ── Header ── */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: spacing.md,
          }}
        >
          <Text style={{ fontSize: 18, marginRight: spacing.xs }}>{cfg.emoji}</Text>
          <Text
            style={{
              ...typography.headline,
              color: colors.text,
              fontWeight: '700',
              flex: 1,
            }}
          >
            ML Metadata Analysis
          </Text>
          {analysis.isMock && (
            <View
              style={{
                backgroundColor: colors.warning + '20',
                borderRadius: 4,
                paddingHorizontal: 6,
                paddingVertical: 2,
              }}
            >
              <Text style={{ fontSize: 9, color: colors.warning, fontWeight: '700' }}>MOCK</Text>
            </View>
          )}
        </View>

        {/* ── Gauge + Classification ── */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: spacing.md,
            gap: spacing.lg,
          }}
        >
          <CircularGauge
            value={analysis.aiProbability}
            color={cfg.gaugeColor}
            size={110}
            theme={theme}
          />

          <View style={{ flex: 1 }}>
            {/* Classification badge */}
            <View
              style={{
                backgroundColor: cfg.badgeBg,
                borderWidth: 1.5,
                borderColor: cfg.badgeBorder,
                borderRadius: 8,
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs,
                alignSelf: 'flex-start',
                marginBottom: spacing.sm,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '800',
                  color: classColor,
                  letterSpacing: 0.8,
                }}
              >
                {cfg.label}
              </Text>
            </View>

            <Text
              style={{
                ...typography.footnote,
                color: colors.textSecondary,
                marginBottom: spacing.sm,
                lineHeight: 18,
              }}
            >
              {cfg.tagline}
            </Text>

            {/* Confidence */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View
                style={{
                  flex: 1,
                  height: 5,
                  borderRadius: 3,
                  backgroundColor: colors.surface,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    width: `${Math.min(analysis.confidence, 100)}%`,
                    height: '100%',
                    borderRadius: 3,
                    backgroundColor: classColor,
                  }}
                />
              </View>
              <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '600' }}>
                {analysis.confidence}%
              </Text>
            </View>
            <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 3 }}>
              Confidence
            </Text>
          </View>
        </View>

        {/* ── Stats Row ── */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: colors.surface,
            borderRadius: 10,
            padding: spacing.sm,
            marginBottom: spacing.sm,
            gap: spacing.xs,
          }}
        >
          {[
            {
              label: 'KNN Votes',
              value: analysis.aiVotes != null
                ? `${analysis.aiVotes}/${analysis.kValue ?? 5}`
                : '—',
              color: analysis.aiVotes > 0 ? '#EF4444' : colors.textMuted,
            },
            {
              label: 'Real Prob',
              value: `${analysis.realProbability}%`,
              color: '#22C55E',
            },
            {
              label: 'AI Prob',
              value: `${analysis.aiProbability}%`,
              color: analysis.aiProbability >= 65 ? '#EF4444'
                : analysis.aiProbability <= 38 ? '#22C55E'
                : '#F59E0B',
            },
          ].map((stat, i) => (
            <View
              key={stat.label}
              style={{
                flex: 1,
                alignItems: 'center',
                borderRightWidth: i < 2 ? 1 : 0,
                borderRightColor: colors.divider,
              }}
            >
              <Text
                style={{
                  ...typography.callout,
                  fontWeight: '700',
                  color: stat.color || colors.text,
                }}
              >
                {stat.value}
              </Text>
              <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>
                {stat.label}
              </Text>
            </View>
          ))}
        </View>

        {/* ── Dual-Model Breakdown ── */}
        {(analysis.knnAiProbability != null || analysis.visualAiProbability != null) && (
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 10,
              padding: spacing.sm,
              marginBottom: spacing.md,
            }}
          >
            <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: '700', marginBottom: spacing.xs, letterSpacing: 0.5 }}>
              ENSEMBLE MODEL BREAKDOWN
            </Text>

            {/* KNN Metadata Model */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ fontSize: 11, color: colors.textSecondary, width: 110 }}>🔢 Metadata KNN</Text>
              <View style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden', marginHorizontal: 8 }}>
                <View style={{ width: `${Math.min(analysis.knnAiProbability ?? 50, 100)}%`, height: '100%', borderRadius: 3, backgroundColor: '#6366F1' }} />
              </View>
              <Text style={{ fontSize: 11, color: '#6366F1', fontWeight: '700', width: 40, textAlign: 'right' }}>
                {analysis.knnAiProbability ?? '?'}%
              </Text>
            </View>

            {/* Visual Pixel Model */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ fontSize: 11, color: colors.textSecondary, width: 110 }}>👁 Visual CNN</Text>
              <View style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden', marginHorizontal: 8 }}>
                <View style={{ width: `${Math.min(analysis.visualAiProbability ?? 50, 100)}%`, height: '100%', borderRadius: 3, backgroundColor: '#EC4899' }} />
              </View>
              <Text style={{ fontSize: 11, color: '#EC4899', fontWeight: '700', width: 40, textAlign: 'right' }}>
                {analysis.visualAiProbability ?? '?'}%
              </Text>
            </View>

            {/* Error Level Analysis (ELA) Model */}
            {analysis.elaAiProbability != null && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <Text style={{ fontSize: 11, color: colors.textSecondary, width: 110 }}>📈 Error Level ELA</Text>
                <View style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden', marginHorizontal: 8 }}>
                  <View style={{ width: `${Math.min(analysis.elaAiProbability ?? 50, 100)}%`, height: '100%', borderRadius: 3, backgroundColor: '#F59E0B' }} />
                </View>
                <Text style={{ fontSize: 11, color: '#F59E0B', fontWeight: '700', width: 40, textAlign: 'right' }}>
                  {analysis.elaAiProbability ?? '?'}%
                </Text>
              </View>
            )}

            {/* Ensemble result */}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 11, color: colors.text, width: 110, fontWeight: '600' }}>⚡ Ensemble</Text>
              <View style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden', marginHorizontal: 8 }}>
                <View style={{ width: `${Math.min(analysis.aiProbability, 100)}%`, height: '100%', borderRadius: 3, backgroundColor: cfg.gaugeColor }} />
              </View>
              <Text style={{ fontSize: 11, color: cfg.gaugeColor, fontWeight: '800', width: 40, textAlign: 'right' }}>
                {analysis.aiProbability}%
              </Text>
            </View>

            {analysis.ensembleWeights && (
              <Text style={{ fontSize: 9, color: colors.textMuted, marginTop: 5 }}>
                Weights: KNN {(analysis.ensembleWeights.knn * 100).toFixed(0)}% · Visual {(analysis.ensembleWeights.visual * 100).toFixed(0)}%{analysis.ensembleWeights.ela != null ? ` · ELA ${(analysis.ensembleWeights.ela * 100).toFixed(0)}%` : ''}
              </Text>
            )}
          </View>
        )}

        {/* ── Image Dimensions ── */}
        {analysis.imageStats?.width && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: spacing.md,
              gap: spacing.xs,
            }}
          >
            <Text style={{ fontSize: 12, color: colors.textMuted }}>📐</Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>
              {analysis.imageStats.width} × {analysis.imageStats.height}px
              {analysis.imageStats.format ? ` · ${analysis.imageStats.format.toUpperCase()}` : ''}
            </Text>
          </View>
        )}

        {/* ── Signal Breakdown Toggle ── */}
        <Pressable
          onPress={() => setSignalsExpanded(!signalsExpanded)}
          style={({ pressed }) => [
            {
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.sm,
              borderRadius: 8,
              backgroundColor: colors.surface,
            },
            pressed && { opacity: 0.7 },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Text style={{ fontSize: 12 }}>🔬</Text>
            <Text
              style={{
                ...typography.footnote,
                color: colors.text,
                fontWeight: '600',
              }}
            >
              Signal Breakdown
            </Text>
            <View
              style={{
                backgroundColor: triggeredCount > 0 ? '#EF444420' : '#22C55E20',
                borderRadius: 10,
                paddingHorizontal: 7,
                paddingVertical: 2,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '700',
                  color: triggeredCount > 0 ? '#EF4444' : '#22C55E',
                }}
              >
                {triggeredCount} AI indicators
              </Text>
            </View>
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 10 }}>
            {signalsExpanded ? '▲' : '▼'}
          </Text>
        </Pressable>

        {/* ── Expanded signals ── */}
        {signalsExpanded && signals.length > 0 && (
          <View style={{ marginTop: spacing.sm }}>
            {/* Show triggered signals first, then rest */}
            {[
              ...signals.filter((s) => s.triggered),
              ...signals.filter((s) => !s.triggered),
            ].map((signal, index, arr) => (
              <SignalRow
                key={signal.id}
                signal={signal}
                isLast={index === arr.length - 1}
                theme={theme}
              />
            ))}
          </View>
        )}
      </View>
    </Card>
  );
};
