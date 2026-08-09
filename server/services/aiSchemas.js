const Ajv = require('ajv');

const ajv = new Ajv({ allErrors: true, coerceTypes: true, removeAdditional: 'all' });
const scoreProperties = {
    sweetness: { type: 'number', minimum: 0, maximum: 10 },
    sourness: { type: 'number', minimum: 0, maximum: 10 },
    bitterness: { type: 'number', minimum: 0, maximum: 10 },
    strength: { type: 'number', minimum: 0, maximum: 10 },
    freshness: { type: 'number', minimum: 0, maximum: 10 }
};

const recipeSchema = {
    type: 'object',
    required: ['name', 'description', 'ingredients', 'steps', 'glassware', 'garnish', 'tasteProfile', 'tips'],
    properties: {
        name: { type: 'string', minLength: 1, maxLength: 80 },
        description: { type: 'string', maxLength: 500 },
        ingredients: {
            type: 'array', minItems: 1, maxItems: 20,
            items: {
                type: 'object', required: ['name', 'volume', 'abv'],
                properties: {
                    name: { type: 'string', minLength: 1, maxLength: 80 },
                    volume: { type: 'number', minimum: 0, maximum: 2000 },
                    abv: { type: 'number', minimum: 0, maximum: 100 }
                }, additionalProperties: false
            }
        },
        steps: { type: 'array', maxItems: 20, items: { type: 'string', minLength: 1, maxLength: 500 } },
        glassware: { type: 'string', maxLength: 80 },
        garnish: { type: 'string', maxLength: 120 },
        tasteProfile: { type: 'object', required: Object.keys(scoreProperties), properties: scoreProperties, additionalProperties: false },
        tips: { type: 'array', maxItems: 8, items: { type: 'string', minLength: 1, maxLength: 300 } }
    }, additionalProperties: false
};

const analysisSchema = {
    type: 'object', required: ['analysis', 'tasteProfile'],
    properties: {
        analysis: { type: 'string', minLength: 1, maxLength: 2000 },
        tasteProfile: { type: 'object', required: Object.keys(scoreProperties), properties: scoreProperties, additionalProperties: false }
    }, additionalProperties: false
};

const validateRecipe = ajv.compile(recipeSchema);
const validateAnalysis = ajv.compile(analysisSchema);

function parseJsonObject(value) {
    if (typeof value === 'object' && value !== null) return value;
    const raw = String(value || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    return JSON.parse(raw);
}

function assertValid(value, validate, label) {
    const parsed = parseJsonObject(value);
    if (!validate(parsed)) {
        const error = new Error(`${label}结构不符合要求`);
        error.code = 'AI_SCHEMA_INVALID';
        error.validationErrors = validate.errors;
        throw error;
    }
    return parsed;
}

module.exports = {
    recipeSchema,
    analysisSchema,
    parseRecipe: value => assertValid(value, validateRecipe, '配方'),
    parseAnalysis: value => assertValid(value, validateAnalysis, '分析')
};
