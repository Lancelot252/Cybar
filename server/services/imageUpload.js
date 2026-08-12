const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const ALLOWED_TYPES = Object.freeze({
    'image/jpeg': { ext: '.jpg', matches: buffer => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff },
    'image/png': { ext: '.png', matches: buffer => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
    'image/webp': { ext: '.webp', matches: buffer => buffer.length >= 12 && buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP' }
});

function createImageUpload(fieldName) {
    return multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 30 },
        fileFilter: (_req, file, cb) => cb(null, Object.hasOwn(ALLOWED_TYPES, file.mimetype))
    }).single(fieldName);
}

async function persistImage(file, directory, prefix) {
    if (!file) return null;
    const type = ALLOWED_TYPES[file.mimetype];
    if (!type || !type.matches(file.buffer)) {
        const error = new Error('图片内容与格式不匹配，仅支持 JPEG、PNG 和 WebP');
        error.status = 400;
        throw error;
    }

    await fs.promises.mkdir(directory, { recursive: true });
    const filename = `${prefix}-${Date.now()}-${crypto.randomBytes(16).toString('hex')}${type.ext}`;
    const target = path.join(directory, filename);
    await fs.promises.writeFile(target, file.buffer, { flag: 'wx', mode: 0o640 });
    return { filename, path: target };
}

module.exports = { createImageUpload, persistImage, ALLOWED_TYPES };
