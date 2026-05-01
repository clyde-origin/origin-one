# Settings Sheet (project selection page)

**Date:** 2026-05-01
**Status:** Spec — pending implementation
**Surface:** `/projects`

## Goal

Give the signed-in user one place on the project selection page for
account-and-system-level actions: change avatar, pick theme (in prep for
light mode), sign out. Remove the existing isolated logout icon in the
top-right and consolidate into a single Settings tray.

## Trigger

A 32px gear button, fixed at the bottom-left of `/projects`. Mirrors the
bottom-safe-area math the FAB already uses on the bottom-right
(`bottom: calc(18px + env(safe-area-inset-bottom, 0px))`), so it sits
flush with the FAB visually. Reuses the same circle styling as the
existing top-right logout button (`32px`, `rgba(255,255,255,0.05)` bg,
`1px solid rgba(255,255,255,0.05)` border) so it inherits a known
visual treatment.

The current top-right logout button (`apps/back-to-one/src/app/projects/page.tsx:692`)
is **removed** in this change — its function moves into the sheet.

## Sheet

Uses the existing `Sheet` primitive (slide up from bottom, 20px top
border-radius, dark `#0e0e1a` background, drag-down to close, single
backdrop). Header: `<SheetHeader title="Settings" onClose={...} />`.

Body sections in order:

### 1. Avatar block

- Circular avatar (size 64), reads `User.avatarUrl` via `useMeId` →
  `useCrew(... )` lookup, falling back to the existing `CrewAvatar`
  initials placeholder when no URL is set.
- Display name and email below the avatar (small mono email,
  `#a0a0b8` body name).
- Tap behavior: opens the native `<input type="file" accept="image/*">`
  picker. On selection: calls `uploadAvatar(file, userId)` (already
  exists in `queries.ts`), invalidates the relevant React Query keys so
  the avatar updates everywhere it appears.
- No in-app crop, no preview sub-sheet, no remove path. (User chose
  flow A in brainstorming.) "Remove avatar" can land later if needed.
- Loading state: small spinner overlay on the avatar circle while
  upload is in flight.
- Error: surface the error inline as a small text row beneath the
  avatar, no toast.

### 2. Theme

- Segmented pill row: `Light · Dark · System`. Default `Dark`.
- Tapping a pill writes the choice to `localStorage` under
  `theme-preference`. Reading and applying the preference at app load
  is **out of scope** for this spec — that lands when light mode is
  fully integrated.
- Visually identical to the role pill row used in `CreateTaskSheet`
  (compact, accent-tinted active state).

### 3. Sign out

- Full-width row, destructive accent (uses the
  `#e8a020` amber that the codebase already treats as a warning, not
  a hard red).
- Tap → in-sheet confirm: row collapses into `Are you sure? · Cancel ·
  Sign out` inline (no second sheet). Confirming → calls
  `supabase.auth.signOut()` and `router.push('/login')` (mirrors the
  existing `handleLogout` flow at line 136 of `projects/page.tsx`).

### 4. App version footer

- Small font-mono row at the bottom of the sheet body, e.g.
  `back-to-one v0.0.0`.
- Sourced from a `package.json` import:
  `import pkg from '../../../../package.json'`. Display
  `pkg.version`.

## Data

- `useMeId()` for User.id.
- `useCurrentUser()` (or equivalent — needs a small lookup hook if not
  already present that returns `{ id, name, email, avatarUrl }` for
  the signed-in user). Add a thin `useMe()` hook in `useOriginOne.ts`
  if one doesn't exist.
- `uploadAvatar(file, userId)` — existing in `queries.ts:1394`.
- React Query key invalidations on avatar upload: `['crew', ...]`,
  `['allCrew']`, `['me']` (the new hook).

## Files

- **New:** `apps/back-to-one/src/components/settings/SettingsSheet.tsx`
- **New (if needed):** `useMe()` hook addition in
  `apps/back-to-one/src/lib/hooks/useOriginOne.ts`
- **Edit:** `apps/back-to-one/src/app/projects/page.tsx`
  - Add the gear button (bottom-left).
  - Mount `SettingsSheet`.
  - Remove the existing top-right logout button (lines 692–700).
  - Remove `handleLogout` from this file. SettingsSheet owns its own
    sign-out logic so the projects page doesn't need to know about
    auth flow at all.

## Out of scope

- Actually applying the chosen theme to render the app in light mode.
  Only the picker UI ships; the rendering switch lands with the
  user's separately-designed light mode integration.
- Remove-avatar path (can be added later if needed).
- Notifications, profile-deep-edit, account password reset — those
  belong on a future Profile page, not on a quick settings tray.

## Open questions

None. Both surfaced questions resolved in brainstorming:
- Existing top-right logout: **removed**, function moves into Settings.
- Sign-out confirm: **yes**, in-sheet confirm row.
