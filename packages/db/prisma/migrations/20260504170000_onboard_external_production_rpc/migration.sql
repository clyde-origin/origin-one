-- Onboard a brand-new external production in one transaction.
-- Replaces ~24+ manual INSERT statements with a single rpc call.
-- SECURITY INVOKER so RLS still applies; the API route is the privilege gate.

CREATE OR REPLACE FUNCTION public.onboard_external_production(
  p_caller_user_id text,
  p_company_name text,
  p_project_name text,
  p_producers jsonb,        -- array of {name: text, email: text}
  p_origin_team_id text     -- team that owns the demo seeds
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  now_ts        timestamptz := now();
  new_team_id   text;
  new_project_id text;
  producer      jsonb;
  producer_id   text;
  producer_ids  text[] := ARRAY[]::text[];
  folder_id     text;
  folder_ids    text[] := ARRAY[]::text[];
  seed          record;
  placement_ord int;
BEGIN
  -- 1. Team
  INSERT INTO "Team" (id, name)
  VALUES (gen_random_uuid(), p_company_name)
  RETURNING id INTO new_team_id;

  -- 2. Project (under new team)
  INSERT INTO "Project" (id, "teamId", name, status)
  VALUES (gen_random_uuid(), new_team_id, p_project_name, 'pre_production'::"ProjectStatus")
  RETURNING id INTO new_project_id;

  -- 3. Caller as producer on the new project
  INSERT INTO "ProjectMember" (id, "projectId", "userId", role, "canEdit")
  VALUES (gen_random_uuid(), new_project_id, p_caller_user_id, 'producer'::"Role", true);

  -- 4. Each producer
  FOR producer IN SELECT * FROM jsonb_array_elements(p_producers) LOOP
    -- 4a. Upsert User by email; capture id either way
    INSERT INTO "User" (id, email, name)
    VALUES (gen_random_uuid(), (producer->>'email'), (producer->>'name'))
    ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
    RETURNING id INTO producer_id;
    producer_ids := array_append(producer_ids, producer_id);

    -- 4b. TeamMember on new team (idempotent)
    INSERT INTO "TeamMember" (id, "teamId", "userId", role)
    VALUES (gen_random_uuid(), new_team_id, producer_id, 'producer'::"Role")
    ON CONFLICT ("teamId", "userId") DO NOTHING;

    -- 4c. ProjectMember on new project
    IF NOT EXISTS (
      SELECT 1 FROM "ProjectMember"
      WHERE "projectId" = new_project_id AND "userId" = producer_id
    ) THEN
      INSERT INTO "ProjectMember" (id, "projectId", "userId", role, "canEdit")
      VALUES (gen_random_uuid(), new_project_id, producer_id, 'producer'::"Role", true);
    END IF;

    -- 4d. UserProjectFolder for demos
    INSERT INTO "UserProjectFolder" (id, "userId", name, "sortOrder")
    VALUES (gen_random_uuid(), producer_id, 'DEMO PROJECTS', 0)
    RETURNING id INTO folder_id;
    folder_ids := array_append(folder_ids, folder_id);

    -- 4e. UserProjectPlacement + ProjectMember per demo seed
    placement_ord := 0;
    FOR seed IN
      SELECT id FROM "Project"
      WHERE is_demo = true AND "teamId" = p_origin_team_id
      ORDER BY name
    LOOP
      INSERT INTO "UserProjectPlacement" (id, "userId", "projectId", "folderId", "sortOrder")
      VALUES (gen_random_uuid(), producer_id, seed.id, folder_id, placement_ord);

      IF NOT EXISTS (
        SELECT 1 FROM "ProjectMember"
        WHERE "projectId" = seed.id AND "userId" = producer_id
      ) THEN
        INSERT INTO "ProjectMember" (id, "projectId", "userId", role, "canEdit")
        VALUES (gen_random_uuid(), seed.id, producer_id, 'producer'::"Role", true);
      END IF;

      placement_ord := placement_ord + 1024;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'teamId', new_team_id,
    'projectId', new_project_id,
    'producerIds', to_jsonb(producer_ids),
    'folderIds', to_jsonb(folder_ids)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.onboard_external_production(text, text, text, jsonb, text)
  TO authenticated, anon;
