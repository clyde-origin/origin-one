-- ══════════════════════════════════════════════════════════
-- ORIGIN ONE — FIX SHOT IDs
-- Updates shot IDs from DB-style (shot-d-1a) to clean
-- display-friendly labels (1A, 2A, FH-1A) and fixes
-- scene assignments for shots 3A/3B → scene 2
-- ══════════════════════════════════════════════════════════

-- ── DRIFTING shots: scene_id fixes ────────────────────────
-- shot-d-3a (story about Zura at rim) and shot-d-3b (rope parts)
-- happen during wall descent (Scene 2), not lower shelf (Scene 3).
-- Their IDs just had "3" prefix but they're scene-2 shots.
-- We'll renumber them as 2E and 2F.

-- Step 1: Temporarily disable foreign key checks by updating in order
-- Update IDs from DB-style to clean labels

-- Drifting Scene 1 shots
UPDATE sm_shots SET id = '1A' WHERE id = 'shot-d-1a';
UPDATE sm_shots SET id = '1B' WHERE id = 'shot-d-1b';
UPDATE sm_shots SET id = '1C' WHERE id = 'shot-d-1c';

-- Drifting Scene 2 shots (original 2x series)
UPDATE sm_shots SET id = '2A' WHERE id = 'shot-d-2a';
UPDATE sm_shots SET id = '2B' WHERE id = 'shot-d-2b';
UPDATE sm_shots SET id = '2C' WHERE id = 'shot-d-2c';
UPDATE sm_shots SET id = '2D' WHERE id = 'shot-d-2d';

-- Drifting Scene 2 shots (formerly 3a/3b — these belong to scene 2)
UPDATE sm_shots SET id = '2E' WHERE id = 'shot-d-3a';
UPDATE sm_shots SET id = '2F' WHERE id = 'shot-d-3b';

-- Drifting Scene 3 shot (the only true scene 3 shot)
UPDATE sm_shots SET id = '3A' WHERE id = 'shot-d-3c';

-- Freehand Scene 1 shots
UPDATE sm_shots SET id = 'FH-1A' WHERE id = 'shot-f-1a';
UPDATE sm_shots SET id = 'FH-1B' WHERE id = 'shot-f-1b';
UPDATE sm_shots SET id = 'FH-1C' WHERE id = 'shot-f-1c';

-- Freehand Scene 2 shots
UPDATE sm_shots SET id = 'FH-2A' WHERE id = 'shot-f-2a';
UPDATE sm_shots SET id = 'FH-2B' WHERE id = 'shot-f-2b';
UPDATE sm_shots SET id = 'FH-2C' WHERE id = 'shot-f-2c';
UPDATE sm_shots SET id = 'FH-2D' WHERE id = 'shot-f-2d';

-- Freehand Scene 3 shots
UPDATE sm_shots SET id = 'FH-3A' WHERE id = 'shot-f-3a';
UPDATE sm_shots SET id = 'FH-3B' WHERE id = 'shot-f-3b';
UPDATE sm_shots SET id = 'FH-3C' WHERE id = 'shot-f-3c';
