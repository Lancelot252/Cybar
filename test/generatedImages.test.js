const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('stream');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

process.env.SESSION_SECRET = 'test-image-secret';
const images = require('../server/services/generatedImages');

test('临时图片令牌隔离用户并可转存到正式目录', async t => {
  const originalGet = axios.get;
  axios.get = async () => ({ headers: { 'content-type': 'image/png', 'content-length': '8' }, data: Readable.from(Buffer.from('png-data')) });
  t.after(() => { axios.get = originalGet; });
  const stored = await images.downloadTemporaryImage('https://dashscope-result.oss-cn-beijing.aliyuncs.com/image.png', 'user-a');
  assert.equal(images.verifyToken(stored.token, 'user-a').fullPath, stored.filePath);
  assert.throws(() => images.verifyToken(stored.token, 'user-b'), /不属于当前用户/);
  const publicPath = await images.promoteGeneratedImage(stored.token, 'user-a');
  assert.match(publicPath, /^\/uploads\/cocktails\/recipe-user-a-/);
  const absolute = path.join(__dirname, '..', publicPath.replace(/^\//, ''));
  assert.equal((await fs.readFile(absolute)).toString(), 'png-data');
  await fs.rm(absolute, { force: true });
});

test('拒绝非百炼域名和不支持的 MIME 类型', async t => {
  await assert.rejects(images.downloadTemporaryImage('https://example.com/image.png', 'user-a'), /受信任/);
  const originalGet = axios.get;
  axios.get = async () => ({ headers: { 'content-type': 'text/html' }, data: Readable.from('bad') });
  t.after(() => { axios.get = originalGet; });
  await assert.rejects(images.downloadTemporaryImage('https://dashscope-result.aliyuncs.com/image', 'user-a'), /不支持/);
});
