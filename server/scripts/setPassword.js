require('dotenv').config();

const bcrypt = require('bcryptjs');
const db = require('../config/db');

async function main() {
    const username = String(process.argv[2] || '').trim();
    const password = String(process.env.CYBAR_NEW_PASSWORD || '');
    if (!username) throw new Error('用法：npm run user:set-password -- <username>');
    if (password.length < 10 || password.length > 72 || Buffer.byteLength(password, 'utf8') > 72) {
        throw new Error('请通过 CYBAR_NEW_PASSWORD 提供 10 到 72 个字符的新密码');
    }
    const [result] = await db.query('UPDATE users SET password = ? WHERE username = ?', [await bcrypt.hash(password, 12), username]);
    if (!result.affectedRows) throw new Error('用户不存在');
    console.log(`已安全重置用户 ${username} 的密码`);
}

main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
}).finally(() => db.end());
