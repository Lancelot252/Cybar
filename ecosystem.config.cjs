module.exports = {
  apps: [{
    name: 'index',
    cwd: '/root/lancelot252/Cybar',
    script: 'server/index.js',
    instances: 1,
    autorestart: true,
    restart_delay: 3000,
    time: true,
    env: {
      NODE_ENV: 'production'
    }
  }]
};