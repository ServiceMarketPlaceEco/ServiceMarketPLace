# ServiceHub API (NestJS) production image

# build stage: install every dependency (bcrypt needs a compiler if no
# prebuilt binary matches), compile, then drop the dev dependencies
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

# runtime stage: only the compiled app, production node_modules and the
# database scripts (for the one-off db-setup service)
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/database ./database
USER node
EXPOSE 3001
CMD ["node", "dist/main"]
