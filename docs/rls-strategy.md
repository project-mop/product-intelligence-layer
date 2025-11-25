# Row-Level Security (RLS) Strategy

**Status:** Documented for future implementation
**Related Story:** 1.2 (Multi-Tenant Database Schema)
**Target Story:** TBD (Security hardening)

## Overview

Row-Level Security (RLS) provides database-level enforcement of tenant isolation as a defense-in-depth layer. For MVP, we use application-level filtering (all queries include `tenantId` in WHERE clause). RLS can be added without schema changes.

## Current Approach (MVP)

### Application-Level Tenant Filtering

All database queries for tenant-scoped data include `tenantId` in the WHERE clause:

```typescript
// tRPC router example
export const processRouter = createTRPCRouter({
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.process.findFirst({
        where: {
          id: input.id,
          tenantId: ctx.tenantId, // ALWAYS filter by tenant
          deletedAt: null,
        },
      });
    }),
});
```

### Protected Procedure Pattern

The `protectedProcedure` extracts `tenantId` from the authenticated session:

```typescript
export const protectedProcedure = t.procedure
  .use(({ ctx, next }) => {
    if (!ctx.session?.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return next({
      ctx: {
        session: ctx.session,
        tenantId: ctx.session.user.tenantId,
      },
    });
  });
```

## Future RLS Implementation

### Why RLS?

1. **Defense in Depth:** Even if application code has a bug that forgets `tenantId`, RLS blocks the query
2. **Audit Compliance:** Database-level controls satisfy security auditors
3. **Bug Prevention:** Makes cross-tenant data access impossible at the database layer

### PostgreSQL RLS Setup

When ready to implement, apply these policies:

```sql
-- Enable RLS on tenant-scoped tables
ALTER TABLE "Process" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProcessVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApiKey" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CallLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ResponseCache" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RateLimit" ENABLE ROW LEVEL SECURITY;

-- Create policy for Process table
CREATE POLICY tenant_isolation_policy ON "Process"
  USING ("tenantId" = current_setting('app.current_tenant_id')::text);

-- Repeat for other tables...
```

### Application Integration

Set tenant context before each request:

```typescript
// In request middleware
await db.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
```

### Prisma Considerations

1. **Connection Pooling:** RLS settings are per-connection, so ensure tenant context is set correctly with pooled connections
2. **Prisma Transactions:** Context must be set within the transaction
3. **Testing:** Need to verify RLS doesn't break Prisma operations

## Implementation Checklist

When implementing RLS:

- [ ] Create migration to enable RLS on all tenant-scoped tables
- [ ] Create tenant isolation policies
- [ ] Update database middleware to set `app.current_tenant_id`
- [ ] Test with Prisma connection pooling
- [ ] Verify no performance regression
- [ ] Update security documentation
- [ ] Add integration tests for RLS enforcement

## Tenant-Scoped Tables

The following tables require RLS policies:

| Table | tenantId Column | Notes |
|-------|-----------------|-------|
| User | tenantId | User belongs to tenant |
| Process | tenantId | Core business entity |
| ProcessVersion | via Process | Join through Process |
| ApiKey | tenantId | API authentication |
| CallLog | tenantId | Audit logs |
| ResponseCache | tenantId | Caching |
| RateLimit | tenantId | Quotas |

## Non-Tenant Tables

These tables do NOT have RLS:

| Table | Reason |
|-------|--------|
| Tenant | Parent entity |
| Account | OAuth, linked via User |
| Session | Auth session, linked via User |
| VerificationToken | Auth tokens, no tenant scope |

## References

- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Prisma Multi-Tenant Patterns](https://www.prisma.io/docs/guides/other/multi-tenancy)
- Architecture: `docs/architecture.md#Security-Architecture`
