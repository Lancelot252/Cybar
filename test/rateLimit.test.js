const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const { createRateLimit, _buckets } = require('../server/services/rateLimit');

test('超过窗口限额返回 429', async () => {
  _buckets.clear();
  const app = express();
  app.get('/limited', createRateLimit({ name: 'test', limit: 1, windowMs: 1000, key: req => req.ip }), (_req, res) => res.json({ ok: true }));
  assert.equal((await request(app).get('/limited')).status, 200);
  const blocked = await request(app).get('/limited');
  assert.equal(blocked.status, 429); assert.equal(blocked.body.code, 'RATE_LIMITED');
});
