-- Single-round-trip reorder for the home grid.
-- Replaces N parallel PATCH/upsert round-trips in bulkReorderHomeGrid.
-- SECURITY INVOKER so RLS on UserProjectFolder/UserProjectPlacement still applies.

CREATE OR REPLACE FUNCTION public.reorder_home_grid(
  p_user_id text,
  p_folders jsonb,
  p_placements jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  now_ts timestamptz := now();
BEGIN
  IF jsonb_array_length(p_folders) > 0 THEN
    UPDATE "UserProjectFolder" AS f
    SET "sortOrder" = (item->>'sortOrder')::int,
        "updatedAt" = now_ts
    FROM jsonb_array_elements(p_folders) AS item
    WHERE f.id = (item->>'id')::text
      AND f."userId" = p_user_id;
  END IF;

  IF jsonb_array_length(p_placements) > 0 THEN
    INSERT INTO "UserProjectPlacement" (
      "userId", "projectId", "folderId", "sortOrder", "createdAt", "updatedAt"
    )
    SELECT
      p_user_id,
      (item->>'projectId')::text,
      NULL,
      (item->>'sortOrder')::int,
      now_ts,
      now_ts
    FROM jsonb_array_elements(p_placements) AS item
    ON CONFLICT ("userId", "projectId") DO UPDATE
    SET "sortOrder" = EXCLUDED."sortOrder",
        "folderId" = NULL,
        "updatedAt" = now_ts;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reorder_home_grid(text, jsonb, jsonb) TO authenticated, anon;
