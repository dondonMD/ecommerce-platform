# E-Commerce Platform Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the e-commerce platform to production environments.

## Prerequisites

- Node.js 20.19+ or 22.12+
- Docker and Docker Compose
- MySQL 8.0+
- Redis 7.0+
- AWS S3 bucket (for file storage)
- Stripe account (for payments)
- OAuth provider (Manus OAuth)

## Environment Configuration

### Required Environment Variables

Create a `.env` file in the project root with the following variables:

```bash
# Database
DATABASE_URL="mysql://user:password@localhost:3306/ecommerce"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT/Session
SESSION_SECRET="your-super-secret-session-key-here"

# OAuth (Manus)
OAUTH_CLIENT_ID="your-oauth-client-id"
OAUTH_CLIENT_SECRET="your-oauth-client-secret"
OAUTH_REDIRECT_URI="http://localhost:3000/api/oauth/callback"

# Stripe
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
VITE_STRIPE_PUBLISHABLE_KEY="pk_test_..."

# AWS S3
AWS_ACCESS_KEY_ID="your-aws-access-key"
AWS_SECRET_ACCESS_KEY="your-aws-secret-key"
AWS_S3_BUCKET_NAME="your-bucket-name"
AWS_REGION="us-east-1"

# Server
NODE_ENV="production"
PORT="3000"
```

## Local Development Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Database Setup

```bash
# Start MySQL and Redis with Docker
docker-compose up -d mysql redis

# Run database migrations
pnpm run db:push
```

### 3. Start Development Server

```bash
pnpm run dev
```

The application will be available at `http://localhost:3000`.

## Production Deployment

### Option 1: Docker Deployment

#### Build and Run with Docker Compose

1. **Update docker-compose.prod.yml** (create if not exists):

```yaml
version: "3.8"

services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: ecommerce
      MYSQL_USER: ${MYSQL_USER}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD}
    volumes:
      - mysql_data:/var/lib/mysql
    ports:
      - "3306:3306"
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    restart: unless-stopped

  app:
    build: .
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - SESSION_SECRET=${SESSION_SECRET}
      - OAUTH_CLIENT_ID=${OAUTH_CLIENT_ID}
      - OAUTH_CLIENT_SECRET=${OAUTH_CLIENT_SECRET}
      - OAUTH_REDIRECT_URI=${OAUTH_REDIRECT_URI}
      - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
      - STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET}
      - VITE_STRIPE_PUBLISHABLE_KEY=${VITE_STRIPE_PUBLISHABLE_KEY}
      - AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
      - AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
      - AWS_S3_BUCKET_NAME=${AWS_S3_BUCKET_NAME}
      - AWS_REGION=${AWS_REGION}
      - NODE_ENV=production
      - PORT=3000
    ports:
      - "3000:3000"
    depends_on:
      - mysql
      - redis
    restart: unless-stopped

volumes:
  mysql_data:
```

2. **Create Dockerfile**:

```dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the application
RUN corepack enable pnpm && pnpm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 ecommerce

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

USER ecommerce

EXPOSE 3000

ENV PORT 3000

CMD ["node", "dist/index.js"]
```

3. **Deploy**:

```bash
# Build and deploy
docker-compose -f docker-compose.prod.yml up -d --build
```

### Option 2: Cloud Deployment (Vercel/Netlify + Railway/PlanetScale)

#### Frontend Deployment (Vercel)

1. **Connect to Vercel**:

   ```bash
   pnpm install -g vercel
   vercel
   ```

2. **Configure build settings**:
   - Build Command: `vite build`
   - Output Directory: `dist`
   - Install Command: `pnpm install`

3. **Environment Variables**: Add all client-side environment variables (prefixed with `VITE_`)

#### Backend Deployment (Railway)

1. **Connect to Railway**:
   - Create a new project
   - Connect your GitHub repository

2. **Database Setup**:
   - Add MySQL database
   - Add Redis database

3. **Environment Variables**: Add all server-side environment variables

4. **Build Settings**:
   - Build Command: `pnpm run build`
   - Start Command: `node dist/index.js`

## Stripe Webhook Configuration

### 1. Create Webhook Endpoint in Stripe Dashboard

1. Go to Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. Set URL: `https://yourdomain.com/api/webhooks/stripe`
4. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `checkout.session.completed`

### 2. Copy Webhook Secret

Add the webhook signing secret to your `STRIPE_WEBHOOK_SECRET` environment variable.

## SSL/TLS Configuration

### Using Let's Encrypt (with Caddy)

```bash
# Caddyfile
yourdomain.com {
    reverse_proxy localhost:3000
    tls your-email@example.com
}
```

### Using Nginx

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Monitoring and Logging

### Health Checks

The application provides a health check endpoint at `/health`:

```bash
curl https://yourdomain.com/health
```

### Logging

Logs are output to stdout/stderr. Configure your deployment platform to capture these logs.

### Monitoring

Consider integrating:

- Application Performance Monitoring (APM)
- Error tracking (Sentry)
- Database monitoring
- Server monitoring (CPU, memory, disk)

## Backup Strategy

### Database Backups

```bash
# Daily backup script
mysqldump -u user -p password ecommerce > backup_$(date +%Y%m%d).sql
```

### File Storage Backups

Configure AWS S3 versioning and lifecycle policies for automatic backups.

## Security Checklist

- [ ] Environment variables properly configured
- [ ] Database credentials secured
- [ ] SSL/TLS enabled
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] Security headers set
- [ ] Dependencies updated regularly
- [ ] Regular security audits performed

## Troubleshooting

### Common Issues

1. **Build fails with Node.js version error**
   - Ensure Node.js 20.19+ is installed
   - Update Vercel/Railway Node.js version settings

2. **Database connection fails**
   - Verify DATABASE_URL format
   - Check database server is running
   - Ensure firewall allows connections

3. **Stripe webhooks not working**
   - Verify webhook URL is accessible
   - Check STRIPE_WEBHOOK_SECRET is correct
   - Ensure HTTPS is enabled for webhooks

4. **File uploads failing**
   - Verify AWS credentials
   - Check S3 bucket permissions
   - Ensure bucket exists and is in correct region

### Performance Optimization

- Enable gzip compression
- Configure CDN for static assets
- Implement database query optimization
- Set up Redis caching
- Monitor and optimize bundle size

## Support

For additional support, check:

- Application logs
- Database logs
- Stripe dashboard for payment issues
- AWS CloudWatch for infrastructure issues
