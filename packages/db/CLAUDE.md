# @origin-one/db

This package does one thing: own the database schema, migrations, and client.

## What lives here
- Prisma schema
- All migrations
- Database client exported for use by all apps

## Rules
- Schema changes here must be coordinated with packages/schema type changes
- Never import from apps
- Never contain business logic
