# Better Notion MCP - Optimized for AI Agents
# syntax=docker/dockerfile:1

# Use bun for dependency installation
FROM oven/bun:1-alpine@sha256:7ed9f74c326d1c260abe247ac423ccbf5ac92af62bb442d515d1f92f21e8ea9b AS deps

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Use Node.js for building (tsc + esbuild)
FROM node:24.14.1-alpine@sha256:01743339035a5c3c11a373cd7c83aeab6ed1457b55da6a69e014a95ac4e4700b AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Build the package
RUN npx tsc -build && node scripts/build-cli.js

# Minimal image for runtime
FROM node:24.14.1-alpine@sha256:01743339035a5c3c11a373cd7c83aeab6ed1457b55da6a69e014a95ac4e4700b

LABEL org.opencontainers.image.source="https://github.com/n24q02m/better-notion-mcp"
LABEL io.modelcontextprotocol.server.name="io.github.n24q02m/better-notion-mcp"

# Copy built package from builder stage
COPY --from=builder /app/build /usr/local/lib/node_modules/@n24q02m/better-notion-mcp/build
COPY --from=builder /app/bin /usr/local/lib/node_modules/@n24q02m/better-notion-mcp/bin
COPY --from=builder /app/package.json /usr/local/lib/node_modules/@n24q02m/better-notion-mcp/
COPY --from=builder /app/README.md /usr/local/lib/node_modules/@n24q02m/better-notion-mcp/
COPY --from=builder /app/LICENSE /usr/local/lib/node_modules/@n24q02m/better-notion-mcp/
COPY --from=builder /app/node_modules /usr/local/lib/node_modules/@n24q02m/better-notion-mcp/node_modules

# Create symlink for CLI
RUN ln -s /usr/local/lib/node_modules/@n24q02m/better-notion-mcp/bin/cli.mjs /usr/local/bin/better-notion-mcp

# Set default environment variables
ENV NODE_ENV=production
# TRANSPORT_MODE: "stdio" (default) or "http" (remote + OAuth)
EXPOSE 8080

# Run as non-root user for security
USER node

# Set entrypoint
ENTRYPOINT ["better-notion-mcp"]
