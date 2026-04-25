-- Reconciles drift: index existed in prod but was not declared
-- in schema.prisma. IF NOT EXISTS makes this a no-op on prod
-- and a correct CREATE on fresh environments.
CREATE INDEX IF NOT EXISTS "Location_entityId_idx" ON "Location"("entityId");
