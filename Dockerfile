# ---- build ----
FROM node:22-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- runtime: minimal standalone server, non-root ----
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 --ingroup nodejs streamgive

# output: 'standalone' (next.config.ts) produces a self-contained server
# bundle, but deliberately excludes public/ and .next/static — Next's own
# docs call out copying those two alongside it by hand.
COPY --from=build --chown=streamgive:nodejs /app/.next/standalone ./
COPY --from=build --chown=streamgive:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=streamgive:nodejs /app/public ./public

USER streamgive

EXPOSE 3001
CMD ["node", "server.js"]
