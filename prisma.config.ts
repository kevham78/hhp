import { existsSync } from 'node:fs'
import { defineConfig, env } from 'prisma/config'

// Prisma 7 no longer reads .env on its own. Load it for local dev; in
// Docker there's no .env and DATABASE_URL comes from the container env.
// (loadEnvFile never overrides variables that are already set.)
if (existsSync('.env')) process.loadEnvFile('.env')

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node prisma/seed.mjs',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
})
