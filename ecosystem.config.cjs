// PM2 ecosystem config for direct deployment.
//
// Every app runs through `bash -lc` so the command resolves pnpm/npx/bun from
// the login-shell PATH (~/.bun/bin, pnpm global bin). The pm2 daemon itself
// often has a minimal PATH (systemd startup, resurrect after reboot, or a
// deploy shell), which made bare `script: 'pnpm'` apps crash-loop with
// "command not found". `npx -y` skips the interactive install prompt npx
// shows in non-interactive shells when the package isn't cached.
//
// NOTE: pm2 does not apply script/args changes on `startOrReload` for apps
// that already exist. After changing a command here, run once on the VM:
//   pm2 delete all && pm2 startOrReload ecosystem.config.cjs --update-env && pm2 save
module.exports = {
  apps: [
    {
      name: 'rivaleye-api',
      script: 'bash',
      args: "-lc 'pnpm --filter @rivaleye/api start'",
      cwd: '/home/faizan514pathan/rivaleye-v3',
      watch: false,
      restart_delay: 4000,
      error_file: './logs/rivaleye-api-err.log',
      out_file: './logs/rivaleye-api-out.log',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '1G',
    },
    {
      name: 'rivaleye-landing',
      script: 'bash',
      args: "-lc 'npx -y http-server packages/landing/dist -p 3000 -c-1'",
      cwd: '/home/faizan514pathan/rivaleye-v3',
      watch: false,
      restart_delay: 4000,
      error_file: './logs/rivaleye-landing-err.log',
      out_file: './logs/rivaleye-landing-out.log',
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'rivaleye-web',
      script: 'bash',
      args: "-lc 'npx -y serve -s packages/web/dist -l 4004'",
      cwd: '/home/faizan514pathan/rivaleye-v3',
      watch: false,
      restart_delay: 4000,
      error_file: './logs/rivaleye-web-err.log',
      out_file: './logs/rivaleye-web-out.log',
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'rivaleye-scrape',
      script: 'bash',
      args: "-lc 'pnpm --filter @rivaleye/worker start:scrape'",
      cwd: '/home/faizan514pathan/rivaleye-v3',
      watch: false,
      restart_delay: 4000,
      error_file: './logs/rivaleye-scrape-err.log',
      out_file: './logs/rivaleye-scrape-out.log',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '1G',
    },
    {
      name: 'rivaleye-synth',
      script: 'bash',
      args: "-lc 'pnpm --filter @rivaleye/worker start:synth'",
      cwd: '/home/faizan514pathan/rivaleye-v3',
      watch: false,
      restart_delay: 4000,
      error_file: './logs/rivaleye-synth-err.log',
      out_file: './logs/rivaleye-synth-out.log',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '1500M',
    }
  ]
};
