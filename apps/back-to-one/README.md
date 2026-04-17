# Origin One — Production Management for Creative Teams
### By Origin Point

---

## Setup (10 minutes)

### 1. Install Node.js
Go to **nodejs.org** → download LTS → install.
Verify: `node --version` should show v18+

### 2. Install dependencies
```bash
cd origin-one
npm install
```

### 3. Add Supabase keys
```bash
cp .env.local.example .env.local
```
Open `.env.local` and paste your keys from:
**supabase.com → your project → Settings → API**

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### 4. Create the database
In Supabase → **SQL Editor**, run these in order:
1. Paste `supabase/migrations/001_initial_schema.sql` → Run
2. Paste `supabase/migrations/002_seed_data.sql` → Run

### 5. Run locally
```bash
npm run dev
```
Open **http://localhost:3000**

To view on your phone (same WiFi):
Find your Mac's IP: System Settings → WiFi → Details
Open `http://192.168.x.x:3000` on your phone

### 6. Deploy to Vercel
```bash
npx vercel
```
Add your two Supabase env vars in the Vercel dashboard.
You'll get a live URL instantly.

---

## What's in the box

| Screen | Status |
|---|---|
| Login | UI complete, auth wired later |
| Project Selection | Complete — all 3 projects |
| Hub | Wired to Supabase — loads live data |
| Action Items | Placeholder |
| Timeline | Placeholder |
| SceneMaker | Placeholder |
| Crew | Placeholder |
| Threads | Placeholder |
| Resources | Placeholder |
| + 4 more modules | Placeholders |

## Seed projects
- **Astra Lumina** — Commercial, Pre phase
- **Drifting** — Narrative Short (FRACTURE universe), Prod phase, 10 shots
- **Freehand** — Branded Documentary, Post phase, 10 shots captured

## Stack
Next.js 14 · React 18 · TypeScript · Tailwind CSS
Supabase · React Query · Zod · React Hook Form
