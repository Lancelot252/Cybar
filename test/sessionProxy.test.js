const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

process.env.NODE_ENV = 'production';

const app = require('../server/app');
const dbPool = require('../server/config/db');

test('生产环境信任首层 HTTPS 代理并下发安全会话 Cookie', async t => {
  const originalQuery = dbPool.query;
  dbPool.query = async () => [[{
    id: 'proxy-test-user',
    username: 'proxy-test',
    password: 'test-password',
    role: 'user'
  }]];
  t.after(() => { dbPool.query = originalQuery; });

  const response = await request(app)
    .post('/api/login')
    .set('X-Forwarded-Proto', 'https')
    .send({ username: 'proxy-test', password: 'test-password' });

  assert.equal(response.status, 200);
  const cookies = response.headers['set-cookie'] || [];
  assert.equal(cookies.length, 1);
  assert.match(cookies[0], /^connect\.sid=/);
  assert.match(cookies[0], /; Secure(?:;|$)/);
  assert.match(cookies[0], /; HttpOnly(?:;|$)/);
  assert.match(cookies[0], /; SameSite=Lax(?:;|$)/);
});
