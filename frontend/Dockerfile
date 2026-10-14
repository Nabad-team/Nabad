# Nabad web app image for local development (docker-compose.yml) and the CI build check.
# Production still deploys to Vercel, not from this image.

# ---- Build stage: install everything and run `next build` ----
FROM node:24-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# The /api rewrite in next.config.js is fixed at build time, so the backend origin is a build argument.
# docker-compose.yml passes http://backend:5000 (the backend service on the Compose network).
ARG BACKEND_URL=http://localhost:5000
ENV BACKEND_URL=$BACKEND_URL \
    NEXT_STANDALONE=true \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- Runtime stage: only Next's standalone server, the static files and public/ ----
FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Owned by root, run as the official image's unprivileged "node" user.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

USER node
EXPOSE 3000
CMD ["node", "server.js"]
