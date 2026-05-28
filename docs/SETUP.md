# Project Setup Guide

Complete guide for setting up this project in a new environment, including all external service dependencies.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Variables](#environment-variables)
3. [Database Setup](#database-setup)
4. [Authentication Setup](#authentication-setup)
5. [Email Provider Setup](#email-provider-setup)
6. [SMS Provider Setup (MSG91)](#sms-provider-setup-msg91)
7. [Payment Provider Setup](#payment-provider-setup)
8. [Storage Setup](#storage-setup)
9. [Analytics Setup](#analytics-setup)
10. [Deployment Checklist](#deployment-checklist)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- **Node.js**: >= 20.x
- **pnpm**: 10.23.0+ (`npm install -g pnpm`)
- **PostgreSQL**: 14+ (local or hosted)
- **Git**: For version control

## Quick Start

```bash
# 1. Clone repository
git clone <repository-url>
cd studio-saas-monorepo

# 2. Install dependencies
pnpm install

# 3. Create environment file
cp .env.example .env.local

# 4. Configure environment variables (see sections below)

# 5. Run database migrations
pnpm db:migrate

# 6. Start development server
pnpm dev
```

---

## Environment Variables

Create `.env.local` in the project root. Below is a complete reference:

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `BETTER_AUTH_SECRET` | Auth session secret (32+ chars) | Generate with `openssl rand -base64 32` |
| `NEXT_PUBLIC_SITE_URL` | Public URL of your app | `http://localhost:3000` or `https://app.example.com` |

### Optional Variables by Category

See sections below for setup instructions for each service.

---

## Database Setup

### Option 1: Local PostgreSQL

```bash
# macOS with Homebrew
brew install postgresql@14
brew services start postgresql@14

# Create database
createdb studio_saas

# Connection string
DATABASE_URL="postgresql://localhost:5432/studio_saas"
```

### Option 2: PlanetScale (Serverless PostgreSQL)

1. Create account at [planetscale.com](https://planetscale.com)
2. Create a new database (select PostgreSQL)
3. Get connection string from dashboard
4. Use the connection string with `?sslmode=verify-full`

```env
DATABASE_URL="postgresql://user:password@region.pg.psdb.cloud:6432/db?sslmode=verify-full"
```

### Option 3: Supabase

1. Create project at [supabase.com](https://supabase.com)
2. Go to Settings > Database > Connection string
3. Copy the URI connection string

```env
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres"
```

### Option 4: Neon

1. Create account at [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string

```env
DATABASE_URL="postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require"
```

### Running Migrations

```bash
# Generate migrations from schema changes
pnpm db:generate

# Apply migrations to database
pnpm db:migrate

# Seed database (if applicable)
pnpm db:seed
```

---

## Authentication Setup

### Generate Auth Secret

```bash
# Generate a secure secret
openssl rand -base64 32
```

```env
BETTER_AUTH_SECRET="your-generated-secret-here"
```

### Google OAuth (Optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Navigate to **APIs & Services > Credentials**
4. Click **Create Credentials > OAuth 2.0 Client IDs**
5. Configure consent screen if prompted
6. Application type: **Web application**
7. Add authorized redirect URIs:
   - Development: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://yourdomain.com/api/auth/callback/google`

```env
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-your-secret"
```

### Google Calendar Integration (Optional)

This integration is separate from login OAuth so we can request Calendar scopes only when needed.

1. Go to Google Cloud Console and enable the **Google Calendar API**
2. Create a new OAuth 2.0 Client ID (Web application)
3. Add authorized redirect URIs:
   - Development: `http://localhost:3000/api/integrations/google-calendar/callback`
   - Production: `https://yourdomain.com/api/integrations/google-calendar/callback`

```env
GOOGLE_CALENDAR_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CALENDAR_CLIENT_SECRET="GOCSPX-your-secret"

# Required for storing integration tokens securely
INTEGRATIONS_TOKEN_ENCRYPTION_KEY=""  # Generate: openssl rand -base64 32
INTEGRATIONS_OAUTH_STATE_SECRET=""     # Generate: openssl rand -base64 32
```

### GitHub OAuth (Optional)

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Fill in:
   - Homepage URL: `http://localhost:3000` (or production URL)
   - Authorization callback URL: `http://localhost:3000/api/auth/callback/github`

```env
GITHUB_CLIENT_ID="your-client-id"
GITHUB_CLIENT_SECRET="your-client-secret"
```

---

## Email Setup

### Resend

1. Create account at [resend.com](https://resend.com)
2. Verify your domain
3. Create an API key

```env
RESEND_API_KEY="re_xxxxxxxxxxxx"
EMAIL_FROM_NAME="Stuwiz"
EMAIL_FROM_ADDRESS="noreply@updates.stuwiz.com"
EMAIL_REPLY_TO="hello@stuwiz.com"
EMAIL_BASE_URL="https://app.stuwiz.com"
EMAIL_ASSET_BASE_URL="https://app.stuwiz.com"
```

Auth email action links follow the origin that triggered the request
(`localhost`, tunnel, preview, or production). `EMAIL_BASE_URL` and
`EMAIL_ASSET_BASE_URL` still need to stay public for delivery checks and email
assets.

---

## SMS Provider Setup (MSG91)

1. Create account at [msg91.com](https://msg91.com)
2. Complete sender approval / DLT registration for your templates
3. Create SMS flow templates in MSG91
4. Add credentials:

```env
MSG91_AUTH_KEY="your-msg91-auth-key"
MSG91_SENDER_ID="your-6-char-sender-id"
MSG91_FLOW_CREW_ASSIGNMENT="your-msg91-flow-id-for-crew-assignment"
```

Optional worker tuning:

```env
SMS_OUTBOX_INTERVAL_MS="5000"   # Poll interval in ms (default: 5000)
SMS_OUTBOX_BATCH_SIZE="10"      # Messages per batch (default: 10)
```

Run SMS worker in development:

```bash
pnpm --filter @repo/sms-worker dev
```

Run SMS worker in production:

```bash
pnpm --filter @repo/sms-worker build
pnpm --filter @repo/sms-worker start
```

---

## Payment Provider Setup

### DodoPayments

1. Create account at [dodopayments.com](https://dodopayments.com)
2. Get API key from dashboard
3. Set up webhook endpoint: `https://yourdomain.com/api/webhooks/payments`

```env
DODO_PAYMENTS_API_KEY="your-api-key"
DODO_PAYMENTS_WEBHOOK_SECRET="whsec_xxxx"
# Optional: force test checkout on dev/staging deployments that still run with NODE_ENV=production.
DODO_PAYMENTS_ENVIRONMENT="test_mode"
```

`DODO_PAYMENTS_ENVIRONMENT` accepts `test_mode` or `live_mode`. If omitted, local
development uses `test_mode` and production uses `live_mode`. For
`dev.stuwiz.com`, set this to `test_mode` and use Dodo test API/product/catalog
IDs so signup checkout stays in Dodo test mode.

### Product IDs

After creating products in DodoPayments, add the live catalog IDs:

```env
DODO_PRODUCT_COLLECTION_ID_STUDIO_BASICS=""
DODO_PRODUCT_ID_STUDIO_BASICS_MONTHLY="price_xxx"
DODO_PRODUCT_ID_STUDIO_BASICS_YEARLY="price_xxx"

# Optional: set to "0" to disable inline checkout and use full-page checkout
NEXT_PUBLIC_DODO_INLINE_CHECKOUT="1"
```

### Product Collection + Customer Portal

For real plan changes between `Studio Basics Monthly` and `Studio Basics Yearly`, configure Dodo before going live:

1. Create one Product Collection for `Studio Basics`
2. Add both recurring products to that collection:
   - `Studio Basics Monthly`
   - `Studio Basics Yearly`
3. Keep `Studio Basics Monthly` first in the collection if you want checkout to open with the monthly option first
4. In the collection subscription settings:
   - enable `Allow Subscription Updates`
   - disable `Allow Multiple Subscriptions`
5. In Customer Portal settings:
   - enable subscription management / plan changes
   - keep payment method updates enabled

The app keeps one `Studio Basics` card and sends new signups through the Product Collection checkout so Dodo can present monthly and yearly billing inside checkout. Active subscribers should still switch monthly/yearly billing from the Dodo billing portal so we do not create duplicate subscriptions.

---

## Storage Setup

For file uploads (avatars, attachments, etc.)

### S3-Compatible Storage

Works with AWS S3, Cloudflare R2, MinIO, DigitalOcean Spaces, etc.

```env
S3_ACCESS_KEY_ID="your-access-key"
S3_SECRET_ACCESS_KEY="your-secret-key"
S3_ENDPOINT="https://s3.amazonaws.com"  # or your provider's endpoint
S3_REGION="us-east-1"
NEXT_PUBLIC_AVATARS_BUCKET_NAME="avatars"
```

#### Provider-Specific Endpoints

| Provider | Endpoint |
|----------|----------|
| AWS S3 | `https://s3.{region}.amazonaws.com` |
| Cloudflare R2 | `https://{account_id}.r2.cloudflarestorage.com` |
| DigitalOcean Spaces | `https://{region}.digitaloceanspaces.com` |
| MinIO | `http://localhost:9000` (self-hosted) |

---

## Analytics Setup

Choose any combination of analytics providers.

### Google Analytics

1. Create property at [analytics.google.com](https://analytics.google.com)
2. Get Measurement ID (starts with G-)

```env
NEXT_PUBLIC_GOOGLE_ANALYTICS_ID="G-XXXXXXXXXX"
```

### Mixpanel

1. Create project at [mixpanel.com](https://mixpanel.com)
2. Get project token from Settings

```env
NEXT_PUBLIC_MIXPANEL_TOKEN="your-token"
```

### Pirsch

```env
NEXT_PUBLIC_PIRSCH_CODE="your-code"
```

### Plausible

```env
NEXT_PUBLIC_PLAUSIBLE_URL="https://plausible.io"  # or self-hosted URL
```

---

## AI Features Setup

### OpenAI

1. Create account at [platform.openai.com](https://platform.openai.com)
2. Create API key

```env
OPENAI_API_KEY="sk-xxxx"
```

---

## Deployment Checklist

### Before Deploying

- [ ] All required environment variables are set
- [ ] Database is accessible from deployment environment
- [ ] Database migrations have been run
- [ ] `NEXT_PUBLIC_SITE_URL` matches your production domain
- [ ] `EMAIL_BASE_URL` points to a public domain, never localhost
- [ ] OAuth redirect URIs updated for production domain
- [ ] Webhook URLs updated for production domain
- [ ] SSL/TLS certificate is configured

### Environment-Specific Changes

| Setting | Development | Production |
|---------|-------------|------------|
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | `https://app.yourdomain.com` |
| `EMAIL_BASE_URL` | `https://preview.yourdomain.com` or production domain | `https://app.yourdomain.com` |
| `DATABASE_URL` | Local PostgreSQL | Production database |
| OAuth Redirect URIs | `localhost:3000` | `app.yourdomain.com` |
| Webhook URLs | Use ngrok/localtunnel | Production URLs |
| Payment Keys | Test/Sandbox keys | Live keys |

### Vercel Deployment

1. Import repository in Vercel
2. Add all environment variables in Project Settings > Environment Variables
3. Deploy

### Docker Deployment

```bash
# Build
docker build -t studio-saas .

# Run with env file
docker run --env-file .env.local -p 3000:3000 studio-saas
```

---

## Troubleshooting

### Database Connection Issues

```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Common issues:
# - SSL required: Add ?sslmode=require to connection string
# - IP not whitelisted: Add your IP to database firewall rules
```

### OAuth Not Working

- Verify redirect URIs match exactly (including http vs https)
- Check that client ID and secret are correct
- Ensure OAuth consent screen is configured

### Emails Not Sending

- Verify API key is correct
- Check domain verification status
- Review provider's sending limits

### Payments Not Processing

- Ensure you're using correct keys (test vs live)
- Verify webhook endpoint is accessible
- Check webhook secret matches

### Build Errors

```bash
# Skip env validation during build (useful for CI)
SKIP_ENV_VALIDATION=true pnpm build
```

---

## Environment Template

Copy this to `.env.local` and fill in values:

```env
# ===================
# REQUIRED
# ===================
DATABASE_URL="postgresql://user:password@localhost:5432/studio_saas"
BETTER_AUTH_SECRET=""  # Generate: openssl rand -base64 32
NEXT_PUBLIC_SITE_URL="http://localhost:3000"

# ===================
# AUTHENTICATION (Optional)
# ===================
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# Google Calendar Integration (Optional)
GOOGLE_CALENDAR_CLIENT_ID=""
GOOGLE_CALENDAR_CLIENT_SECRET=""
INTEGRATIONS_TOKEN_ENCRYPTION_KEY=""
INTEGRATIONS_OAUTH_STATE_SECRET=""

# ===================
# EMAIL
# ===================
RESEND_API_KEY=""
EMAIL_FROM_NAME="Stuwiz"
EMAIL_FROM_ADDRESS="noreply@updates.stuwiz.com"
EMAIL_REPLY_TO="hello@stuwiz.com"
EMAIL_BASE_URL="https://app.stuwiz.com"
EMAIL_ASSET_BASE_URL="https://app.stuwiz.com"

# ===================
# PAYMENTS
# ===================
DODO_PAYMENTS_API_KEY=""
DODO_PAYMENTS_WEBHOOK_SECRET=""

# Product IDs
DODO_PRODUCT_COLLECTION_ID_STUDIO_BASICS=""
DODO_PRODUCT_ID_STUDIO_BASICS_MONTHLY=""
DODO_PRODUCT_ID_STUDIO_BASICS_YEARLY=""

# ===================
# STORAGE (Optional)
# ===================
S3_ACCESS_KEY_ID=""
S3_SECRET_ACCESS_KEY=""
S3_ENDPOINT=""
S3_REGION=""
NEXT_PUBLIC_AVATARS_BUCKET_NAME="avatars"

# ===================
# ANALYTICS (Optional)
# ===================
NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=""

# ===================
# AI (Optional)
# ===================
OPENAI_API_KEY=""
```

---

## Related Documentation

- [Architecture Overview](./ARCHITECTURE.md)
- [Contributing Guide](../CONTRIBUTING.md)
- [ADRs](./adr/README.md)
