const test = require('node:test');
const assert = require('node:assert/strict');
const { parseRecipe, parseAnalysis } = require('../server/services/aiSchemas');

const recipe = {
  name: '海风', description: '清爽',
  ingredients: [{ name: '金酒', volume: 45, abv: 40 }],
  steps: ['摇匀'], glassware: '碟形杯', garnish: '柠檬皮',
  tasteProfile: { sweetness: 2, sourness: 4, bitterness: 1, strength: 5, freshness: 8 },
  tips: ['冰镇杯具']
};

test('解析并校验结构化配方 JSON', () => {
  assert.equal(parseRecipe(`\`\`\`json\n${JSON.stringify(recipe)}\n\`\`\``).name, '海风');
});

test('拒绝缺少必填字段的配方', () => {
  assert.throws(() => parseRecipe('{"name":"不完整"}'), /结构不符合要求/);
});

test('分析评分限制为 0 到 10', () => {
  assert.throws(() => parseAnalysis({ analysis: '测试', tasteProfile: { sweetness: 11, sourness: 1, bitterness: 1, strength: 1, freshness: 1 } }), /结构不符合要求/);
});
