# Better Notion MCP - Optimized for AI Agents
# syntax=docker/dockerfile:1

# Use Node.js 24 as the base image
FROM node:24-alpine AS builder

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the package
RUN pnpm build

# Minimal image for runtime
FROM node:24-alpine

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

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

# Run as non-root user for security
USER node

# Set entrypoint
ENTRYPOINT ["better-notion-mcp"]
