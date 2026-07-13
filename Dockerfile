# AccessGuard AI — container image
# Node 22 ships the built-in node:sqlite module used by the data layer.
FROM node:22-slim

WORKDIR /app

# Install dependencies first (better layer caching).
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY mcp/iam-server/package.json mcp/iam-server/
COPY mcp/hr-server/package.json mcp/hr-server/
COPY mcp/audit-server/package.json mcp/audit-server/
COPY mcp/ticket-server/package.json mcp/ticket-server/
COPY mcp/policy-server/package.json mcp/policy-server/
COPY apps/slack-agent/package.json apps/slack-agent/
RUN npm install

# Copy the rest of the source.
COPY . .

# Seed the database at build time so the container is demo-ready.
RUN npm run seed

ENV NODE_ENV=production
ENV LOG_LEVEL=info

# Socket Mode → no inbound ports required.
CMD ["node", "--experimental-sqlite", "--import", "tsx", "apps/slack-agent/src/index.ts"]
