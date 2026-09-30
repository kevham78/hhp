# ─────────────────────────────────────────────
# Stage 1: Dependencies
# ─────────────────────────────────────────────
FROM node:24-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma/

RUN npm ci --legacy-peer-deps
RUN npx prisma generate

# ─────────────────────────────────────────────
# Stage 2: Builder
# ─────────────────────────────────────────────
FROM node:24-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
COPY . .

ENV NEXT_TELEMETRY_DISABLED 1

RUN npm run build

# ─────────────────────────────────────────────
# Stage 3: Prisma CLI for `migrate deploy` at startup
# Prisma 7's CLI has its own dependency tree, so install it
# standalone (exact version from package-lock.json).
# ─────────────────────────────────────────────
FROM node:24-alpine AS migrator
WORKDIR /migrate
COPY package-lock.json ./
RUN V=$(node -p "require('./package-lock.json').packages['node_modules/prisma'].version") \
 && rm package-lock.json && npm init -y > /dev/null \
 && npm install --no-audit --no-fund prisma@$V

# Stage 4: Runner
FROM node:24-alpine AS runner
RUN apk add --no-cache openssl icu-data-full
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser  --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Copy prisma client and migration tools
COPY --from=migrator /migrate/node_modules ./node_modules
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=deps /app/node_modules/@prisma ./node_modules/@prisma

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["sh", "-c", "./node_modules/prisma/build/index.js migrate deploy && node server.js"]