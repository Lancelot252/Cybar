require('dotenv').config();

const db = require('../config/db');

const cocktailColumns = {
    total_volume: "decimal(10,2) DEFAULT '0.00' COMMENT '总容量(ml)'",
    image: "varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '配方图片路径'",
    description: "text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '鸡尾酒描述'"
};

const userColumns = {
    avatar: "varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '用户头像路径'",
    signature: "varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '这里还没有签名哦' COMMENT '用户签名'"
};

async function ensureColumns(table, definitions) {
    const [rows] = await db.query(`SHOW COLUMNS FROM \`${table}\``);
    const existing = new Set(rows.map(row => row.Field));
    const added = [];

    for (const [name, definition] of Object.entries(definitions)) {
        if (existing.has(name)) continue;
        await db.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${name}\` ${definition}`);
        added.push(name);
    }

    return added;
}

async function migrate() {
    const addedCocktailColumns = await ensureColumns('cocktails', cocktailColumns);
    const addedUserColumns = await ensureColumns('users', userColumns);

    await db.query(`CREATE TABLE IF NOT EXISTS ai_analysis_cache (
        cache_key char(64) NOT NULL,
        model varchar(100) NOT NULL,
        prompt_version varchar(50) NOT NULL,
        normalized_input json NOT NULL,
        response_json json NOT NULL,
        analyzed_at datetime(3) NOT NULL,
        expires_at datetime(3) NOT NULL,
        PRIMARY KEY (cache_key),
        KEY idx_ai_analysis_cache_expires_at (expires_at),
        KEY idx_ai_analysis_cache_analyzed_at (analyzed_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    console.log(addedCocktailColumns.length ? `已新增 cocktails 字段：${addedCocktailColumns.join(', ')}` : 'cocktails 字段已是最新');
    console.log(addedUserColumns.length ? `已新增 users 字段：${addedUserColumns.join(', ')}` : 'users 字段已是最新');
    console.log('ai_analysis_cache 已就绪');
}

migrate()
    .catch(error => {
        console.error(`迁移失败：${error.code || error.message}`);
        process.exitCode = 1;
    })
    .finally(() => db.end());
