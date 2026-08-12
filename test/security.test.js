const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../server/app');
const { persistImage } = require('../server/services/imageUpload');

test('敏感仓库文件不再由 HTTP 静态暴露', async () => {
  for (const path of ['/package.json', '/server/routes/auth.js', '/.env', '/database/schema.sql', '/config.json', '/cybar2.sql']) {
    const response = await request(app).get(path);
    assert.equal(response.status, 404, path);
  }
});

test('响应包含关键安全头', async () => {
  const response = await request(app).get('/');
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.equal(response.headers['x-frame-options'], 'SAMEORIGIN');
  assert.match(response.headers['content-security-policy'], /default-src 'self'/);
});

test('写请求缺少 CSRF 令牌时被拒绝', async () => {
  const response = await request(app).post('/api/login').send({ username: 'someone', password: 'some-password' });
  assert.equal(response.status, 403);
  assert.equal(response.body.code, 'CSRF_INVALID');
});

test('伪造 MIME 的 HTML 文件不能作为图片持久化', async () => {
  await assert.rejects(
    persistImage({ mimetype: 'image/png', buffer: Buffer.from('<script>alert(1)</script>') }, process.cwd(), 'security-test'),
    /内容与格式不匹配/
  );
});

test('上传目录拒绝可执行扩展名', async () => {
  const response = await request(app).get('/uploads/avatars/payload.html');
  assert.equal(response.status, 404);
});

test('受保护页面不能通过显式 index.html 绕过认证', async () => {
  for (const path of ['/admin/index.html', '/profile/index.html', '/custom/index.html']) {
    const response = await request(app).get(path);
    assert.equal(response.status, 302, path);
    assert.equal(response.headers.location, '/auth/login/');
  }
});
