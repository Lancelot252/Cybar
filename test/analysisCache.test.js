const test = require('node:test');
const assert = require('node:assert/strict');
const dbPool = require('../server/config/db');
const cache = require('../server/services/analysisCache');

test('缓存键忽略原料顺序但保留步骤顺序', () => {
  const one = { name: ' A ', description: 'x', ingredients: [{ name: '柠檬', volume: 20, abv: 0 }, { name: '金酒', volume: 40, abv: 40 }], steps: ['一', '二'] };
  const reordered = { ...one, ingredients: [...one.ingredients].reverse() };
  assert.equal(cache.createCacheKey(one), cache.createCacheKey(reordered));
  assert.notEqual(cache.createCacheKey(one), cache.createCacheKey({ ...one, steps: ['二', '一'] }));
});

test('热点 LRU 按 TTL 过期并限制容量', async () => {
  const lru = new cache.HotLru(1, 5);
  lru.set('a', 1); lru.set('b', 2);
  assert.equal(lru.get('a'), null); assert.equal(lru.get('b'), 2);
  await new Promise(resolve => setTimeout(resolve, 8));
  assert.equal(lru.get('b'), null);
});

test('同一分析键的并发请求只调用一次上游', async t => {
  cache._memory.clear();
  const original = dbPool.query;
  dbPool.query = async sql => sql.startsWith('SELECT') ? [[]] : [[], []];
  t.after(() => { dbPool.query = original; cache._memory.clear(); });
  let calls = 0;
  const analyze = async () => { calls += 1; await new Promise(resolve => setTimeout(resolve, 15)); return { analysis: '平衡', tasteProfile: { sweetness: 2, sourness: 2, bitterness: 2, strength: 2, freshness: 2 } }; };
  const input = { name: '并发配方', ingredients: [{ name: '金酒', volume: 30, abv: 40 }], steps: [] };
  const [a, b] = await Promise.all([cache.getAnalysis(input, analyze), cache.getAnalysis(input, analyze)]);
  assert.equal(calls, 1); assert.equal(a.analysis, '平衡'); assert.equal(b.cache.layer, 'coalesced');
});

test.after(async () => { await dbPool.end(); });
