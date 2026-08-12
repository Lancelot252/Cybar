-- Security hardening for password hashes and persistent sessions.
UPDATE users SET password = '!reset!' WHERE password IS NULL;
ALTER TABLE users MODIFY COLUMN password varchar(255) NOT NULL;
UPDATE users
SET password = CONCAT('!reset!', SHA2(CONCAT(UUID(), id, RAND()), 256))
WHERE password NOT LIKE '$2a$%'
  AND password NOT LIKE '$2b$%'
  AND password NOT LIKE '$2y$%'
  AND password NOT LIKE '!reset!%';

CREATE TABLE IF NOT EXISTS sessions (
  sid varchar(128) NOT NULL,
  expires_at datetime(3) NOT NULL,
  data longtext NOT NULL,
  PRIMARY KEY (sid),
  KEY idx_sessions_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
