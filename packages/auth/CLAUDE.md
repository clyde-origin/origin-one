# @origin-one/auth

This package does one thing: wrap Supabase auth for use across all three apps.
One Supabase project. One login. One session token that works everywhere.

## What auth owns
- Identity (name, email, avatar)
- Team and org membership
- Role per project (director, producer, coordinator, writer, crew)
- Active project context

## What auth does NOT own
- Production data
- Creative documents
- App-specific preferences

## How it works
All three apps point to the same Supabase project for auth.
The session token issued at login is valid across Back to One, One Arc, and One Lore.
No re-login when switching apps.
