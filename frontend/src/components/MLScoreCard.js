/**
 * MLScoreCard — AI-Generated vs Real Camera Detection Card
 *
 * Displays the ML metadata forensics result with:
 *  • Animated circular probability gauge
 *  • Classification badge (AI / REAL / UNCERTAIN)
 *  • Collapsible signal breakdown list
 */

import {
  Text,
  View,
} from 'react-native';
import { Card } from './Card';

// ── Classification config ──────────────────────────────────────────────────

const CLASS_CONFIG = {
  AI_GENERATED: {
    label: 'AI GENERATED',
    emoji: '🤖',
    tagline: 'Metadata fingerprint matches AI synthesis patterns',
    color: (colors) => colors.tampered || '#EF4444',
    gaugeColor: '#EF4444',
    badgeBg: '#EF444420',
    badgeBorder: '#EF4444',
    gaugeLabel: 'AI PROB',
  },
  REAL: {
    label: 'REAL CAMERA',
    emoji: '📷',
    tagline: 'Physical camera metadata & optical features verified',
    color: (colors) => colors.authentic || '#22C55E',
    gaugeColor: '#22C55E',
    badgeBg: '#22C55E20',
    badgeBorder: '#22C55E',
    gaugeLabel: 'AI PROB',
  },
  // Backward-compat alias for backend returning 'REAL_CAMERA' or 'AUTHENTIC_CAMERA'
  REAL_CAMERA: {
    label: 'REAL CAMERA',
    emoji: '📷',
    tagline: 'Physical camera metadata & optical features verified',
    color: (colors) => colors.authentic || '#22C55E',
    gaugeColor: '#22C55E',
    badgeBg: '#22C55E20',
    badgeBorder: '#22C55E',
    gaugeLabel: 'AI PROB',
  },
  AUTHENTIC_CAMERA: {
    label: 'REAL CAMERA',
    emoji: '📷',
    tagline: 'Physical camera metadata & optical features verified',
    color: (colors) => colors.authentic || '#22C55E',
    gaugeColor: '#22C55E',
    badgeBg: '#22C55E20',
    badgeBorder: '#22C55E',
    gaugeLabel: 'AI PROB',
  },
  SCREEN_RECAPTURE: {
    label: 'SCREEN CAPTURED',
    emoji: '📺',
    tagline: 'Photo of a digital screen — optical PWM flicker & pixel grid interference detected',
    color: (colors) => colors.error || '#EF4444',
    gaugeColor: '#EF4444',
    badgeBg: '#EF444415',
    badgeBorder: '#EF4444',
    gaugeLabel: 'SCREEN %',
  },
  SCREEN_REPLAY: {
    label: 'SCREEN CAPTURED',
    emoji: '📺',
    tagline: 'Photo of a digital screen — optical PWM flicker & pixel grid interference detected',
    color: (colors) => colors.error || '#EF4444',
    gaugeColor: '#EF4444',
    badgeBg: '#EF444415',
    badgeBorder: '#EF4444',
    gaugeLabel: 'SCREEN %',
  },
  AI_OR_SCREEN_REPLAY: {
    label: 'AI / SCREEN RECAPTURE',
    emoji: '🤖',
    tagline: 'Synthetic AI or screen replay patterns detected',
    color: (colors) => colors.tampered || '#EF4444',
    gaugeColor: '#EF4444',
    badgeBg: '#EF444420',
    badgeBorder: '#EF4444',
    gaugeLabel: 'AI PROB',
  },
  NOT_VERIFIED: {
    label: 'NOT VERIFIED',
    emoji: '⚠️',
    tagline: 'Insufficient or conflicting forensic evidence to classify this image',
    color: (colors) => colors.warning || '#F59E0B',
    gaugeColor: '#F59E0B',
    badgeBg: '#F59E0B20',
    badgeBorder: '#F59E0B',
    gaugeLabel: 'AI PROB',
  },
  // Backward-compat alias for backend returning 'UNCERTAIN'
  UNCERTAIN: {
    label: 'NOT VERIFIED',
    emoji: '⚠️',
    tagline: 'Metadata signals are ambiguous or insufficient',
    color: (colors) => colors.warning || '#F59E0B',
    gaugeColor: '#F59E0B',
    badgeBg: '#F59E0B20',
    badgeBorder: '#F59E0B',
    gaugeLabel: 'AI PROB',
  },
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
export const MLScoreCard = ({ analysis, isRecaptured = false, screenConfidence = null, isLoading, theme }) => {
  const { colors, spacing, typography } = theme;

  if (isLoading) {
    return (
      <Card theme={theme}>
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
      <Card theme={theme}>
        <Text style={{ ...typography.callout, color: colors.textMuted, textAlign: 'center' }}>
          ⚠️ ML analysis unavailable
        </Text>
      </Card>
    );
  }

  let classKey = analysis.classification;

  // Authoritative override for classification:
  if (isRecaptured === true) {
    classKey = 'SCREEN_RECAPTURE';
  } else if (isRecaptured === false) {
    // Groq VLM or higher-level consensus confirmed NOT a screen recapture
    if (
      classKey === 'SCREEN_RECAPTURE' ||
      classKey === 'SCREEN_REPLAY' ||
      !classKey ||
      classKey === 'NOT_VERIFIED' ||
      classKey === 'UNCERTAIN'
    ) {
      classKey = 'AUTHENTIC_CAMERA';
    }
  } else {
    // Fallback if isRecaptured prop is undefined
    if (
      analysis.isRecaptured ||
      analysis.screenCaptureByML ||
      (analysis.screenScore ?? 0) >= 0.50 ||
      (analysis.screenScore ?? 0) >= 50
    ) {
      classKey = 'SCREEN_RECAPTURE';
    } else if (!classKey || classKey === 'NOT_VERIFIED' || classKey === 'UNCERTAIN') {
      if (
        analysis.auraFlag === 'GREEN' ||
        analysis.status === 'verified' ||
        (analysis.realProbability && analysis.realProbability >= 70) ||
        (analysis.aiProbability != null && analysis.aiProbability <= 15)
      ) {
        classKey = 'AUTHENTIC_CAMERA';
      }
    }
  }

  const cfg = CLASS_CONFIG[classKey] || CLASS_CONFIG.UNCERTAIN;
  const classColor = cfg.color(colors);

  const isScreenCapture = classKey === 'SCREEN_RECAPTURE' || classKey === 'SCREEN_REPLAY';

  const weights = analysis.ensembleWeights || { knn: 0.70, visual: 0.15, ela: 0.15 };
  const wKnn = weights.knn ?? 0.70;
  const wVisual = weights.visual ?? 0.15;
  const wEla = weights.ela ?? 0.15;

  const knnRisk = analysis.knnAiProbability ?? 0;
  const visualRisk = analysis.visualAiProbability ?? 0;
  const elaRisk = analysis.elaAiProbability ?? 0;

  const weightedAiRisk = wKnn * knnRisk + wVisual * visualRisk + wEla * elaRisk;
  const weightedRealScore = 100 - weightedAiRisk;

  let displayConfidence;
  if (isScreenCapture) {
    displayConfidence = screenConfidence != null 
      ? parseFloat(Number(screenConfidence).toFixed(1))
      : (analysis.screenScore != null ? parseFloat(((analysis.screenScore <= 1 ? analysis.screenScore * 100 : analysis.screenScore)).toFixed(1)) : 95.0);
  } else if (classKey === 'AUTHENTIC_CAMERA' || classKey === 'REAL' || classKey === 'REAL_CAMERA') {
    displayConfidence = parseFloat(weightedRealScore.toFixed(1));
  } else if (classKey === 'AI_GENERATED') {
    displayConfidence = parseFloat(weightedAiRisk.toFixed(1));
  } else {
    displayConfidence = analysis.confidence != null ? parseFloat(analysis.confidence.toFixed(1)) : parseFloat(weightedRealScore.toFixed(1));
  }

  return (
    <Card theme={theme}>
      {/* ── Top Header Row: Status Badge & Confidence ── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: cfg.badgeBg,
            borderWidth: 1,
            borderColor: cfg.badgeBorder,
            borderRadius: 20,
            paddingHorizontal: spacing.md,
            paddingVertical: 5,
            gap: 6,
          }}
        >
          <Text style={{ fontSize: 13 }}>{cfg.emoji}</Text>
          <Text style={{ ...typography.footnote, fontWeight: '700', color: classColor, letterSpacing: 0.5 }}>
            {cfg.label}
          </Text>
        </View>

        <Text style={{ ...typography.caption, color: colors.textMuted, fontWeight: '600' }}>
          {displayConfidence}% Confidence
        </Text>
      </View>

      {/* ── Tagline ── */}
      <Text style={{ ...typography.callout, color: colors.textSecondary, marginBottom: spacing.md, lineHeight: 20 }}>
        {cfg.tagline}
      </Text>

      {/* ── Model Analysis Summary ── */}
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
          FORENSIC MODEL EVALUATION
        </Text>

        {/* Model 1: EXIF Metadata */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 14 }}>🔢</Text>
            <Text style={{ ...typography.callout, color: colors.text, fontWeight: '600' }}>Hardware EXIF (KNN)</Text>
          </View>
          <Text style={{ ...typography.callout, color: (analysis.knnAiProbability ?? 0) > 30 ? colors.error : colors.authentic, fontWeight: '700' }}>
            {analysis.knnAiProbability ?? 0}% AI Risk
          </Text>
        </View>

        <View style={{ height: 1, backgroundColor: colors.divider }} />

        {/* Model 2: Visual Optics */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 14 }}>👁</Text>
            <Text style={{ ...typography.callout, color: colors.text, fontWeight: '600' }}>Visual Optics (CNN)</Text>
          </View>
          <Text style={{ ...typography.callout, color: (analysis.visualAiProbability ?? 0) > 30 ? colors.error : colors.authentic, fontWeight: '700' }}>
            {analysis.visualAiProbability ?? 0}% AI Risk
          </Text>
        </View>

        {/* Model 3: Error Level Analysis (ELA) */}
        {analysis.elaAiProbability != null && (
          <>
            <View style={{ height: 1, backgroundColor: colors.divider }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 14 }}>🔬</Text>
                <Text style={{ ...typography.callout, color: colors.text, fontWeight: '600' }}>Error Level (ELA)</Text>
              </View>
              <Text style={{ ...typography.callout, color: (analysis.elaAiProbability ?? 0) > 30 ? colors.error : colors.authentic, fontWeight: '700' }}>
                {analysis.elaAiProbability ?? 0}% AI Risk
              </Text>
            </View>
          </>
        )}

        {/* Model 4: Screen Recapture */}
        <View style={{ height: 1, backgroundColor: colors.divider }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 14 }}>📺</Text>
            <Text style={{ ...typography.callout, color: colors.text, fontWeight: '600' }}>Screen Recapture</Text>
          </View>
          <Text style={{ ...typography.callout, color: isScreenCapture ? colors.error : colors.authentic, fontWeight: '700' }}>
            {isScreenCapture ? `${displayConfidence}% Screen Risk` : '0% Screen Risk'}
          </Text>
        </View>
      </View>
    </Card>
  );
};
