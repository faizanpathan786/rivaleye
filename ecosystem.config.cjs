// PM2 ecosystem config for the atomic-release deploy.
//
// cwd is the STABLE `current` symlink path (<base>/current), never a concrete
// release dir. Only the symlink target moves on each deploy; PM2 does not
// change cwd on reload for apps that already exist, so keeping cwd fixed as the
// symlink is exactly what makes zero-downtime, atomic reloads work: after
// deploy.sh flips `current` and runs `pm2 reload`, every app re-execs against
// the freshly-flipped release. `./logs` resolves through current -> release ->
// shared/logs, so logs survive releases.
//
// Every app runs through `bash -lc` with an explicit PATH prefix so the command
// AND anything it spawns can resolve pnpm/bun/npx. The pm2 daemon's PATH
// (systemd startup, resurrect after reboot, deploy shell) lacks ~/.bun/bin and
// the pnpm global bin, so bare script:'pnpm' apps crash-looped with "command
// not found". Even under `bash -lc`, pnpm runs a package's `start` script via a
// fresh `sh`, which needs bun on PATH — hence the exported prefix propagates to
// that child shell.
//
// Frontends are served via `npx` at PINNED versions (not `-y` bare, which
// re-resolves the latest from npm on every restart and breaks on a bad upstream
// release or npm outage).
//
// ONE-TIME CUTOVER (old /home/<user>/rivaleye-v3 layout -> atomic releases):
// PM2 does not apply cwd/script/args changes on `startOrReload` for existing
// apps, so the very first switch to this config requires, once, on the VM:
//   pm2 delete all && pm2 start <base>/current/ecosystem.config.cjs && pm2 save
// After that, normal deploys just reload. See docs/deploy-runbook.md.
const os = require('os');
const path = require('path');

const BASE = process.env.RIVALEYE_BASE || path.join(os.homedir(), 'rivaleye');
const CWD = path.join(BASE, 'current');

const PATH_PREFIX = 'export PATH="$HOME/.bun/bin:$HOME/.local/share/pnpm:$PATH";';

// Pinned frontend static-server versions (fix: no unpinned `npx -y`).
const SERVE_VERSION = '14.2.4';
const HTTP_SERVER_VERSION = '14.1.1';

module.exports = {
  apps: [
    {
      name: 'rivaleye-api',
      script: 'bash',
      args: `-lc '${PATH_PREFIX} pnpm --filter @rivaleye/api start'`,
      cwd: CWD,
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
      args: `-lc '${PATH_PREFIX} npx -y http-server@${HTTP_SERVER_VERSION} packages/landing/dist -p 3000 -c-1'`,
      cwd: CWD,
      watch: false,
      restart_delay: 4000,
      error_file: './logs/rivaleye-landing-err.log',
      out_file: './logs/rivaleye-landing-out.log',
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'rivaleye-web',
      script: 'bash',
      args: `-lc '${PATH_PREFIX} npx -y serve@${SERVE_VERSION} -s packages/web/dist -l 4004'`,
      cwd: CWD,
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
      cwd: CWD,
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
      cwd: CWD,
      watch: false,
      restart_delay: 4000,
      error_file: './logs/rivaleye-synth-err.log',
      out_file: './logs/rivaleye-synth-out.log',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '1500M',
    }
  ]
};
