const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const jwt = require('jsonwebtoken');

const ROOT_DIR = path.join(__dirname, '..', '..');
const TEMP_ROOT = path.join(ROOT_DIR, 'uploads', 'ai-temp');
const FINAL_ROOT = path.join(ROOT_DIR, 'uploads', 'cocktails');
const MIME_EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const developmentSecret = crypto.randomBytes(32).toString('hex');
const secret = () => process.env.SESSION_SECRET || developmentSecret;
const ttl = () => Number(process.env.AI_TEMP_IMAGE_TTL_MS || 86400000);

function safeUserId(value) { return String(value).replace(/[^a-zA-Z0-9_-]/g, '_'); }

async function downloadTemporaryImage(url, userId) {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') throw new Error('图片地址必须使用 HTTPS');
    if (parsed.hostname !== 'aliyuncs.com' && !parsed.hostname.endsWith('.aliyuncs.com')) throw new Error('图片地址不是受信任的百炼资源');
    const response = await axios.get(url, {
        responseType: 'stream',
        timeout: Number(process.env.AI_IMAGE_TIMEOUT_MS || 45000),
        maxRedirects: 3,
        beforeRedirect: options => {
            const redirectUrl = new URL(`${options.protocol}//${options.hostname}${options.path || '/'}`);
            if (redirectUrl.protocol !== 'https:' || (redirectUrl.hostname !== 'aliyuncs.com' && !redirectUrl.hostname.endsWith('.aliyuncs.com'))) {
                throw new Error('图片重定向到了不受信任的地址');
            }
        }
    });
    const mime = String(response.headers['content-type'] || '').split(';')[0].toLowerCase();
    const ext = MIME_EXT[mime];
    if (!ext) { response.data.destroy(); throw new Error('百炼返回了不支持的图片格式'); }
    const declared = Number(response.headers['content-length'] || 0);
    const maxBytes = Number(process.env.AI_MAX_IMAGE_BYTES || 8 * 1024 * 1024);
    if (declared > maxBytes) { response.data.destroy(); throw new Error('生成图片超过大小限制'); }
    const owner = safeUserId(userId);
    const dir = path.join(TEMP_ROOT, owner);
    await fsp.mkdir(dir, { recursive: true });
    const filename = `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${ext}`;
    const filePath = path.join(dir, filename);
    let bytes = 0;
    const output = fs.createWriteStream(filePath, { flags: 'wx' });
    try {
        await new Promise((resolve, reject) => {
            response.data.on('data', chunk => { bytes += chunk.length; if (bytes > maxBytes) response.data.destroy(new Error('生成图片超过大小限制')); });
            response.data.on('error', reject); output.on('error', reject); output.on('finish', resolve); response.data.pipe(output);
        });
    } catch (error) { await fsp.rm(filePath, { force: true }); throw error; }
    const expiresAt = new Date(Date.now() + ttl());
    const token = jwt.sign({ purpose: 'generated-image', uid: String(userId), file: `${owner}/${filename}` }, secret(), { algorithm: 'HS256', expiresIn: Math.floor(ttl() / 1000) });
    return { token, expiresAt: expiresAt.toISOString(), filePath };
}

function verifyToken(token, userId) {
    const payload = jwt.verify(token, secret(), { algorithms: ['HS256'] });
    if (payload.purpose !== 'generated-image' || payload.uid !== String(userId)) throw new Error('图片令牌不属于当前用户');
    const fullPath = path.resolve(TEMP_ROOT, payload.file);
    if (!fullPath.startsWith(path.resolve(TEMP_ROOT) + path.sep)) throw new Error('无效图片路径');
    return { ...payload, fullPath };
}

async function promoteGeneratedImage(token, userId) {
    const payload = verifyToken(token, userId);
    await fsp.access(payload.fullPath);
    await fsp.mkdir(FINAL_ROOT, { recursive: true });
    const ext = path.extname(payload.fullPath);
    const filename = `recipe-${safeUserId(userId)}-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    const destination = path.join(FINAL_ROOT, filename);
    await fsp.rename(payload.fullPath, destination);
    return `/uploads/cocktails/${filename}`;
}

async function cleanupTemporaryImages(now = Date.now()) {
    if (!fs.existsSync(TEMP_ROOT)) return;
    const owners = await fsp.readdir(TEMP_ROOT, { withFileTypes: true });
    for (const owner of owners.filter(item => item.isDirectory())) {
        const dir = path.join(TEMP_ROOT, owner.name);
        for (const file of await fsp.readdir(dir, { withFileTypes: true })) {
            if (!file.isFile()) continue;
            const filePath = path.join(dir, file.name);
            const stat = await fsp.stat(filePath);
            if (stat.mtimeMs + ttl() < now) await fsp.rm(filePath, { force: true });
        }
    }
}

module.exports = { downloadTemporaryImage, verifyToken, promoteGeneratedImage, cleanupTemporaryImages, TEMP_ROOT };
