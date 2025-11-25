# Product Intelligence Layer

Multi-tenant SaaS platform for converting product metadata into private, schema-constrained intelligence APIs.

Built with the [T3 Stack](https://create.t3.gg/): Next.js, tRPC, Prisma, NextAuth, and Tailwind CSS.

## Prerequisites

- Node.js 20.x LTS
- pnpm 9.x
- PostgreSQL 16.x (local or Railway)

## Getting Started

### 1. Clone and Install

```bash
git clone <repo-url>
cd product-intelligence-layer
pnpm install
```

### 2. Environment Setup

```bash
# Copy the example environment file
cp .env.example .env

# Generate NextAuth secret
npx auth secret
# Copy the generated secret to AUTH_SECRET in .env

# Update DATABASE_URL with your PostgreSQL connection string
# For Railway: Get connection string from Railway dashboard
# For local: postgresql://postgres:password@localhost:5432/product-intelligence-layer
```

### 3. Database Setup

**Option A: Local PostgreSQL (macOS with Homebrew)**

```bash
# Install PostgreSQL 16
brew install postgresql@16

# Start PostgreSQL service
brew services start postgresql@16

# Create the database
/opt/homebrew/opt/postgresql@16/bin/createdb product-intelligence-layer

# Update .env with local connection string
# DATABASE_URL="postgresql://YOUR_USERNAME@localhost:5432/product-intelligence-layer"
```

**Option B: Railway PostgreSQL**

1. Create a project at [railway.app](https://railway.app)
2. Add PostgreSQL database plugin
3. Copy connection string from Variables tab
4. Update `DATABASE_URL` in `.env`

**Then sync the schema:**

```bash
# Push schema to database
pnpm prisma db push

# (Optional) Open Prisma Studio to view data
pnpm prisma studio
```

### 4. Run Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start development server with Turbopack |
| `pnpm build` | Build for production |
| `pnpm start` | Start production server |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm lint` | Run ESLint |
| `pnpm prisma db push` | Push Prisma schema to database |
| `pnpm prisma studio` | Open Prisma Studio |
| `pnpm prisma generate` | Regenerate Prisma client |
| `pnpm prisma migrate dev` | Create and apply migrations |

## Technology Stack

- **Framework:** Next.js 15.5.x (App Router)
- **Language:** TypeScript 5.9.x
- **API:** tRPC 11.x (internal), REST (public)
- **Database:** PostgreSQL 16.x via Prisma 7.x
- **Auth:** NextAuth.js 5.x
- **Styling:** Tailwind CSS 4.x
- **Hosting:** Railway

## Project Structure

```
product-intelligence-layer/
├── src/
│   ├── app/           # Next.js App Router
│   ├── server/        # Backend logic (tRPC, services)
│   ├── trpc/          # tRPC client setup
│   └── styles/        # Global styles
├── prisma/            # Database schema
├── docs/              # Project documentation
└── bmad/              # BMAD methodology files
```

## Documentation

- [Architecture](./docs/architecture.md)
- [Epic Breakdown](./docs/epics.md)
- [PRD](./Product_Intelligence_Layer_PRD.md)

## Deployment

This project is designed to deploy on Railway:

1. Connect your GitHub repository to Railway
2. Add PostgreSQL database plugin
3. Set environment variables in Railway dashboard
4. Deploy automatically on push to `main`
