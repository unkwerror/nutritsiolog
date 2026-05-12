module.exports = {
    apps: [
        {
            name: 'nutritsiolog-api',
            script: 'dist/index.js',
            cwd: '/home/mun/nutritsiolog/api',
            interpreter: 'node',
            interpreter_args: '--env-file=.env',
            exec_mode: 'fork',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '512M'
        },
        {
            name: 'nutritsiolog-worker',
            script: 'dist/worker.js',
            cwd: '/home/mun/nutritsiolog/api',
            interpreter: 'node',
            interpreter_args: '--env-file=.env',
            exec_mode: 'fork',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '256M'
        },
        {
            // Только dev/staging — на prod удалить и настроить реальный SMTP в .env
            name: 'mailpit',
            script: '/usr/local/bin/mailpit',
            interpreter: 'none',
            args: '--smtp 127.0.0.1:1025 --listen 0.0.0.0:8025',
            exec_mode: 'fork',
            autorestart: true,
            watch: false
        }
    ]
}
