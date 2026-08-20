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
    const originalImage = sharp(imageBuffer).resize({ width: 800, withoutEnlargement: true });
    const { data: origData, info: origInfo } = await originalImage
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Recompress at 90% quality
    const recompressedBuffer = await sharp(imageBuffer)
      .resize({ width: 800, withoutEnlargement: true })
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

    const numPixels = origData.length / 4; // RGBA: 4 bytes per pixel
    const meanError = diffSum / numPixels;
    const variance = (diffSqSum / numPixels) - (meanError * meanError);

    // AI ELA Profile: AI images often have uniform blocky structures causing high variance,
    // or extremely low variance if generated losslessly and suddenly compressed.
    // AI ELA Profile:
    // Standard real compressed JPEGs with natural scene textures produce variance between 0.8 and 18.0.
    // Extremely smooth lossless AI outputs compressed for the first time have variance < 0.25.
    // Spliced / composited deepfakes with extreme high-frequency DCT discontinuities have variance > 28.0.
    let aiProbability = 0.12;
    let anomalyType = 'normal';
    
    if (variance < 0.25) {
      aiProbability = 0.75; 
      anomalyType = 'abnormally_smooth';
    } else if (variance > 28.0) {
      aiProbability = 0.80; 
      anomalyType = 'high_frequency_artifacts';
    } else if (variance > 18.0) {
      aiProbability = 0.45;
      anomalyType = 'suspicious_variance';
    } else {
      aiProbability = 0.12;
      anomalyType = 'normal';
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
