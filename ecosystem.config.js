// PM2 Configuration for APEX-OmniHub
module.exports = {
  apps: [
    {
      name: 'apex-omnihub-dev',
      script: 'npm',
      args: 'run dev',
      cwd: './',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: 'development',
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
