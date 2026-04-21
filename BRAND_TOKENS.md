# Origin One — Brand Tokens

Single source of truth for the brand's color, gradient, and typography tokens.

The full brand-token migration (phase accents, project accents, UI greys, status
hexes, typography scale) is a separate follow-up. This file is created now so
the Thread System has a canonical home — tokens here are imported and consumed
directly, not re-derived.

---

## Thread System

Thread colors are **fixed** — they are never project-derived, never phase-derived.
A thread looks the same in every project, on every screen, across every app.

### Core palette

| Token     | Hex       | Use                                                            |
|-----------|-----------|----------------------------------------------------------------|
| `TV`      | `#7C3AED` | Thread violet — primary thread color. Icons, CTAs, read dots.  |
| `TA`      | `#F59E0B` | Thread amber — unread state. Badges, pulse, unread dots.       |
| `TA_DEEP` | `#D97706` | Unread badge background — higher-contrast amber for count pill. |

### Usage rules

- **Unread state** → `TA` (dot, left rail, border tint). `TA_DEEP` for count
  badge backgrounds where higher contrast against `#080808` is needed.
- **Read state** → `TV` (icon fill, small presence dot, send-reply chevron).
- **Resolved state** → muted white (`rgba(255,255,255,0.22)`) — no thread color.
- **Never** mix thread colors with project accents. A thread surface uses
  thread tokens only. A project surface uses project tokens only. They share no
  pixels.

### Object/chip accents (per attachment type)

These color threads by what they're attached to — shot threads look different
from location threads. Non-phase accents only (amber / indigo / teal are
reserved for Pre / Prod / Post phase semantics).

| Chip key            | Hex       | Meaning               |
|---------------------|-----------|-----------------------|
| `obj-shot`          | `#9b6ef3` | violet                |
| `obj-scene`         | `#b890f0` | lavender              |
| `obj-location`      | `#3cbe6a` | green                 |
| `obj-character`     | `#e8507a` | rose                  |
| `obj-cast`          | `#f07050` | coral                 |
| `obj-crew`          | `#6888b8` | slate                 |
| `obj-prop`          | `#f08030` | orange                |
| `obj-wardrobe`      | `#e868c8` | pink                  |
| `obj-hmu`           | `#50d898` | mint                  |
| `obj-moodboardRef`  | `#e8e0d0` | warm white            |
| `obj-actionItem`    | `#e8c44a` | gold                  |
| `obj-milestone`     | `#22d4d4` | cyan                  |
| `obj-deliverable`   | `#e84848` | red                   |
| `obj-workflowStage` | `#a8d428` | lime                  |

Chip pattern: `bg = base @ 0.10 alpha`, `border = base @ 0.22`, `color = base @ 0.9`.

### TypeScript export

Canonical values live at `apps/back-to-one/src/lib/thread-tokens.ts`. Every
surface that renders thread UI imports from there — no inline hex literals.

---

## Other sections

*Reserved for subsequent token migration PRs.* Phase tokens, project accents,
UI greys, status hexes, and typography are not yet in this file.
