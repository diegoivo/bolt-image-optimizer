const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const workerpool = require('workerpool');

async function optimizeImage(file, targetSize) {
  const startTime = process.hrtime();
  const originalSize = file.size;
  const ext = path.extname(file.originalname).toLowerCase();
  const optimizedFileName = `${file.filename}${ext}`;
  const thumbnailFileName = `${file.filename}_thumb${ext}`;
  const optimizedPath = path.join('optimized', optimizedFileName);
  const thumbnailPath = path.join('thumbnails', thumbnailFileName);

  await fs.mkdir('optimized', { recursive: true });
  await fs.mkdir('thumbnails', { recursive: true });

  let quality = 80;
  let buffer = await fs.readFile(file.path);

  // Optimize the image
  while (buffer.length > targetSize && quality > 10) {
    buffer = await sharp(file.path)
      .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality })
      .toBuffer();
    quality -= 5;
  }

  await fs.writeFile(optimizedPath, buffer);

  // Create thumbnail
  const thumbnailBuffer = await sharp(file.path)
    .resize(350, 350, { fit: 'inside' })
    .jpeg({ quality: 20 })
    .toBuffer();

  await fs.writeFile(thumbnailPath, thumbnailBuffer);

  const endTime = process.hrtime(startTime);
  const processingTime = endTime[0] + endTime[1] / 1e9;

  return {
    originalName: file.originalname,
    optimizedUrl: `/optimized/${optimizedFileName}`,
    thumbnailUrl: `/thumbnails/${thumbnailFileName}`,
    originalSize: originalSize,
    optimizedSize: buffer.length,
    thumbnailSize: thumbnailBuffer.length,
    compressionRatio: (buffer.length / originalSize * 100).toFixed(2),
    processingTime: processingTime.toFixed(2)
  };
}

async function optimizeImages(files, targetSize) {
  return Promise.all(files.map(file => optimizeImage(file, targetSize)));
}

workerpool.worker({
  optimizeImages: optimizeImages
});