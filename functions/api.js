const express = require('express');
const serverless = require('serverless-http');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const sharp = require('sharp');
const workerpool = require('workerpool');

const app = express();
const upload = multer({ dest: '/tmp/uploads/' });

// Create a worker pool
const pool = workerpool.pool(path.join(__dirname, 'worker.js'));

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Image Optimization API',
      version: '1.0.0',
      description: 'API for optimizing images',
    },
  },
  apis: [__filename],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * @swagger
 * /optimize:
 *   post:
 *     summary: Optimize images
 *     description: Upload and optimize images
 *     consumes:
 *       - multipart/form-data
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *               targetSize:
 *                 type: integer
 *                 description: Target size in bytes (default 100KB)
 *     responses:
 *       200:
 *         description: Images optimized successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       originalName:
 *                         type: string
 *                       optimizedUrl:
 *                         type: string
 *                       thumbnailUrl:
 *                         type: string
 *                       originalSize:
 *                         type: number
 *                       optimizedSize:
 *                         type: number
 *                       thumbnailSize:
 *                         type: number
 *                       compressionRatio:
 *                         type: number
 *                       processingTime:
 *                         type: number
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
 */
app.post('/optimize', upload.array('images'), async (req, res) => {
  const startTime = process.hrtime();
  const files = req.files;
  const targetSize = parseInt(req.body.targetSize) || 100 * 1024; // Default to 100KB

  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Request timed out')), 60000)
  );

  try {
    const optimizationPromise = pool.exec('optimizeImages', [files, targetSize]);
    const results = await Promise.race([optimizationPromise, timeoutPromise]);

    const endTime = process.hrtime(startTime);
    const totalTime = endTime[0] + endTime[1] / 1e9;

    res.json({
      message: 'Images optimized successfully',
      results: results,
      totalProcessingTime: totalTime.toFixed(2)
    });
  } catch (error) {
    console.error('Error optimizing images:', error);
    if (error.message === 'Request timed out') {
      res.status(500).json({ error: 'The request took too long to process. Please try again with fewer or smaller images.' });
    } else {
      res.status(500).json({ error: 'An error occurred while optimizing images', details: error.message });
    }
  }
});

module.exports.handler = serverless(app);