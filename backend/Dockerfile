# Backend Dockerfile - Express.js
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install system dependencies (curl for healthcheck, build tools for native deps like bcrypt)
RUN apk add --no-cache curl python3 make g++

# Install node dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S backend -u 1001

# Create audios directory with proper permissions
RUN mkdir -p /app/audios && chown -R backend:nodejs /app/audios

# Switch to non-root user
USER backend

# Expose ports
EXPOSE 3001 3209

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Start the application
CMD ["npm", "start"]
