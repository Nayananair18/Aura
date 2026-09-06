/**
 * GroqScoreCard — Displays Groq VLM Image Analysis & Screen Replay Detection
 *
 * Distinct separate analyzer UI section shown below the existing ML Analysis.
 */

import { Text, View, StyleSheet } from 'react-native';
import { Card } from './Card';

export const GroqScoreCard = ({ groq, isLoading, theme }) => {
  const { colors, spacing, typography } = theme;

  if (isLoading) {
    return (
      <Card theme={theme}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md }}>
          <Text style={{ fontSize: 16, marginRight: spacing.xs }}>⚡</Text>
          <Text style={{ ...typography.callout, color: colors.textSecondary, fontWeight: '600' }}>
            Running Groq VLM Vision Analysis...
          </Text>
        </View>
      </Card>
    );
  }

  if (!groq) {
    return null;
  }

  const imageAnalysis = groq.imageAnalysis || {};
  const screenReplay = groq.screenReplay || {};

  const isKeyMissing = imageAnalysis.success === false && (
    imageAnalysis.error === 'GROQ_API_KEY not set' ||
    imageAnalysis.reasoning?.includes('API key')
  );

  if (isKeyMissing) {
    return (
      <Card theme={theme}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 16 }}>⚠️</Text>
          <Text style={{ ...typography.callout, color: colors.textMuted }}>
            Groq VLM Analysis: API key not configured
          </Text>
        </View>
      </Card>
    );
  }

  const isAiGen = imageAnalysis.groqClassification === 'AI_GENERATED';
  const isRealCam = imageAnalysis.groqClassification === 'REAL_CAMERA' || imageAnalysis.groqClassification === 'REAL_WORLD';
  
  const classColor = isAiGen
    ? colors.tampered || '#EF4444'
    : isRealCam
    ? colors.authentic || '#22C55E'
    : colors.warning || '#F59E0B';

  const classBadgeBg = isAiGen ? '#EF444420' : isRealCam ? '#22C55E20' : '#F59E0B20';
  const classBadgeBorder = isAiGen ? '#EF4444' : isRealCam ? '#22C55E' : '#F59E0B';
  const classEmoji = isAiGen ? '🤖' : isRealCam ? '📷' : '❓';
  const classLabel = isAiGen ? 'AI GENERATED' : isRealCam ? 'REAL CAMERA' : (imageAnalysis.groqClassification || 'UNKNOWN');

  const isReplay = screenReplay.isScreenReplay === true;
  const replayColor = isReplay ? (colors.tampered || '#EF4444') : (colors.authentic || '#22C55E');
  const replayBadgeBg = isReplay ? '#EF444420' : '#22C55E20';
  const replayBadgeBorder = isReplay ? '#EF4444' : '#22C55E';
  const replayEmoji = isReplay ? '📺' : '🌍';
  const replayLabel = isReplay ? 'SCREEN REPLAY' : 'REAL WORLD';

  return (
    <Card theme={theme}>
      {/* ── Sub-header / Brand Pill ── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 14 }}>⚡</Text>
          <Text style={{ ...typography.caption, color: colors.textSecondary, fontWeight: '700', letterSpacing: 0.8 }}>
            GROQ VLM VISION MODEL
          </Text>
        </View>
        <Text style={{ ...typography.caption, color: colors.textMuted, fontSize: 11 }}>
          qwen3.8-27b
        </Text>
      </View>

      {/* ── Image AI Analysis Section ── */}
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 12,
          padding: spacing.md,
          borderWidth: 1,
          borderColor: colors.border,
          marginBottom: spacing.md,
        }}
      >
        {/* Classification & Confidence Row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: classBadgeBg,
              borderWidth: 1,
              borderColor: classBadgeBorder,
              borderRadius: 16,
              paddingHorizontal: spacing.sm + 4,
              paddingVertical: 4,
              gap: 6,
            }}
          >
            <Text style={{ fontSize: 12 }}>{classEmoji}</Text>
            <Text style={{ ...typography.caption, fontWeight: '700', color: classColor }}>
              {classLabel}
            </Text>
          </View>

          <Text style={{ ...typography.caption, color: colors.textMuted, fontWeight: '600' }}>
            {imageAnalysis.confidence ?? 0}% Confidence
          </Text>
        </View>

        {/* AI Probability Stat */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs }}>
          <Text style={{ ...typography.callout, color: colors.textSecondary }}>AI Probability:</Text>
          <Text style={{ ...typography.callout, color: classColor, fontWeight: '700' }}>
            {imageAnalysis.aiProbability ?? 50}%
          </Text>
        </View>

        {/* Reasoning */}
        {Boolean(imageAnalysis.reasoning) && (
          <View style={{ marginTop: spacing.xs, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.divider }}>
            <Text style={{ ...typography.caption, color: colors.textMuted, fontWeight: '600', marginBottom: 2 }}>
              Reasoning:
            </Text>
            <Text style={{ ...typography.footnote, color: colors.text, lineHeight: 18 }}>
              {imageAnalysis.reasoning}
            </Text>
          </View>
        )}
      </View>

      {/* ── Screen Replay Analysis Section ── */}
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 12,
          padding: spacing.md,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Text style={{ ...typography.caption, color: colors.textMuted, fontWeight: '700', letterSpacing: 0.8, marginBottom: spacing.xs }}>
          SCREEN REPLAY DETECTION
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: replayBadgeBg,
              borderWidth: 1,
              borderColor: replayBadgeBorder,
              borderRadius: 16,
              paddingHorizontal: spacing.sm + 4,
              paddingVertical: 4,
              gap: 6,
            }}
          >
            <Text style={{ fontSize: 12 }}>{replayEmoji}</Text>
            <Text style={{ ...typography.caption, fontWeight: '700', color: replayColor }}>
              {replayLabel}
            </Text>
          </View>

          <Text style={{ ...typography.caption, color: colors.textMuted, fontWeight: '600' }}>
            {screenReplay.confidence ?? 0}% Confidence
          </Text>
        </View>

        {/* Reasoning */}
        {Boolean(screenReplay.reasoning) && (
          <View style={{ marginTop: spacing.xs, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.divider }}>
            <Text style={{ ...typography.caption, color: colors.textMuted, fontWeight: '600', marginBottom: 2 }}>
              Reasoning:
            </Text>
            <Text style={{ ...typography.footnote, color: colors.text, lineHeight: 18 }}>
              {screenReplay.reasoning}
            </Text>
          </View>
        )}
      </View>
    </Card>
  );
};
