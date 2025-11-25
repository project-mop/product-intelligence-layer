# Database Debt Log

<!--
PURPOSE: This file tracks database-related requirements that are pending implementation
until a PostgreSQL database is configured and connected.

USAGE:
- Add entries as stories are developed without database connectivity
- Each entry should include:
  - Source story/task
  - Description of the database element or action
  - Implementation location (file path where it should be wired up)
  - Priority (blocking/high/medium/low)
- Remove entries as they are implemented
- Run `pnpm prisma db push` after database is configured to sync schema

RESOLUTION:
1. Set up PostgreSQL (local via Homebrew or Railway)
2. Add DATABASE_URL to .env
3. Run `pnpm prisma db push` to sync schema
4. Address each item in this log
5. Delete resolved entries
-->

---

## ⚠️ IMPORTANT: Local Services in Use

**We are currently using LOCAL services for development.**

This is a temporary setup. Before deploying to production or sharing the project:
1. Set up a Railway PostgreSQL database (or other hosted provider)
2. Update `DATABASE_URL` in `.env` with the production connection string
3. Run `pnpm prisma db push` to sync schema to the production database
4. Update CI/CD secrets with the production DATABASE_URL

The local services are NOT accessible to other developers or CI/CD pipelines.

### Local Services Created

| Service | Installation Method | Status | Management Commands |
|---------|---------------------|--------|---------------------|
| PostgreSQL 16 | Homebrew (`brew install postgresql@16`) | Running as background service | `brew services start/stop postgresql@16` |

### PostgreSQL Details

- **Version:** 16.x
- **Database Name:** `product-intelligence-layer`
- **Connection:** `postgresql://zac@localhost:5432/product-intelligence-layer`
- **Data Directory:** `/opt/homebrew/var/postgresql@16`
- **Binary Path:** `/opt/homebrew/opt/postgresql@16/bin/`

### Useful Commands

```bash
# Start PostgreSQL
brew services start postgresql@16

# Stop PostgreSQL
brew services stop postgresql@16

# Check service status
brew services list | grep postgresql

# Connect to database via psql
/opt/homebrew/opt/postgresql@16/bin/psql product-intelligence-layer

# List all databases
/opt/homebrew/opt/postgresql@16/bin/psql -l
```

---

## Resolved Items

### Story 1.1: Project Setup & Infrastructure Initialization (RESOLVED)

- **Status:** ✅ COMPLETE
- **Database:** Local PostgreSQL via Homebrew (postgresql@16)
- **Connection:** `postgresql://zac@localhost:5432/product-intelligence-layer`
- **Resolution Date:** 2025-11-25
- **Note:** Using local database for development only - production setup pending

All items from Story 1.1 have been resolved:
- [x] Initial Schema Sync - `pnpm prisma db push` successful
- [x] Database Connection Verified - Dev server returns HTTP 200
- [x] Prisma Studio accessible

---

## Pending Items

_No pending database debt items._

---

## Database Configuration Reference

**Current Setup:** Local PostgreSQL via Homebrew

```bash
# Start PostgreSQL
brew services start postgresql@16

# Stop PostgreSQL
brew services stop postgresql@16

# Connect to database
/opt/homebrew/opt/postgresql@16/bin/psql product-intelligence-layer
```

**For Production (Railway):**
1. Create account at railway.app
2. Create new project
3. Add PostgreSQL database plugin
4. Copy connection string from Variables tab
5. Update `.env` with Railway DATABASE_URL
