// PM2 ecosystem config for direct deployment.
//
// Every app runs through `bash -lc` with an explicit PATH prefix (matching
// deploy.sh) so the command AND anything it spawns can resolve pnpm/bun/npx.
// The pm2 daemon's PATH (systemd startup, resurrect after reboot, deploy
// shell) lacks ~/.bun/bin and the pnpm global bin, so bare script:'pnpm'
// apps crash-looped with "command not found". Even under `bash -lc`, pnpm
// runs a package's `start` script via a fresh `sh`, which needs bun on PATH —
// hence the exported prefix propagates to that child shell. `npx -y` skips
// the interactive install prompt for serve/http-server.
//
// NOTE: pm2 does not apply script/args changes on `startOrReload` for apps
// that already exist. After changing a command here, run once on the VM:
//   pm2 delete all && pm2 start ecosystem.config.cjs && pm2 save
const PATH_PREFIX = 'export PATH="$HOME/.bun/bin:$HOME/.local/share/pnpm:$PATH";';
module.exports = {
  apps: [
    {
      name: 'rivaleye-api',
      script: 'bash',
      args: `-lc '${PATH_PREFIX} pnpm --filter @rivaleye/api start'`,
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
      args: `-lc '${PATH_PREFIX} npx -y http-server packages/landing/dist -p 3000 -c-1'`,
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
      args: `-lc '${PATH_PREFIX} npx -y serve -s packages/web/dist -l 4004'`,
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
      args: `-lc '${PATH_PREFIX} pnpm --filter @rivaleye/worker start:scrape'`,
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
      args: `-lc '${PATH_PREFIX} pnpm --filter @rivaleye/worker start:synth'`,
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
