const mysql = require('mysql2/promise');

const dbPool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'cybar_app',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'cybar',
    port: Number(process.env.DB_PORT || 3306),
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_POOL_SIZE || 10)
});

module.exports = dbPool;
