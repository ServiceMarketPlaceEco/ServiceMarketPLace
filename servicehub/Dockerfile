# ServiceHub website (Vue). Built once, then served by nginx, which also
# passes /api on to the backend container, so the browser only ever talks to
# one address. Built and run by docker-compose.yml in the repo root.

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# the website calls /api on the same address it was loaded from
ARG VITE_API_URL=/api
ARG VITE_GOOGLE_CLIENT_ID=
ENV VITE_API_URL=$VITE_API_URL VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
