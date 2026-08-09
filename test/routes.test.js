const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../server/app');

test('配方生成和生图要求登录', async () => {
  const recipe = await request(app).post('/api/custom/generate-recipe').send({ tasteDescription: '清爽' });
  const image = await request(app).post('/api/custom/generate-image').send({ name: '测试', ingredients: [{ name: '水', volume: 30, abv: 0 }] });
  assert.equal(recipe.status, 401); assert.equal(image.status, 401);
});

test('匿名用户可进入风味分析路由，未配置百炼时明确降级', async t => {
  const dbPool = require('../server/config/db');
  const original = dbPool.query; dbPool.query = async () => [[]]; t.after(() => { dbPool.query = original; });
  const previous = process.env.DASHSCOPE_API_KEY; delete process.env.DASHSCOPE_API_KEY;
  t.after(() => { if (previous) process.env.DASHSCOPE_API_KEY = previous; });
  const response = await request(app).post('/api/custom/analyze-flavor').send({ name: '匿名', ingredients: [{ name: '水', volume: 30, abv: 0 }], steps: [] });
  assert.equal(response.status, 503); assert.equal(response.body.code, 'AI_NOT_CONFIGURED');
});
