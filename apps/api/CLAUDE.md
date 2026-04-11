# @origin-one/api

This package does one thing: serve as the shared backend for all three apps.

## What this app does
- Single API layer that Back to One, One Arc, and One Lore all talk to
- Owns server-side business logic
- Interfaces with packages/db for all database operations

## What this app does NOT do
- No UI of any kind
- Does not import from other apps

## Imports from
- @origin-one/schema
- @origin-one/db
- @origin-one/auth
