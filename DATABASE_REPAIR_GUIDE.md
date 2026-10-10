# Database Repair and Schema Sync Guide

## Overview

This application automatically detects and repairs database schema mismatches caused by:
- Stale Prisma Client types (when database changes outpace client regeneration)
- Schema drift (when deployed database lags behind Prisma schema)
- Missing columns or constraint violations during data operations

## Quick Start

### Automatic Repair (Recommended for Production)

Set the environment variable before starting the application:
```bash
REBUILD_DATABASE=1 npm start
```

When the application starts, it will:
1. Check if `REBUILD_DATABASE=1` is set
2. Run non-destructive repairs via `src/instrumentation.ts`
3. Apply SQL fixes from `prisma/repair-existing-db.sql`
4. Log results to console
5. Continue normal operation

### Manual Repair

For immediate fixes without restarting:
```bash
npm run db:repair
```

This runs `prisma/repair-existing-db.sql` directly and logs output.

### Full Database Rebuild (Development Only)

⚠️ **WARNING**: This deletes all data. Use only in development environments.

```bash
npm run db:rebuild
```

This script:
- Validates the schema first
- Prompts for confirmation (unless `REBUILD_DATABASE=1`)
- Refuses to run in production/CI environments
- Runs `prisma db push --force-reset`

## How It Works

### 1. Build-Time: Prisma Client Regeneration

**File**: `package.json` (scripts section)

```json
"postinstall": "npm run db:generate",
"build": "npm run db:generate && next build"
```

**Why**: Ensures Prisma Client types are always fresh and match the schema:
- `postinstall`: Regenerates after `npm install` (fixes dependency updates)
- `build`: Regenerates immediately before Next.js compilation (fixes schema changes)

### 2. Startup-Time: Non-Destructive Database Repairs

**File**: `src/instrumentation.ts`

Next.js calls the `register()` function at Node.js startup (before any code runs). This:

```typescript
export async function register() {
  if (
    process.env.REBUILD_DATABASE !== '1' ||
    process.env.NEXT_RUNTIME !== 'nodejs' ||
    process.env.NEXT_PHASE === 'phase-production-build'
  ) {
    return;
  }

  // Run repairs...
}
```

**Safety checks**:
- Only runs when explicitly enabled (`REBUILD_DATABASE=1`)
- Skips during Next.js build phase
- Only runs in Node.js runtime (not edge)
- Preserves all existing data

**Repairs applied**:
- Adds missing columns (e.g., `description` on `acquired_skills`)
- Sets defaults for legacy `knowledge_entries.subject` and `knowledge_entries.summary` fields
- Never drops columns or modifies existing data

### 3. On-Demand: Manual Repair Command

**File**: `prisma/repair-existing-db.sql`

```bash
npm run db:repair
```

Applies the same SQL fixes manually without rebuilding the database.

## Error Reference

### P2022: Column doesn't exist
```
The column `table_name.column_name` does not exist in the current database.
```
**Cause**: Schema was updated but database migration wasn't applied.
**Fix**: `npm run db:repair` or `REBUILD_DATABASE=1 npm start`

### P2011: Null constraint violation
```
Null constraint violation on the fields: (`field_name`)
```
**Cause**: Required fields missing from input or database default not set.
**Fix**: Ensure API calls provide all required fields, or apply repairs to set defaults.

If the error names the legacy `knowledge_entries.summary` column, run `npm run db:repair` or restart with `REBUILD_DATABASE=1`. This sets a default for that old column without changing existing records.

## Deployment

### On Vercel or Similar PaaS

1. **First Deploy**: Push updated code, then manually run:
   ```bash
   npm run db:repair
   ```

2. **Subsequent Deploys**: Add build/startup command:
   ```bash
   REBUILD_DATABASE=1 npm start
   ```
   Or configure in `vercel.json`:
   ```json
   {
     "env": {
       "REBUILD_DATABASE": "1"
     }
   }
   ```

3. **Monitor**: Check application logs for messages:
   ```
   REBUILD_DATABASE=1: applying non-destructive database repairs
   ```

## Verification

After applying repairs, verify the database is working:

```bash
# Test API health
curl http://localhost:3000/api/health

# Test data retrieval
npm run dev
# Try creating/retrieving skills, knowledge entries, etc. in UI
```

## Troubleshooting

### Repairs don't seem to run

1. Check environment variable is set: `echo $REBUILD_DATABASE`
2. Check logs for `REBUILD_DATABASE=1:` messages
3. Verify `NEXT_RUNTIME` is set to `nodejs` (check Next.js logs)
4. Manually run: `npm run db:repair`

### Still getting P2022 or P2011 errors after repair

1. Check `prisma/repair-existing-db.sql` has the right column/field names
2. Run `npx prisma db pull` to refresh schema from database
3. Check database directly: `psql` and `\d table_name` (PostgreSQL)
4. Update SQL file with missing column definitions

### Data loss during rebuild

If you accidentally ran `npm run db:rebuild` and lost data:

1. Check git for backup (if you committed before rebuild)
2. Restore from database backups (if available)
3. Re-seed data as needed

## Files Modified

- `package.json`: Scripts for Prisma generation, repair, rebuild
- `src/instrumentation.ts`: Next.js startup hook for auto-repair
- `prisma/repair-existing-db.sql`: SQL definitions for non-destructive repairs
- `scripts/rebuild-db.cjs`: Full database rebuild with safety checks

## Related

- [Prisma Documentation](https://www.prisma.io/docs/)
- [Next.js Instrumentation](https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation)
- [Next.js Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
