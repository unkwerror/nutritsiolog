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
            name: 'nutritsiolog-app',
            script: 'node_modules/.bin/next',
            args: 'start --port 3000',
            cwd: '/home/mun/nutritsiolog/app',
            interpreter: 'node',
            env: {
                NODE_ENV: 'production',
                NEXT_PUBLIC_API_URL: 'https://api.nutrtisiolog.ru'
            },
            exec_mode: 'fork',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '512M'
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
