module.exports = {
  apps: [
    {
      name: 'hot-system-bots',
      script: './dist-server/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '800M',
      restart_delay: 2000,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '0.0.0.0',
      },
      error_file: './data/pm2-error.log',
      out_file: './data/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
