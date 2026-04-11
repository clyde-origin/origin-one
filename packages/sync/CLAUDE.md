# @origin-one/sync

This package does one thing: handle offline-first data sync for Back to One.

## Why this is isolated
Back to One must work on set with no internet connection.
This logic is kept separate so it can be tested and improved independently.

## Rules
- Offline-first — app functions completely without connection
- Conflict-aware — multiple editors on set is the norm
- Resilient — offline writes queue and reconcile when signal returns
