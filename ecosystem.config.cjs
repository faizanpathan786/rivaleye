// PM2 ecosystem config for direct deployment
module.exports = {
  apps: [
    {
      name: 'rivaleye-api',
      script: 'pnpm',
      args: '--filter @rivaleye/api dev',
      cwd: '/home/faizan514pathan/rivaleye-v3',
      watch: false,
      restart_delay: 4000,
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      max_memory_restart: '1G',
    },
    {
      name: 'rivaleye-landing',
      script: 'npx',
      args: 'http-server packages/landing/dist -p 3000 -c-1',
      cwd: '/home/faizan514pathan/rivaleye-v3',
      watch: false,
      restart_delay: 4000,
      error_file: './logs/err.log',
      out_file: './logs/out.log',
    },
    {
      name: 'rivaleye-web',
      script: 'pnpm',
      args: '--filter @rivaleye/web dev',
      cwd: '/home/faizan514pathan/rivaleye-v3',
      watch: false,
      restart_delay: 4000,
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      max_memory_restart: '1G',
    }
  ]
};
