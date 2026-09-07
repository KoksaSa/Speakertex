import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const faviconPath = path.join(process.cwd(), 'public', 'favicon.svg');
const outputDir = path.join(process.cwd(), 'android', 'app', 'src', 'main', 'res');

// Размеры для Android
const sizes = [
  { folder: 'mipmap-hdpi', size: 48 },
  { folder: 'mipmap-mdpi', size: 48 },
  { folder: 'mipmap-xhdpi', size: 72 },
  { folder: 'mipmap-xxhdpi', size: 108 },
  { folder: 'mipmap-xxxhdpi', size: 144 },
];

async function generateIcons() {
  try {
    // Конвертируем favicon в PNG (большой размер для масштабирования)
    const pngBuffer = await sharp(faviconPath)
      .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toBuffer();

    for (const { folder, size } of sizes) {
      const folderPath = path.join(outputDir, folder);
      
      // Создаем папку если не существует
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }

      // Генерируем квадратную иконку
      await sharp(pngBuffer)
        .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .png()
        .toFile(path.join(folderPath, 'ic_launcher.png'));

      // Генерируем круглую иконку: круг-маска (dest-in) применяется ПРЯМО к иконке —
      // раньше маску делали на пустом прозрачном холсте и результат всегда был пустым
      await sharp(pngBuffer)
        .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
        .composite([{
          input: Buffer.from(`<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="white"/></svg>`),
          blend: 'dest-in'
        }])
        .png()
        .toFile(path.join(folderPath, 'ic_launcher_round.png'));

      console.log(`Generated ${folder}/ic_launcher.png и ic_launcher_round.png`);
    }

    console.log('Icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error);
  }
}

generateIcons();
