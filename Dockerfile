# syntax=docker/dockerfile:1

# --- Dépendances ------------------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# --- Build ------------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# La vraie valeur vient de l'environnement d'exécution ; celle-ci ne sert
# qu'à satisfaire la validation de config pendant la compilation.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npm run build

# --- Exécution --------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl && \
    addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts

RUN mkdir -p /app/storage && chown -R nextjs:nodejs /app/storage /app/.next
USER nextjs
EXPOSE 3000

# Au démarrage : migrations, puis amorçage du premier administrateur s'il
# n'en existe aucun, puis l'application. Un déploiement ne peut donc pas
# partir avec un schéma en retard, ni rester inaccessible faute de compte.
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx scripts/premier-demarrage.ts && npm run start"]
