describe('groqAnalyzer Unit & Integration Tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('should return safe failure response when GROQ_API_KEY is not set', async () => {
    delete process.env.GROQ_API_KEY;
    const { analyzeWithGroq } = require('./testAnalyzer');

    const sampleBuffer = Buffer.from('fake-image-bytes');
    const result = await analyzeWithGroq(sampleBuffer);

    expect(result.success).toBe(false);
    expect(result.aiProbability).toBe(50);
    expect(result.groqClassification).toBe('UNKNOWN');
    expect(result.reasoning).toBe('Groq API key not configured');
    expect(result.error).toBe('GROQ_API_KEY not set');
  });

  test('should return safe failure response for screen replay when GROQ_API_KEY is not set', async () => {
    delete process.env.GROQ_API_KEY;
    const { analyzeScreenReplayWithGroq } = require('./testAnalyzer');

    const sampleBuffer = Buffer.from('fake-image-bytes');
    const result = await analyzeScreenReplayWithGroq(sampleBuffer);

    expect(result.success).toBe(false);
    expect(result.isScreenReplay).toBe(false);
    expect(result.confidence).toBe(0);
    expect(result.reasoning).toBe('Groq API key not configured');
    expect(result.error).toBe('GROQ_API_KEY not set');
  });

  test('should reject images larger than MAX_BASE64_BYTES (~4MB)', async () => {
    process.env.GROQ_API_KEY = 'gsk_test_key_123';
    const { analyzeWithGroq, analyzeScreenReplayWithGroq } = require('./testAnalyzer');

    const largeBuffer = Buffer.alloc(4 * 1024 * 1024);

    const imgResult = await analyzeWithGroq(largeBuffer);
    expect(imgResult.success).toBe(false);
    expect(imgResult.error).toBe('IMAGE_TOO_LARGE');

    const replayResult = await analyzeScreenReplayWithGroq(largeBuffer);
    expect(replayResult.success).toBe(false);
    expect(replayResult.error).toBe('IMAGE_TOO_LARGE');
  });

  test('should parse clean JSON response from Groq for analyzeWithGroq', async () => {
    process.env.GROQ_API_KEY = 'gsk_test_key_123';

    const mockCreate = jest.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: '{\n  "classification": "AI_GENERATED",\n  "ai_probability": 85,\n  "confidence": 92,\n  "reasoning": "Smooth textures and lack of film grain indicate synthetic origin."\n}',
          },
        },
      ],
    });

    jest.doMock('groq-sdk', () => {
      return jest.fn().mockImplementation(() => ({
        chat: { completions: { create: mockCreate } },
      }));
    });

    const { analyzeWithGroq } = require('./testAnalyzer');
    const sampleBuffer = Buffer.from('test-image-data');
    const result = await analyzeWithGroq(sampleBuffer);

    expect(result.success).toBe(true);
    expect(result.aiProbability).toBe(85);
    expect(result.groqClassification).toBe('AI_GENERATED');
    expect(result.confidence).toBe(92);
    expect(result.reasoning).toContain('Smooth textures');
  });

  test('should strip markdown code fences from Groq response', async () => {
    process.env.GROQ_API_KEY = 'gsk_test_key_123';

    const mockCreate = jest.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: '```json\n{\n  "classification": "REAL_CAMERA",\n  "ai_probability": 10,\n  "confidence": 95,\n  "reasoning": "Natural lens chromatic aberration and film grain present."\n}\n```',
          },
        },
      ],
    });

    jest.doMock('groq-sdk', () => {
      return jest.fn().mockImplementation(() => ({
        chat: { completions: { create: mockCreate } },
      }));
    });

    const { analyzeWithGroq } = require('./testAnalyzer');
    const sampleBuffer = Buffer.from('test-image-data');
    const result = await analyzeWithGroq(sampleBuffer);

    expect(result.success).toBe(true);
    expect(result.aiProbability).toBe(10);
    expect(result.groqClassification).toBe('REAL_CAMERA');
    expect(result.confidence).toBe(95);
    expect(result.reasoning).toContain('Natural lens chromatic aberration');
  });

  test('should handle screen replay detection correctly', async () => {
    process.env.GROQ_API_KEY = 'gsk_test_key_123';

    const mockCreate = jest.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: '{\n  "classification": "SCREEN_REPLAY",\n  "confidence": 96,\n  "reasoning": "Visible pixel subgrid grid array and display bezel frame detected."\n}',
          },
        },
      ],
    });

    jest.doMock('groq-sdk', () => {
      return jest.fn().mockImplementation(() => ({
        chat: { completions: { create: mockCreate } },
      }));
    });

    const { analyzeScreenReplayWithGroq } = require('./testAnalyzer');
    const sampleBuffer = Buffer.from('test-screen-replay-image');
    const result = await analyzeScreenReplayWithGroq(sampleBuffer);

    expect(result.success).toBe(true);
    expect(result.isScreenReplay).toBe(true);
    expect(result.confidence).toBe(96);
    expect(result.reasoning).toContain('Visible pixel subgrid');
  });

  test('should fallback to regex extraction when JSON parsing fails', async () => {
    process.env.GROQ_API_KEY = 'gsk_test_key_123';

    const mockCreate = jest.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: 'Here is your evaluation: "classification": "AI_GENERATED", "ai_probability": 78, "reasoning": "Subtle hair rendering artifacts found."',
          },
        },
      ],
    });

    jest.doMock('groq-sdk', () => {
      return jest.fn().mockImplementation(() => ({
        chat: { completions: { create: mockCreate } },
      }));
    });

    const { analyzeWithGroq } = require('./testAnalyzer');
    const sampleBuffer = Buffer.from('test-image-data');
    const result = await analyzeWithGroq(sampleBuffer);

    expect(result.success).toBe(true);
    expect(result.aiProbability).toBe(78);
    expect(result.groqClassification).toBe('AI_GENERATED');
    expect(result.reasoning).toBe('Subtle hair rendering artifacts found.');
  });
});
