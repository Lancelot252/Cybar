const crypto = require('crypto');
const dbPool = require('../config/db');

const PROMPT_VERSION = 'flavor-v2';

function clean(value) { return String(value ?? '').trim().replace(/\s+/g, ' '); }
function number(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }

function normalizeRecipe(input = {}) {
    return {
        name: clean(input.name),
        description: clean(input.description),
        ingredients: (Array.isArray(input.ingredients) ? input.ingredients : [])
            .map(item => ({ name: clean(item.name), volume: number(item.volume), abv: number(item.abv) }))
            .filter(item => item.name)
            .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN') || a.volume - b.volume || a.abv - b.abv),
        steps: (Array.isArray(input.steps) ? input.steps : clean(input.instructions).split(/\r?\n/))
            .map(clean).filter(Boolean)
    };
}

function createCacheKey(recipe, model = process.env.AI_TEXT_MODEL || 'qwen3.7-flash') {
    return crypto.createHash('sha256').update(JSON.stringify({ model, promptVersion: PROMPT_VERSION, recipe: normalizeRecipe(recipe) })).digest('hex');
}

class HotLru {
    constructor(max = Number(process.env.AI_MEMORY_CACHE_MAX || 200), ttl = Number(process.env.AI_MEMORY_CACHE_TTL_MS || 600000)) {
        this.max = max; this.ttl = ttl; this.values = new Map();
    }
    get(key) {
        const entry = this.values.get(key);
        if (!entry || entry.expiresAt <= Date.now()) { this.values.delete(key); return null; }
        this.values.delete(key); this.values.set(key, entry); return entry.value;
    }
    set(key, value) {
        this.values.delete(key);
        this.values.set(key, { value, expiresAt: Date.now() + this.ttl });
        while (this.values.size > this.max) this.values.delete(this.values.keys().next().value);
    }
    clear() { this.values.clear(); }
}

const memory = new HotLru();
const inflight = new Map();

function meta(layer, hit, stale, expiresAt) {
    return { hit, layer, stale, expiresAt: expiresAt instanceof Date ? expiresAt.toISOString() : expiresAt };
}

async function readDatabase(key, allowStale = false) {
    const days = allowStale ? Number(process.env.AI_STALE_CACHE_DAYS || 90) : Number(process.env.AI_DB_CACHE_TTL_DAYS || 30);
    const [rows] = await dbPool.query(
        'SELECT response_json, analyzed_at, expires_at FROM ai_analysis_cache WHERE cache_key = ? AND analyzed_at >= DATE_SUB(NOW(), INTERVAL ? DAY) LIMIT 1',
        [key, days]
    );
    if (!rows.length) return null;
    const payload = typeof rows[0].response_json === 'string' ? JSON.parse(rows[0].response_json) : rows[0].response_json;
    const expired = new Date(rows[0].expires_at).getTime() <= Date.now();
    if (expired && !allowStale) return null;
    return { payload, analyzedAt: new Date(rows[0].analyzed_at).toISOString(), expiresAt: new Date(rows[0].expires_at), stale: expired };
}

async function writeDatabase(key, normalized, payload, model, analyzedAt, expiresAt) {
    await dbPool.query(
        `INSERT INTO ai_analysis_cache (cache_key, model, prompt_version, normalized_input, response_json, analyzed_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE model=VALUES(model), prompt_version=VALUES(prompt_version), normalized_input=VALUES(normalized_input), response_json=VALUES(response_json), analyzed_at=VALUES(analyzed_at), expires_at=VALUES(expires_at)`,
        [key, model, PROMPT_VERSION, JSON.stringify(normalized), JSON.stringify(payload), analyzedAt, expiresAt]
    );
}

async function getAnalysis(recipe, analyze) {
    const model = process.env.AI_TEXT_MODEL || 'qwen3.7-flash';
    const normalized = normalizeRecipe(recipe);
    const key = createCacheKey(normalized, model);
    const hot = memory.get(key);
    if (hot) return { ...hot, cache: meta('memory', true, false, hot.expiresAt) };

    try {
        const stored = await readDatabase(key, false);
        if (stored) {
            const result = { ...stored.payload, model, analyzedAt: stored.analyzedAt, expiresAt: stored.expiresAt.toISOString() };
            memory.set(key, result);
            return { ...result, cache: meta('database', true, false, stored.expiresAt) };
        }
    } catch (error) { console.warn('AI cache read skipped:', error.message); }

    if (inflight.has(key)) {
        const result = await inflight.get(key);
        return { ...result, cache: { ...result.cache, hit: true, layer: 'coalesced' } };
    }

    const request = (async () => {
        try {
            const payload = await analyze(normalized);
            const analyzedAt = new Date();
            const expiresAt = new Date(analyzedAt.getTime() + Number(process.env.AI_DB_CACHE_TTL_DAYS || 30) * 86400000);
            const result = { ...payload, model, analyzedAt: analyzedAt.toISOString(), expiresAt: expiresAt.toISOString() };
            memory.set(key, result);
            try { await writeDatabase(key, normalized, payload, model, analyzedAt, expiresAt); }
            catch (error) { console.warn('AI cache write skipped:', error.message); }
            return { ...result, cache: meta('upstream', false, false, expiresAt) };
        } catch (upstreamError) {
            try {
                const stale = await readDatabase(key, true);
                if (stale) return { ...stale.payload, model, analyzedAt: stale.analyzedAt, expiresAt: stale.expiresAt.toISOString(), cache: meta('database', true, true, stale.expiresAt) };
            } catch (error) { console.warn('AI stale cache read skipped:', error.message); }
            throw upstreamError;
        }
    })();
    inflight.set(key, request);
    try { return await request; } finally { inflight.delete(key); }
}

async function cleanupOldEntries() {
    try { await dbPool.query('DELETE FROM ai_analysis_cache WHERE analyzed_at < DATE_SUB(NOW(), INTERVAL ? DAY)', [Number(process.env.AI_STALE_CACHE_DAYS || 90)]); }
    catch (error) { console.warn('AI cache cleanup skipped:', error.message); }
}

module.exports = { normalizeRecipe, createCacheKey, getAnalysis, cleanupOldEntries, HotLru, _memory: memory, _inflight: inflight, PROMPT_VERSION };
