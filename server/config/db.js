const mysql = require('mysql2/promise'); // 新增

const dbPool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'ABzj#12345678',
    database: 'cybar',
    port: 3309,
    charset: 'utf8mb4'
});

module.exports = dbPool;