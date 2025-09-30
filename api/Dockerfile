# Multi-stage Dockerfile for Claude complaint analysis service + optional static hosting
# Build stage (not heavy here, but future-friendly)
FROM node:20-alpine AS base

# Set working directory
WORKDIR /app

# Copy dependency manifests first for better layer caching
COPY package.json package-lock.json* ./

# Install production dependencies
RUN npm install --omit=dev || npm install --production

# Copy source
COPY claude.js ./
# Copy root project static assets (served optionally) two levels up? In this layout we just
# copy the repository root later from final stage if static serving is desired.

# Runtime image (slim)
FROM node:20-alpine AS runtime
WORKDIR /app

# Environment defaults
ENV NODE_ENV=production \
    PORT=3001 \
    SERVE_STATIC=false

# Copy node_modules and source from build stage
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/claude.js ./
COPY package.json ./

# Optionally copy entire project for static serving (disabled by default)
# If you want static assets inside the image, build with:
#   docker build --build-arg INCLUDE_STATIC=true -t company-portal-ai .
ARG INCLUDE_STATIC=false
RUN if [ "$INCLUDE_STATIC" = "true" ]; then echo "Including static site"; fi
COPY --from=base /app/package.json ./

# If including static, copy everything from build context except node_modules (already present)
# This allows SERVE_STATIC=true to serve the HTML pages.
COPY . /workspace

# Minimal healthcheck (hits /health every 30s)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/health || exit 1

EXPOSE 3001

# Start command
CMD ["node", "claude.js"]
