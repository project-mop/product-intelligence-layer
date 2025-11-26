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

## Authentication

The application uses NextAuth.js with email/password authentication:

- **Signup:** `/signup` - Create a new account with email and password
- **Login:** `/login` - Sign in with existing credentials
- **Forgot Password:** `/forgot-password` - Request password reset email
- **Reset Password:** `/reset-password?token=...` - Set new password

### Session Configuration

Sessions are stored in the database and expire after 30 days by default. Configure via:

```bash
# In .env (optional, value in seconds)
NEXTAUTH_SESSION_MAX_AGE=2592000  # 30 days
```

### Email Notifications (N8N)

Password reset and welcome emails are triggered via N8N webhooks. Configure:

```bash
# In .env
N8N_WEBHOOK_BASE_URL="https://your-n8n-instance.com/webhook"
N8N_WEBHOOK_SECRET="your-secret"
```

## API Keys

API keys are used to authenticate requests to the public API. Manage keys from the dashboard:

- **Dashboard:** `/dashboard/api-keys` - Create, view, rotate, and revoke API keys

### Key Format

```
pil_{environment}_{random}

Examples:
- pil_live_a1b2c3d4...  (Production)
- pil_test_f6e5d4c3...  (Sandbox)
```

### Usage

Include the API key in the `Authorization` header:

```bash
curl -H "Authorization: Bearer pil_live_..." https://api.example.com/v1/process
```

### Configuration

```bash
# In .env (optional, default: 90 days)
API_KEY_DEFAULT_EXPIRY_DAYS=90
```

### Security Notes

- Keys are stored as SHA-256 hashes (plaintext shown only once at creation)
- Keys can be rotated (old key immediately revoked, new key generated)
- Revoked/expired keys return 401 Unauthorized

## Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start development server with Turbopack |
| `pnpm build` | Build for production |
| `pnpm start` | Start production server |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm lint` | Run ESLint |
| `pnpm test` | Run all tests |
| `pnpm test:unit` | Run unit tests only |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm test:coverage` | Run tests with coverage report |
| `pnpm db:seed` | Seed database with sample data |
| `pnpm prisma db push` | Push Prisma schema to database |
| `pnpm prisma studio` | Open Prisma Studio |
| `pnpm prisma generate` | Regenerate Prisma client |
| `pnpm prisma migrate dev` | Create and apply migrations |

## Technology Stack

- **Framework:** Next.js 15.5.x (App Router)
- **Language:** TypeScript 5.9.x
- **API:** tRPC 11.x (internal), REST (public)
- **Database:** PostgreSQL 16.x via Prisma 7.x
- **Auth:** NextAuth.js 5.x (Credentials Provider)
- **Styling:** Tailwind CSS 4.x
- **Testing:** Vitest + Testing Library
- **Hosting:** Railway

## Project Structure

```
product-intelligence-layer/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/             # Authentication pages (login, signup, etc.)
│   │   └── dashboard/          # Dashboard pages
│   │       └── api-keys/       # API key management UI
│   ├── server/                 # Backend logic (tRPC, services)
│   │   ├── api/                # tRPC routers
│   │   │   └── routers/        # Route handlers (auth, apiKey, etc.)
│   │   ├── auth/               # NextAuth configuration
│   │   └── services/           # Business logic services
│   │       ├── auth/           # API key generation & validation
│   │       └── n8n/            # N8N webhook client
│   ├── trpc/                   # tRPC client setup
│   ├── lib/                    # Shared utilities (ID generation, etc.)
│   └── styles/                 # Global styles
├── prisma/                     # Database schema
├── tests/                      # Test files
│   ├── unit/                   # Unit tests
│   └── integration/            # Integration tests
├── docs/                       # Project documentation
└── bmad/                       # BMAD methodology files
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
