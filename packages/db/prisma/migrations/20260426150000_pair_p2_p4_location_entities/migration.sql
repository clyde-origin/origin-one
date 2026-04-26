-- Pair P2/P4 orphan Entity(type='location') rows to their production-side
-- Location records by shoot-order. Closes the BUILD_STATUS #8 data fix.
--
-- Pairing rationale (Apr 26, 2026):
--   P2 — Day 1 / Day 2 / Day 3 alignment between scripted location and booked location.
--   P4 — interior-to-interior, exterior-to-exterior. Silver Lake stays unpaired
--        (production-only location with no scripted counterpart — the legitimate
--        "production added something not in the script" case).
--
-- Idempotent: only updates Locations whose entityId is currently NULL.

DO $$
DECLARE
  p2_id TEXT := (SELECT id FROM "Project" WHERE name = 'Full Send' LIMIT 1);
  p4_id TEXT := (SELECT id FROM "Project" WHERE name = 'Flexibility Course A' LIMIT 1);
BEGIN
  -- P2 — Full Send
  UPDATE "Location"
     SET "entityId" = (SELECT id FROM "Entity" WHERE "projectId" = p2_id AND type = 'location' AND name = 'Malibu Point')
   WHERE "projectId" = p2_id AND name = 'Venice Beach Skatepark' AND "entityId" IS NULL;

  UPDATE "Location"
     SET "entityId" = (SELECT id FROM "Entity" WHERE "projectId" = p2_id AND type = 'location' AND name = 'Griffith Park Ridge')
   WHERE "projectId" = p2_id AND name = 'Turnbull Canyon Trail' AND "entityId" IS NULL;

  UPDATE "Location"
     SET "entityId" = (SELECT id FROM "Entity" WHERE "projectId" = p2_id AND type = 'location' AND name = 'DTLA Memorial Skatepark')
   WHERE "projectId" = p2_id AND name = 'DTLA Rooftop Court' AND "entityId" IS NULL;

  -- P4 — Flexibility Course A
  UPDATE "Location"
     SET "entityId" = (SELECT id FROM "Entity" WHERE "projectId" = p4_id AND type = 'location' AND name = 'Cyc Studio, Downtown LA')
   WHERE "projectId" = p4_id AND name = 'The Stillpoint — Private Studio' AND "entityId" IS NULL;

  UPDATE "Location"
     SET "entityId" = (SELECT id FROM "Entity" WHERE "projectId" = p4_id AND type = 'location' AND name = 'Will Rogers State Park')
   WHERE "projectId" = p4_id AND name = 'Point Dume Blufftop' AND "entityId" IS NULL;
END $$;
