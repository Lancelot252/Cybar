const mysql = require('mysql2/promise');

const dbPool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'ABzj#12345678', // 改回您之前的正确密码
    database: 'cybar',
    port: 3306,             // 改回标准的 MySQL 端口 3306
    charset: 'utf8mb4'
});

module.exports = dbPool;