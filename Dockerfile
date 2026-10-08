# ============================================
# Stage 1: Build
# ============================================
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

RUN npm install -g --ignore-scripts npm@11.11.0

COPY package*.json ./
RUN npm ci --force

COPY . .
RUN npm run build

# ============================================
# Stage 2: Production
# ============================================
FROM node:20-alpine AS production

RUN apk add --no-cache dumb-init

WORKDIR /usr/src/app

# Pin npm and create non-root user
RUN npm install -g --ignore-scripts npm@11.11.0 && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

COPY package*.json ./
RUN npm ci --force --omit=dev && npm cache clean --force

# Copy built app from builder
COPY --from=builder /usr/src/app/dist ./dist

# Switch to non-root user
USER nestjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health/live || exit 1

# Use dumb-init to handle PID 1 properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/src/main.js"]
