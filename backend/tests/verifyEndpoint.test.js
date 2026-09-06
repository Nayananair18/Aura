const request = require('supertest');
const express = require('express');
const mediaRouter = require('../routes/media');

describe('POST /api/media/analyze-metadata Endpoint Integration Tests', () => {
  let app;
  const originalEnv = process.env;

  beforeAll(() => {
    app = express();
    app.use(express.json({ limit: '50mb' }));
    app.use('/api/media', mediaRouter);
  });

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('should return separate ml and groq objects without throwing when GROQ_API_KEY is not set', async () => {
    delete process.env.GROQ_API_KEY;

    // Small 1x1 8-bit gray PNG image base64
    const sampleBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

    const response = await request(app)
      .post('/api/media/analyze-metadata')
      .send({
        image: sampleBase64,
        fileName: 'test.jpg',
        fileType: 'image/jpeg',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.analysis).toBeDefined();
    expect(response.body.ml).toBeDefined();
    expect(response.body.groq).toBeDefined();

    // Verify ML results intact
    expect(response.body.ml.classification).toBeDefined();
    expect(response.body.ml.aiProbability).toBeDefined();

    // Verify Groq result graceful fallback
    expect(response.body.groq.imageAnalysis).toEqual({
      success: false,
      aiProbability: 50,
      groqClassification: 'UNKNOWN',
      reasoning: 'Groq API key not configured',
      error: 'GROQ_API_KEY not set',
    });

    expect(response.body.groq.screenReplay).toEqual({
      success: false,
      isScreenReplay: false,
      confidence: 0,
      reasoning: 'Groq API key not configured',
      error: 'GROQ_API_KEY not set',
    });
  });

  test('should return 400 if image payload is missing', async () => {
    const response = await request(app)
      .post('/api/media/analyze-metadata')
      .send({ fileName: 'test.jpg' });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });
});
