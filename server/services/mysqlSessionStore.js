const session = require('express-session');

class MySQLSessionStore extends session.Store {
    constructor(pool) {
        super();
        this.pool = pool;
        this.cleanupTimer = setInterval(() => {
            this.pool.query('DELETE FROM sessions WHERE expires_at <= NOW()')
                .catch(error => console.error('Session cleanup failed:', error.message));
        }, 60 * 60 * 1000);
        this.cleanupTimer.unref?.();
    }

    get(sid, callback) {
        this.pool.query('SELECT data FROM sessions WHERE sid = ? AND expires_at > NOW() LIMIT 1', [sid])
            .then(([rows]) => callback(null, rows.length
                ? (typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data)
                : null))
            .catch(callback);
    }

    set(sid, value, callback = () => {}) {
        const expiresAt = value.cookie?.expires
            ? new Date(value.cookie.expires)
            : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        this.pool.query(
            `INSERT INTO sessions (sid, expires_at, data) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE expires_at = VALUES(expires_at), data = VALUES(data)`,
            [sid, expiresAt, JSON.stringify(value)]
        ).then(() => callback()).catch(callback);
    }

    destroy(sid, callback = () => {}) {
        this.pool.query('DELETE FROM sessions WHERE sid = ?', [sid])
            .then(() => callback()).catch(callback);
    }

    touch(sid, value, callback = () => {}) {
        const expiresAt = value.cookie?.expires
            ? new Date(value.cookie.expires)
            : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        this.pool.query('UPDATE sessions SET expires_at = ? WHERE sid = ?', [expiresAt, sid])
            .then(() => callback()).catch(callback);
    }
}

module.exports = MySQLSessionStore;
