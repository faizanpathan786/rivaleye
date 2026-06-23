// PM2 ecosystem config for Docker-based deployment
const { execSync } = require('child_process');

// Get GCP project ID
let projectId;
try {
  projectId = execSync('gcloud config get-value project', { encoding: 'utf-8' }).trim();
} catch {
  projectId = 'your-gcp-project-id'; // fallback
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
        '-e', `CONNECTION_STRING=${process.env.CONNECTION_STRING || ''}`,
        '-e', `BETTER_AUTH_SECRET=${process.env.BETTER_AUTH_SECRET || ''}`,
        '-e', `BETTER_AUTH_URL=${process.env.BETTER_AUTH_URL || 'http://localhost:4000'}`,
        '-e', `REDDIT_CLIENT_ID=${process.env.REDDIT_CLIENT_ID || ''}`,
        '-e', `REDDIT_CLIENT_SECRET=${process.env.REDDIT_CLIENT_SECRET || ''}`,
        '-e', `REDDIT_USER_AGENT=${process.env.REDDIT_USER_AGENT || ''}`,
        '-e', `PRODUCTHUNT_TOKEN=${process.env.PRODUCTHUNT_TOKEN || ''}`,
        '-e', `X_API_BEARER=${process.env.X_API_BEARER || ''}`,
        '-e', `APIFY_TOKEN=${process.env.APIFY_TOKEN || ''}`,
        '-e', `GOOGLE_PLACES_API_KEY=${process.env.GOOGLE_PLACES_API_KEY || ''}`,
        '-e', `ANTHROPIC_API_KEY=${process.env.ANTHROPIC_API_KEY || ''}`,
        '-e', `OPENAI_API_KEY=${process.env.OPENAI_API_KEY || ''}`,
        '-e', `OPENROUTER_API_KEY=${process.env.OPENROUTER_API_KEY || ''}`,
        '-e', `OPENROUTER_MODEL=${process.env.OPENROUTER_MODEL || 'deepseek/deepseek-chat'}`,
        '-e', `TRUSTPILOT_API_KEY=${process.env.TRUSTPILOT_API_KEY || ''}`,
        '-e', `VITE_API_URL=${process.env.VITE_API_URL || 'http://localhost:4000'}`,
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
