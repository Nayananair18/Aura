/**
 * GroqScoreCard — Displays Groq VLM Image Analysis & Screen Replay Detection
 *
 * Clean single unified card layout matching MLScoreCard structure.
 */

import { Text, View } from 'react-native';
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

  const isRateLimited = Boolean(
    imageAnalysis.error?.includes('429') ||
    imageAnalysis.reasoning?.includes('rate_limit') ||
    imageAnalysis.reasoning?.includes('Rate limit') ||
    screenReplay.error?.includes('429') ||
    screenReplay.reasoning?.includes('rate_limit') ||
    screenReplay.reasoning?.includes('Rate limit')
  );

  if (isRateLimited) {
    return (
      <Card theme={theme}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.xs }}>
          <Text style={{ fontSize: 16 }}>⚠️</Text>
          <Text style={{ ...typography.callout, color: colors.warning || '#F59E0B', fontWeight: '700' }}>
            Groq VLM Rate Limit Reached
          </Text>
        </View>
        <Text style={{ ...typography.footnote, color: colors.textMuted, lineHeight: 18 }}>
          Groq VLM token quota (200,000 TPD) limit reached. Hardware EXIF, Visual Optics, and ELA forensic engines remain active.
        </Text>
      </Card>
    );
  }

  const isReplay = screenReplay.isScreenReplay === true;
  const isAiGen = !isReplay && (imageAnalysis.groqClassification === 'AI_GENERATED' || (imageAnalysis.aiProbability ?? 0) >= 50);

  const classColor = isReplay || isAiGen
    ? colors.tampered || '#EF4444'
    : colors.authentic || '#22C55E';

  const classBadgeBg = isReplay || isAiGen ? '#EF444420' : '#22C55E20';
  const classBadgeBorder = isReplay || isAiGen ? '#EF4444' : '#22C55E';
  const classEmoji = isReplay ? '📺' : isAiGen ? '🤖' : '📷';
  const classLabel = isReplay ? 'SCREEN REPLAY' : isAiGen ? 'AI GENERATED' : 'REAL CAMERA';

  const confidenceVal = isReplay
    ? (screenReplay.confidence ?? 95)
    : (imageAnalysis.confidence ?? 92);

  const reasoningText = isReplay
    ? (screenReplay.reasoning || imageAnalysis.reasoning)
    : (imageAnalysis.reasoning || screenReplay.reasoning);

  // If a physical screen replay attack is detected, AI generation risk is 0% (it's a camera capture of a screen, not AI deepfake art)
  const displayAiRisk = isReplay ? 0 : (imageAnalysis.aiProbability ?? 0);
  const aiRiskColor = isAiGen ? colors.error : colors.authentic;

  return (
    <Card theme={theme}>
      {/* ── Top Header Row: Status Badge & Confidence ── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: classBadgeBg,
            borderWidth: 1,
            borderColor: classBadgeBorder,
            borderRadius: 20,
            paddingHorizontal: spacing.md,
            paddingVertical: 5,
            gap: 6,
          }}
        >
          <Text style={{ fontSize: 13 }}>{classEmoji}</Text>
          <Text style={{ ...typography.footnote, fontWeight: '700', color: classColor, letterSpacing: 0.5 }}>
            {classLabel}
          </Text>
        </View>

        <Text style={{ ...typography.caption, color: colors.textMuted, fontWeight: '600' }}>
          {confidenceVal}% Confidence
        </Text>
      </View>

      {/* ── Subtitle / Model Brand Tag ── */}
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

      {/* ── Single Unified Evaluation Container ── */}
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
          VLM FORENSIC EVALUATION
        </Text>

        {/* Metric 1: AI Generation Risk */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: spacing.sm }}>
            <Text style={{ fontSize: 14 }}>🤖</Text>
            <Text style={{ ...typography.callout, color: colors.text, fontWeight: '600' }}>AI Generation Risk</Text>
          </View>
          <Text style={{ ...typography.callout, color: aiRiskColor, fontWeight: '700', flexShrink: 0 }}>
            {displayAiRisk}% AI Risk
          </Text>
        </View>

        <View style={{ height: 1, backgroundColor: colors.divider }} />

        {/* Metric 2: Screen Replay Risk */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: spacing.sm }}>
            <Text style={{ fontSize: 14 }}>📺</Text>
            <Text style={{ ...typography.callout, color: colors.text, fontWeight: '600' }}>Screen Replay</Text>
          </View>
          <Text style={{ ...typography.callout, color: isReplay ? colors.error : colors.authentic, fontWeight: '700', flexShrink: 0 }}>
            {isReplay ? `${screenReplay.confidence ?? 95}% Screen Risk` : '0% Screen Risk'}
          </Text>
        </View>

        {/* Reasoning Section */}
        {Boolean(reasoningText) && (
          <>
            <View style={{ height: 1, backgroundColor: colors.divider, marginVertical: spacing.xs }} />
            <View style={{ paddingTop: spacing.xs }}>
              <Text style={{ ...typography.caption, color: colors.textMuted, fontWeight: '600', marginBottom: 4 }}>
                REASONING:
              </Text>
              <Text style={{ ...typography.footnote, color: colors.text, lineHeight: 18 }}>
                {reasoningText}
              </Text>
            </View>
          </>
        )}
      </View>
    </Card>
  );
};
