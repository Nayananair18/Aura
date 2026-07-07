const sharp = require('sharp');

/**
 * Calculates the Error Level Analysis (ELA) for an image.
 * ELA helps detect AI manipulation or splicing by saving an image at a known
 * error rate (e.g., 90% JPEG quality) and evaluating the difference in pixel values.
 * 
 * @param {Buffer} imageBuffer 
 * @returns {Promise<Object>} ELA metrics
 */
const analyzeELA = async (imageBuffer) => {
  try {
    const originalImage = sharp(imageBuffer);
    const { data: origData, info: origInfo } = await originalImage
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Recompress at 90% quality
    const recompressedBuffer = await sharp(imageBuffer)
      .jpeg({ quality: 90, force: true })
      .toBuffer();

    const { data: recompData } = await sharp(recompressedBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Calculate MAE (Mean Absolute Error) and Variance
    let diffSum = 0;
    let diffSqSum = 0;
    let maxDiff = 0;
    
    // Process pixel by pixel (ignoring alpha channel for ELA difference)
    for (let i = 0; i < origData.length; i += 4) {
      const diffR = Math.abs(origData[i] - recompData[i]);
      const diffG = Math.abs(origData[i+1] - recompData[i+1]);
      const diffB = Math.abs(origData[i+2] - recompData[i+2]);
      
      const pixelDiff = (diffR + diffG + diffB) / 3;
      
      diffSum += pixelDiff;
      diffSqSum += pixelDiff * pixelDiff;
      if (pixelDiff > maxDiff) maxDiff = pixelDiff;
    }

    const numPixels = origInfo.width * origInfo.height;
    const meanError = diffSum / numPixels;
    const variance = (diffSqSum / numPixels) - (meanError * meanError);

    // AI ELA Profile: AI images often have uniform blocky structures causing high variance,
    // or extremely low variance if generated losslessly and suddenly compressed.
    let aiProbability = 0.1;
    let anomalyType = 'normal';
    
    if (variance < 0.3) {
      aiProbability = 0.85; 
      anomalyType = 'abnormally_smooth';
    } else if (variance > 4.5) {
      aiProbability = 0.90; 
      anomalyType = 'high_frequency_artifacts';
    } else if (variance > 3.0 && variance <= 4.5) {
      aiProbability = 0.6;
      anomalyType = 'suspicious_variance';
    }

    return {
      success: true,
      metrics: {
        meanError,
        variance,
        maxDiff,
      },
      aiProbability,
      anomalyType,
    };
  } catch (err) {
    console.error('ELA Analysis error:', err);
    return { success: false, error: err.message };
  }
};

module.exports = { analyzeELA };
