const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'gallery');

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Formato non supportato. Usa JPG, PNG o WebP.'));
  },
});

async function processAndSave(buffer, originalName) {
  const ext = '.webp';
  const filename = `${uuidv4()}${ext}`;
  const filepath = path.join(UPLOAD_DIR, filename);

  await sharp(buffer)
    .resize(1600, 1200, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(filepath);

  // Create thumbnail
  const thumbFilename = `thumb_${filename}`;
  await sharp(buffer)
    .resize(400, 300, { fit: 'cover' })
    .webp({ quality: 70 })
    .toFile(path.join(UPLOAD_DIR, thumbFilename));

  return { filename, thumbFilename, originalName };
}

function deleteFile(filename) {
  const filepath = path.join(UPLOAD_DIR, filename);
  const thumbPath = path.join(UPLOAD_DIR, `thumb_${filename}`);
  try { fs.unlinkSync(filepath); } catch (e) {}
  try { fs.unlinkSync(thumbPath); } catch (e) {}
}

module.exports = { upload, processAndSave, deleteFile };
