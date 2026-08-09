const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');
const ai = require('../server/services/aiClient');

const validRecipe = {
  name: '快闪', description: '清爽', ingredients: [{ name: '金酒', volume: 30, abv: 40 }], steps: [],
  glassware: '碟形杯', garnish: '柠檬皮', tasteProfile: { sweetness: 2, sourness: 3, bitterness: 1, strength: 5, freshness: 8 }, tips: []
};

test('非法 JSON 会使用同一模型修复一次', async t => {
  const previousKey = process.env.DASHSCOPE_API_KEY; process.env.DASHSCOPE_API_KEY = 'test-key';
  const originalPost = axios.post; let calls = 0;
  axios.post = async () => ({ data: { choices: [{ message: { content: ++calls === 1 ? '{bad json' : JSON.stringify(validRecipe) } }] } });
  t.after(() => { axios.post = originalPost; if (previousKey) process.env.DASHSCOPE_API_KEY = previousKey; else delete process.env.DASHSCOPE_API_KEY; });
  const result = await ai.generateRecipe({ tasteDescription: '清爽' });
  assert.equal(result.name, '快闪'); assert.equal(calls, 2);
});

test('瞬时 5xx 自动重试一次', async t => {
  const previousKey = process.env.DASHSCOPE_API_KEY; process.env.DASHSCOPE_API_KEY = 'test-key';
  const originalPost = axios.post; let calls = 0;
  axios.post = async () => { calls += 1; if (calls === 1) { const error = new Error('temporary'); error.response = { status: 500 }; throw error; } return { data: { choices: [{ message: { content: JSON.stringify(validRecipe) } }] } }; };
  t.after(() => { axios.post = originalPost; if (previousKey) process.env.DASHSCOPE_API_KEY = previousKey; else delete process.env.DASHSCOPE_API_KEY; });
  await ai.generateRecipe({ tasteDescription: '清爽' }); assert.equal(calls, 2);
});
