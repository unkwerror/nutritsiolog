module.exports = {
    apps: [
        {
            name: 'nutritsiolog-api',
            script: 'src/index.js',
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
            script: 'src/worker.js',
            cwd: '/home/mun/nutritsiolog/api',
            interpreter: 'node',
            interpreter_args: '--env-file=.env',
            exec_mode: 'fork',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '256M'
        }
    ]
}
