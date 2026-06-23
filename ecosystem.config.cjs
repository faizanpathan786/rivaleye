// PM2 ecosystem config for Docker-based deployment
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Get GCP project ID
let projectId;
try {
  projectId = execSync('gcloud config get-value project', { encoding: 'utf-8' }).trim();
} catch {
  projectId = 'rivaleye-498121'; // fallback
}

const dockerImage = `gcr.io/${projectId}/rivaleye:latest`;

module.exports = {
  apps: [
    {
      name: 'rivaleye-docker',
      script: 'docker',
      args: [
        'run',
        '--rm',
        '--name', 'rivaleye-app',
        '-p', '4000:4000',
        `--env-file=${path.join(__dirname, '.env')}`,
        dockerImage,
      ],
      watch: false,
      restart_delay: 4000,
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      max_memory_restart: '1G',
    }
  ]
};
