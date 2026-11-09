# ServiceHub API (NestJS). Built and run by docker-compose.yml in the repo root.
# Debian slim instead of Alpine because bcrypt ships ready-made binaries for it.

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
# the database scripts, for `docker compose exec backend npm run admin:create`
COPY --from=build --chown=node:node /app/database ./database
USER node
EXPOSE 3001
# healthy once the API answers. node is used because the slim image has no curl
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.API_PORT || 3001) + '/api/services').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "dist/src/main.js"]
