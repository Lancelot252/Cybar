const axios = require('axios');
const { parseRecipe, parseAnalysis } = require('./aiSchemas');

const TEXT_MODEL = () => process.env.AI_TEXT_MODEL || 'qwen3.7-flash';
const BASE_URL = () => (process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com').replace(/\/$/, '');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function configured() {
    return Boolean(process.env.DASHSCOPE_API_KEY);
}

function notConfiguredError() {
    const error = new Error('未配置阿里云百炼，AI 功能暂不可用');
    error.code = 'AI_NOT_CONFIGURED';
    error.status = 503;
    return error;
}

function transient(error) {
    const status = error.response?.status;
    return !status || status === 408 || status === 429 || status >= 500;
}

async function withRetry(fn) {
    try { return await fn(); } catch (error) {
        if (!transient(error)) throw error;
        await sleep(180);
        return fn();
    }
}

async function chat(messages) {
    if (!configured()) throw notConfiguredError();
    const url = `${BASE_URL()}/compatible-mode/v1/chat/completions`;
    const response = await withRetry(() => axios.post(url, {
        model: TEXT_MODEL(), messages,
        enable_thinking: false,
        response_format: { type: 'json_object' },
        temperature: 0.35
    }, {
        timeout: Number(process.env.AI_REQUEST_TIMEOUT_MS || 20000),
        headers: { Authorization: `Bearer ${process.env.DASHSCOPE_API_KEY}`, 'Content-Type': 'application/json' }
    }));
    return response.data?.choices?.[0]?.message?.content;
}

async function structured(messages, parser, schemaName) {
    const raw = await chat(messages);
    try { return parser(raw); } catch (error) {
        if (error.code !== 'AI_SCHEMA_INVALID' && !(error instanceof SyntaxError)) throw error;
        const repair = await chat([
            { role: 'system', content: `你是 JSON 修复器。只输出符合 ${schemaName} 约束的 JSON 对象，不要解释。` },
            { role: 'user', content: `修复以下输出，补齐缺失字段并移除额外字段：\n${String(raw).slice(0, 12000)}` }
        ]);
        return parser(repair);
    }
}

async function generateRecipe(input) {
    const prompt = `口味描述：${input.tasteDescription}\n场合：${input.occasion || '不限'}\n酒精强度：${input.alcoholStrength || '不限'}。`;
    const recipe = await structured([
        { role: 'system', content: '你是专业调酒师。输出 JSON：name、description、ingredients（name/volume毫升/abv百分比）、steps、glassware、garnish、tasteProfile（sweetness/sourness/bitterness/strength/freshness，0-10）、tips。配方安全、可操作，不要 Markdown。' },
        { role: 'user', content: prompt }
    ], parseRecipe, 'cocktail recipe');
    return { ...recipe, taste_profile: recipe.tasteProfile };
}

async function analyzeRecipe(recipe) {
    return structured([
        { role: 'system', content: '你是鸡尾酒风味分析师。输出 JSON：analysis 为简洁中文建议；tasteProfile 包含 sweetness/sourness/bitterness/strength/freshness 五个 0-10 数字。不要 Markdown。' },
        { role: 'user', content: JSON.stringify(recipe) }
    ], parseAnalysis, 'flavor analysis');
}

async function generateImage(prompt) {
    if (!configured()) throw notConfiguredError();
    const response = await withRetry(() => axios.post(`${BASE_URL()}/api/v1/services/aigc/multimodal-generation/generation`, {
        model: process.env.AI_IMAGE_MODEL || 'z-image-turbo',
        input: { messages: [{ role: 'user', content: [{ text: prompt }] }] },
        parameters: { prompt_extend: false, size: '768*1024', watermark: false }
    }, {
        timeout: Number(process.env.AI_IMAGE_TIMEOUT_MS || 45000),
        headers: { Authorization: `Bearer ${process.env.DASHSCOPE_API_KEY}`, 'Content-Type': 'application/json' }
    }));
    const content = response.data?.output?.choices?.[0]?.message?.content || [];
    const imageUrl = content.find(item => item.image)?.image || response.data?.output?.results?.[0]?.url;
    if (!imageUrl) throw new Error('百炼未返回图片地址');
    return imageUrl;
}

module.exports = { configured, generateRecipe, analyzeRecipe, generateImage, withRetry, TEXT_MODEL };
