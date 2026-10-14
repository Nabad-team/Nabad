# Nabad API image for local development (docker-compose.yml) and the CI build check.
# Production still deploys from render.yaml (Render's own Node runtime), not from this image.
FROM node:24-slim

ENV NODE_ENV=production \
    PORT=5000
WORKDIR /app

# Production dependencies only. The password hashing libraries ship prebuilt glibc binaries, so slim is enough.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# The code and the common-password list (src/passwordPolicy.js). Owned by root, so the app can't change itself.
COPY src ./src
COPY data ./data

# The official image's unprivileged "node" user.
USER node
EXPOSE 5000

# Ready means connected to MongoDB, not just listening. The slim image has no curl, so Node's fetch does the check.
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 5000) + '/api/health/ready').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]

CMD ["node", "src/server.js"]
