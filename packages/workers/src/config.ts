function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export const config = {
  databaseUrl: requireEnv("DATABASE_URL"),
  redisUrl: process.env["REDIS_URL"] ?? "redis://localhost:6379",
  reddit: {
    clientId: requireEnv("REDDIT_CLIENT_ID"),
    clientSecret: requireEnv("REDDIT_CLIENT_SECRET"),
    userAgent: process.env["REDDIT_USER_AGENT"] ?? "rivaleye/1.0",
  },
  anthropicApiKey: requireEnv("ANTHROPIC_API_KEY"),
  nodeEnv: process.env["NODE_ENV"] ?? "development",
} as const;
