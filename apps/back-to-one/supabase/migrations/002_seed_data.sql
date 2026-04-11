-- ══════════════════════════════════════════════════════════
-- ORIGIN ONE — SEED DATA
-- Three demo projects: Astra Lumina, Drifting, Freehand
-- Run after 001_initial_schema.sql
-- ══════════════════════════════════════════════════════════

-- ── PROJECTS ───────────────────────────────────────────────

INSERT INTO projects (id, name, type, client, company, phase, status, logline,
  runtime_target, aspect_ratio, capture_format,
  start_date, shoot_date, shoot_date_end, delivery_date, scene_count, shot_count)
VALUES
  (
    'proj-lumina-001',
    'Astra Lumina',
    'Commercial',
    'Astra Velo',
    'Origin Point',
    'pre',
    'In Pre-Production',
    'A luxury electric vehicle emerges from darkness into a world it was built for.',
    NULL, '2.39:1', 'Digital Cinema',
    '2026-03-01', '2026-04-16', NULL, '2026-04-28',
    3, 13
  ),
  (
    'proj-drifting-001',
    'Drifting',
    'Narrative Short',
    'Internal Demo',
    'Origin Point',
    'prod',
    'Shotlist in Progress',
    'During a ravine trial, a quiet trainee reads the land well enough to survive it — until someone above him cuts the rope.',
    '3:00', '2.39:1', 'Digital Cinema',
    '2026-04-06', '2026-04-16', NULL, '2026-04-24',
    3, 10
  ),
  (
    'proj-freehand-001',
    'Freehand',
    'Branded Documentary',
    'Art is Free',
    'Origin Point',
    'post',
    'Picture Lock in Progress',
    'In the alleyways and underpasses of Downtown LA, a street artist named Dara works without permission and without payment — because the city is the only gallery that never turns anyone away.',
    '8:00', '2.39:1', 'Digital Cinema',
    '2026-02-10', '2026-02-24', '2026-02-25', '2026-04-10',
    3, 10
  );

-- ── CREW — DRIFTING ────────────────────────────────────────

INSERT INTO crew_members (id, project_id, first, last, role, dept, color1, color2, online)
VALUES
  ('crew-d-01', 'proj-drifting-001', 'Clyde',  'Jeffrey', 'Director',             'Direction',  '#1a2060', '#2e1458', true),
  ('crew-d-02', 'proj-drifting-001', 'Maya',   'Sol',     'Producer',             'Production', '#1e1040', '#0e1640', true),
  ('crew-d-03', 'proj-drifting-001', 'Daniel', 'Cross',   '1st AD',               'Production', '#2a1008', '#180808', false),
  ('crew-d-04', 'proj-drifting-001', 'Elena',  'Voss',    'Director of Photography', 'Camera',  '#0c2e1a', '#081e14', true),
  ('crew-d-05', 'proj-drifting-001', 'Rina',   'Vale',    'Production Designer',  'Art',        '#2e1808', '#1e1008', false),
  ('crew-d-06', 'proj-drifting-001', 'Theo',   'Hart',    'Sound',                'Sound',      '#0e0e2a', '#080820', false),
  ('crew-d-07', 'proj-drifting-001', 'June',   'Mercer',  'Editor',               'Post',       '#002a1a', '#001810', false),
  ('crew-d-08', 'proj-drifting-001', 'Alex',   'Rune',    'Colorist',             'Post',       '#180a28', '#100618', false),
  ('crew-d-09', 'proj-drifting-001', 'Nina',   'Vale',    'Storyboards',          'Art',        '#281808', '#180e04', false),
  ('crew-d-10', 'proj-drifting-001', 'Tessa',  'Bloom',   'Coordinator',          'Production', '#0a1428', '#060e1c', false);

-- ── CREW — FREEHAND ────────────────────────────────────────

INSERT INTO crew_members (id, project_id, first, last, role, dept, color1, color2, online)
VALUES
  ('crew-f-01', 'proj-freehand-001', 'Simone', 'Adler',  'Director',           'Direction',  '#1a2060', '#2e1458', true),
  ('crew-f-02', 'proj-freehand-001', 'Marcus', 'Webb',   'Producer',           'Production', '#1e1040', '#0e1640', true),
  ('crew-f-03', 'proj-freehand-001', 'Kenji',  'Okafor', 'Field Producer',     'Production', '#0c2e1a', '#081e14', false),
  ('crew-f-04', 'proj-freehand-001', 'Lila',   'Santos', 'DP',                 'Camera',     '#2a1008', '#180808', false),
  ('crew-f-05', 'proj-freehand-001', 'Ray',    'Tomas',  'Sound',              'Sound',      '#0e0e2a', '#080820', false),
  ('crew-f-06', 'proj-freehand-001', 'June',   'Mercer', 'Editor',             'Post',       '#002a1a', '#001810', true),
  ('crew-f-07', 'proj-freehand-001', 'Alex',   'Rune',   'Colorist',           'Post',       '#180a28', '#100618', false),
  ('crew-f-08', 'proj-freehand-001', 'Petra',  'Vail',   'Score',              'Post',       '#1a0828', '#100418', false),
  ('crew-f-09', 'proj-freehand-001', 'Dom',    'Hale',   'Motion Graphics',    'Post',       '#081828', '#040e1c', false),
  ('crew-f-10', 'proj-freehand-001', 'Tessa',  'Bloom',  'Delivery Coordinator','Production','#0a1428', '#060e1c', false);

-- ── MILESTONES — DRIFTING ──────────────────────────────────

INSERT INTO milestones (id, project_id, name, phase, dept, date, notes)
VALUES
  ('ms-d-01',  'proj-drifting-001', 'Project Setup',         'pre',  'Production', '2026-04-06', ''),
  ('ms-d-02',  'proj-drifting-001', 'Script v1 Loaded',      'pre',  'Creative',   '2026-04-07', ''),
  ('ms-d-03',  'proj-drifting-001', 'Crew & Resources Loaded','pre', 'Production', '2026-04-08', ''),
  ('ms-d-04',  'proj-drifting-001', 'Shotlist Lock',          'prod', 'Camera',    '2026-04-09', ''),
  ('ms-d-05',  'proj-drifting-001', 'Storyboard Pass v1',    'pre',  'Creative',   '2026-04-10', ''),
  ('ms-d-06',  'proj-drifting-001', 'Tech Scout',            'pre',  'Production', '2026-04-11', ''),
  ('ms-d-07',  'proj-drifting-001', 'Production Design Lock','pre',  'Art',        '2026-04-13', ''),
  ('ms-d-08',  'proj-drifting-001', 'Sound Plan Lock',       'pre',  'Sound',      '2026-04-14', ''),
  ('ms-d-09',  'proj-drifting-001', 'Final Prep Review',     'pre',  'Production', '2026-04-15', ''),
  ('ms-d-10',  'proj-drifting-001', 'Shoot Day',             'prod', 'Production', '2026-04-16', ''),
  ('ms-d-11',  'proj-drifting-001', 'First Assembly',        'post', 'Post',       '2026-04-18', ''),
  ('ms-d-12',  'proj-drifting-001', 'Sound + Color Pass',    'post', 'Post',       '2026-04-21', ''),
  ('ms-d-13',  'proj-drifting-001', 'Internal Demo Review',  'post', 'Creative',   '2026-04-24', '');

-- ── MILESTONES — FREEHAND ──────────────────────────────────

INSERT INTO milestones (id, project_id, name, phase, dept, date, notes)
VALUES
  ('ms-f-01',  'proj-freehand-001', 'Project Kickoff',          'pre',  'Production', '2026-02-10', ''),
  ('ms-f-02',  'proj-freehand-001', 'Subject Research Complete', 'pre', 'Creative',   '2026-02-14', ''),
  ('ms-f-03',  'proj-freehand-001', 'Location Scout',           'pre',  'Production', '2026-02-18', ''),
  ('ms-f-04',  'proj-freehand-001', 'Shot Plan Lock',           'pre',  'Camera',     '2026-02-21', ''),
  ('ms-f-05',  'proj-freehand-001', 'Shoot Day 1',              'prod', 'Production', '2026-02-24', ''),
  ('ms-f-06',  'proj-freehand-001', 'Shoot Day 2',              'prod', 'Production', '2026-02-25', ''),
  ('ms-f-07',  'proj-freehand-001', 'Assembly Cut Delivered',   'post', 'Post',       '2026-03-04', ''),
  ('ms-f-08',  'proj-freehand-001', 'Director''s Cut',          'post', 'Post',       '2026-03-12', ''),
  ('ms-f-09',  'proj-freehand-001', 'Client Review',            'post', 'Production', '2026-03-20', ''),
  ('ms-f-10',  'proj-freehand-001', 'Revisions Cut',            'post', 'Post',       '2026-03-26', ''),
  ('ms-f-11',  'proj-freehand-001', 'Picture Lock',             'post', 'Post',       '2026-04-02', ''),
  ('ms-f-12',  'proj-freehand-001', 'Score Delivery',           'post', 'Post',       '2026-04-04', ''),
  ('ms-f-13',  'proj-freehand-001', 'Sound Mix',                'post', 'Sound',      '2026-04-05', ''),
  ('ms-f-14',  'proj-freehand-001', 'Color Grade',              'post', 'Post',       '2026-04-07', ''),
  ('ms-f-15',  'proj-freehand-001', 'QC & Export',              'post', 'Production', '2026-04-09', ''),
  ('ms-f-16',  'proj-freehand-001', 'Final Delivery',           'post', 'Production', '2026-04-10', '');

-- ── ACTION ITEMS — DRIFTING ────────────────────────────────

INSERT INTO action_items (id, project_id, name, dept, assignee_id, due_date, notes, done)
VALUES
  ('ai-d-01', 'proj-drifting-001', 'Lock shotlist structure',        'Camera',     'crew-d-01', '2026-04-09', '', false),
  ('ai-d-02', 'proj-drifting-001', 'Approve script headers',         'Creative',   'crew-d-01', '2026-04-07', '', false),
  ('ai-d-03', 'proj-drifting-001', 'Review rope gag approach',       'Production', 'crew-d-03', '2026-04-11', '', false),
  ('ai-d-04', 'proj-drifting-001', 'Approve ravine sound palette',   'Sound',      'crew-d-06', '2026-04-14', '', false),
  ('ai-d-05', 'proj-drifting-001', 'Build storyboard frames',        'Creative',   'crew-d-09', '2026-04-10', '', false),
  ('ai-d-06', 'proj-drifting-001', 'Upload moodboard references',    'Art',        'crew-d-05', '2026-04-08', '', false),
  ('ai-d-07', 'proj-drifting-001', 'Load resources into Back to One',      'Production', 'crew-d-10', '2026-04-08', '', false),
  ('ai-d-08', 'proj-drifting-001', 'Create shoot schedule draft',    'Production', 'crew-d-03', '2026-04-12', '', false),
  ('ai-d-09', 'proj-drifting-001', 'Test low-light wall look',       'Camera',     'crew-d-04', '2026-04-11', '', false),
  ('ai-d-10', 'proj-drifting-001', 'Assemble first cut',             'Post',       'crew-d-07', '2026-04-18', '', false);

-- ── ACTION ITEMS — FREEHAND ────────────────────────────────

INSERT INTO action_items (id, project_id, name, dept, assignee_id, due_date, notes, done)
VALUES
  ('ai-f-01', 'proj-freehand-001', 'Approve picture lock cut',         'Creative',   'crew-f-01', '2026-04-02', '', false),
  ('ai-f-02', 'proj-freehand-001', 'Review score stems',               'Post',       'crew-f-01', '2026-04-04', '', false),
  ('ai-f-03', 'proj-freehand-001', 'Confirm delivery specs with client','Production', 'crew-f-02', '2026-04-01', '', false),
  ('ai-f-04', 'proj-freehand-001', 'Final color approval',             'Post',       'crew-f-01', '2026-04-07', '', false),
  ('ai-f-05', 'proj-freehand-001', 'Deliver final mix',                'Post',       'crew-f-05', '2026-04-05', '', false),
  ('ai-f-06', 'proj-freehand-001', 'Export delivery formats',          'Post',       'crew-f-09', '2026-04-09', '', false),
  ('ai-f-07', 'proj-freehand-001', 'Upload final files to Resources',  'Production', 'crew-f-10', '2026-04-09', '', false),
  ('ai-f-08', 'proj-freehand-001', 'Final QC pass',                    'Post',       'crew-f-10', '2026-04-09', '', false),
  ('ai-f-09', 'proj-freehand-001', 'Write delivery memo',              'Production', 'crew-f-02', '2026-04-10', '', false),
  ('ai-f-10', 'proj-freehand-001', 'Archive project in Back to One',         'Production', 'crew-f-10', '2026-04-10', '', false);

-- ── SCENEMAKER VERSIONS ────────────────────────────────────

INSERT INTO sm_versions (id, project_id, label, is_current)
VALUES
  ('ver-d-01', 'proj-drifting-001', 'v1', true),
  ('ver-f-01', 'proj-freehand-001', 'v1', true);

-- ── SCENES — DRIFTING ──────────────────────────────────────

INSERT INTO sm_scenes (id, project_id, version_id, num, heading, action)
VALUES
  ('sc-d-01', 'proj-drifting-001', 'ver-d-01', 1, 'EXT. RAVINE EDGE — DUSK',
    '["The ravine opens below. Three figures at the rim.", "LOHM checks his line. ALEPH watches. ZURA waits.", "The wall drops forty feet to a narrow shelf. Below that, nothing visible."]'),
  ('sc-d-02', 'proj-drifting-001', 'ver-d-01', 2, 'EXT. RAVINE WALL — CONTINUOUS',
    '["Lohm descends. Methodical.", "The wall is fractured limestone. Fungal growth lines the seams.", "A low hum from somewhere inside the rock."]'),
  ('sc-d-03', 'proj-drifting-001', 'ver-d-01', 3, 'EXT. LOWER SHELF — CONTINUOUS',
    '["Lohm crashes onto the shelf.", "He catches a root bundle with both hands.", "From the seam beside him — clicking. Procedural. Not aggressive. Just present."]');

-- ── SCENES — FREEHAND ──────────────────────────────────────

INSERT INTO sm_scenes (id, project_id, version_id, num, heading, action)
VALUES
  ('sc-f-01', 'proj-freehand-001', 'ver-f-01', 1, 'SEQUENCE 1 — THE WALL',
    '["An underpass at early morning light.", "DARA enters frame from the left. She carries a worn bag.", "She stands in front of blank concrete and studies it."]'),
  ('sc-f-02', 'proj-freehand-001', 'ver-f-01', 2, 'SEQUENCE 2 — THE CITY',
    '["Dara walks through the Arts District.", "She pauses at other artists'' work.", "Interview setups. Dara and the Art is Free founder."]'),
  ('sc-f-03', 'proj-freehand-001', 'ver-f-01', 3, 'SEQUENCE 3 — THE MARK',
    '["Wide reveal of the completed wall piece.", "Dara picks up her bag and walks away without looking back.", "Camera holds on finished wall. Title card."]');

-- ── SHOTS — DRIFTING ───────────────────────────────────────

INSERT INTO sm_shots (id, project_id, version_id, scene_id, story_order, shoot_order,
  desc, framing, movement, lens, dir_notes, prod_notes, elements, images, status)
VALUES
  ('shot-d-1a', 'proj-drifting-001', 'ver-d-01', 'sc-d-01', 1, 1,
    'Lohm checks the line, Aleph watches, Zura waits. Establish geography and triangle dynamic.',
    'Wide Master', 'Static', '', 'Establish the spatial relationship. Three people, one rope.', '', '["Lohm","Aleph","Zura","Rope"]', '[]', 'planned'),
  ('shot-d-1b', 'proj-drifting-001', 'ver-d-01', 'sc-d-01', 2, 2,
    'Lohm testing rope, fixing mask, preparing to descend.',
    'Medium', 'Static', '', 'Quiet competence. No fear, no show.', '', '["Lohm","Rope","Mask"]', '[]', 'planned'),
  ('shot-d-1c', 'proj-drifting-001', 'ver-d-01', 'sc-d-01', 3, 5,
    'Profile as Lohm lowers over the edge and disappears down the wall.',
    'Profile Action', 'Pan follows', '', 'He goes over. That''s the point of no return.', '', '["Lohm","Ravine edge"]', '[]', 'planned'),
  ('shot-d-2a', 'proj-drifting-001', 'ver-d-01', 'sc-d-02', 4, 6,
    'Lohm reaches first shelf and studies the seams in the wall.',
    'Medium', 'Static', '', 'He reads the wall. Show his process.', '', '["Lohm","Limestone seams"]', '[]', 'planned'),
  ('shot-d-2b', 'proj-drifting-001', 'ver-d-01', 'sc-d-02', 5, 7,
    'Hook tapping seam, dust shifting uphill, faint fungal click. This shot teaches the rule.',
    'Insert / Detail', 'Macro static', '', 'Dust goes up. That''s wrong. Audience needs to clock it.', '', '["Hook","Seam","Dust","Fungal growth"]', '[]', 'planned'),
  ('shot-d-2c', 'proj-drifting-001', 'ver-d-01', 'sc-d-02', 6, 8,
    'Lohm shifts left, plants hook, transfers to second shelf. Small success, not triumph.',
    'Action Medium-Wide', 'Follows action', '', 'Efficient. He knows what he''s doing.', '', '["Lohm","Hook","Shelf"]', '[]', 'planned'),
  ('shot-d-2d', 'proj-drifting-001', 'ver-d-01', 'sc-d-02', 7, 9,
    'Wall shudders during rumble. Lohm slams into stone and clings.',
    'Tight Impact', 'Handheld', '', 'Sudden. No prep for the audience.', '', '["Lohm","Wall","Rumble"]', '[]', 'planned'),
  ('shot-d-3a', 'proj-drifting-001', 'ver-d-01', 'sc-d-02', 8, 3,
    'Lohm looks up to see Zura at the rim. She is still and unreadable.',
    'POV Long Lens', 'Static compressed', '', 'Almost silhouette. She''s there. That''s all we know.', '', '["Zura","Rim","POV"]', '[]', 'planned'),
  ('shot-d-3b', 'proj-drifting-001', 'ver-d-01', 'sc-d-02', 9, 4,
    'Rope parts above Lohm. Fast and brutal.',
    'Insert', 'Static tight', '', 'No slow motion. Real time. That''s the choice.', '', '["Rope","Cut"]', '[]', 'planned'),
  ('shot-d-3c', 'proj-drifting-001', 'ver-d-01', 'sc-d-03', 10, 10,
    'Lohm crashes onto lower shelf, catches root bundle, hears clicking from the seam.',
    'Hero Ending', 'Static wide', '', 'He made it. The wall is still alive around him.', '', '["Lohm","Lower shelf","Root bundle","Clicking seam"]', '[]', 'planned');

-- ── SHOTS — FREEHAND ───────────────────────────────────────

INSERT INTO sm_shots (id, project_id, version_id, scene_id, story_order, shoot_order,
  desc, framing, movement, lens, dir_notes, prod_notes, elements, images, status)
VALUES
  ('shot-f-1a', 'proj-freehand-001', 'ver-f-01', 'sc-f-01', 1, 1,
    'Underpass at early morning light. Dara enters frame from left carrying her bag.',
    'Wide Establishing', 'Static', '', 'Let the space breathe before she enters.', '', '["Dara","Underpass","Morning light"]', '[]', 'captured'),
  ('shot-f-1b', 'proj-freehand-001', 'ver-f-01', 'sc-f-01', 2, 2,
    'Dara stands in front of blank concrete and studies it. Hold until uncomfortable.',
    'Medium Observational', 'Static', '', 'Do not cut early. The hold is the meaning.', '', '["Dara","Blank wall"]', '[]', 'captured'),
  ('shot-f-1c', 'proj-freehand-001', 'ver-f-01', 'sc-f-01', 3, 3,
    'Close on Dara''s hands opening her bag, pulling out a marker, uncapping it.',
    'Insert — Hands', 'Macro static', '', 'The uncapping sound should be the loudest thing in the edit.', '', '["Dara hands","Bag","Marker"]', '[]', 'captured'),
  ('shot-f-2a', 'proj-freehand-001', 'ver-f-01', 'sc-f-02', 4, 5,
    'Dara walks through Arts District, pausing at other artists'' work. Observational.',
    'Handheld Walk', 'Follow loose', '', 'Never staged. Let her lead. Camera follows.', '', '["Dara","Arts District","Street art"]', '[]', 'captured'),
  ('shot-f-2b', 'proj-freehand-001', 'ver-f-01', 'sc-f-02', 5, 6,
    'Dara interview. Eye line slightly off camera left. Let her finish every sentence.',
    'Interview — Single', 'Static', '', 'Eye line slightly off. Never break it.', '', '["Dara","Interview setup"]', '[]', 'captured'),
  ('shot-f-2c', 'proj-freehand-001', 'ver-f-01', 'sc-f-02', 6, 7,
    'Art is Free founder interview. Same setup as Dara. More structured.',
    'Interview — Single', 'Static', '', 'Match the Dara setup exactly. Visual continuity.', '', '["Founder","Interview setup"]', '[]', 'captured'),
  ('shot-f-2d', 'proj-freehand-001', 'ver-f-01', 'sc-f-02', 7, 4,
    'People passing existing murals. Incidental stops. Never staged.',
    'B-Roll — Community', 'Handheld observational', '', 'If it looks staged, cut it.', '', '["Community","Murals","Passersby"]', '[]', 'captured'),
  ('shot-f-3a', 'proj-freehand-001', 'ver-f-01', 'sc-f-03', 8, 8,
    'Wide reveal of completed wall piece for the first time. Do not cut away.',
    'Wide — Finished Piece', 'Static', '', 'Hold longer than feels comfortable. Then hold more.', '', '["Finished mural","Full wall"]', '[]', 'captured'),
  ('shot-f-3b', 'proj-freehand-001', 'ver-f-01', 'sc-f-03', 9, 9,
    'Dara picks up her bag and walks away without looking back.',
    'Medium — Departure', 'Static', '', 'She never looks back. That''s the whole character.', '', '["Dara","Departure"]', '[]', 'captured'),
  ('shot-f-3c', 'proj-freehand-001', 'ver-f-01', 'sc-f-03', 10, 10,
    'Camera holds on finished wall after Dara exits. Title card over.',
    'Static Hold — Wall Only', 'Locked off', '', 'No music for 10 seconds minimum. Silence is the point.', '', '["Finished wall","Title card"]', '[]', 'captured');

-- ── RESOURCES — DRIFTING ───────────────────────────────────

INSERT INTO resources (id, project_id, cat, type, title, meta, url, pinned)
VALUES
  ('res-d-01', 'proj-drifting-001', 'brief', 'doc', 'Script_v1', 'PDF · Apr 7', '#', true),
  ('res-d-02', 'proj-drifting-001', 'brief', 'doc', 'Shotlist_v1', 'PDF · Apr 8', '#', true),
  ('res-d-03', 'proj-drifting-001', 'brief', 'doc', 'Storyboard_v1', 'PDF · Apr 10', '#', false),
  ('res-d-04', 'proj-drifting-001', 'brief', 'doc', 'Schedule_Draft_v1', 'PDF · Apr 11', '#', false),
  ('res-d-05', 'proj-drifting-001', 'brief', 'doc', 'Prop_List_v1', 'PDF · Apr 8', '#', false),
  ('res-d-06', 'proj-drifting-001', 'brief', 'doc', 'Tech_Scout_Notes_v1', 'Doc · Apr 11', '#', false),
  ('res-d-07', 'proj-drifting-001', 'refs', 'folder', 'Ravine_Moodboard', 'Visual refs', '#', false),
  ('res-d-08', 'proj-drifting-001', 'refs', 'folder', 'Rope_Reference', 'Visual refs', '#', false),
  ('res-d-09', 'proj-drifting-001', 'refs', 'folder', 'Fungus_Surface_Study', 'Visual refs', '#', false),
  ('res-d-10', 'proj-drifting-001', 'refs', 'folder', 'Lower_Shelf_Lighting_Refs', 'Visual refs', '#', false),
  ('res-d-11', 'proj-drifting-001', 'audio', 'folder', 'Ravine_Hum_Concept', 'Audio ref', '#', false),
  ('res-d-12', 'proj-drifting-001', 'audio', 'folder', 'Seam_Click_Concept', 'Audio ref', '#', false),
  ('res-d-13', 'proj-drifting-001', 'audio', 'folder', 'Rope_Snap_Refs', 'Audio ref', '#', false),
  ('res-d-14', 'proj-drifting-001', 'audio', 'folder', 'Breath_Mask_Texture_Refs', 'Audio ref', '#', false);

-- ── RESOURCES — FREEHAND ───────────────────────────────────

INSERT INTO resources (id, project_id, cat, type, title, meta, url, pinned)
VALUES
  ('res-f-01', 'proj-freehand-001', 'brief', 'doc', 'Freehand_Brief_v1', 'PDF · Feb 10', '#', true),
  ('res-f-02', 'proj-freehand-001', 'brief', 'doc', 'Freehand_Script_Outline_v1', 'PDF · Feb 12', '#', true),
  ('res-f-03', 'proj-freehand-001', 'brief', 'doc', 'Freehand_Interview_Questions_v1', 'Doc · Feb 18', '#', false),
  ('res-f-04', 'proj-freehand-001', 'brief', 'doc', 'Freehand_Schedule_v1', 'PDF · Feb 20', '#', false),
  ('res-f-05', 'proj-freehand-001', 'deliverables', 'doc', 'Freehand_Delivery_Specs_v1', 'PDF · Mar 20', '#', false),
  ('res-f-06', 'proj-freehand-001', 'brief', 'doc', 'ArtIsFree_Brand_Guide', 'PDF · Feb 10', '#', false),
  ('res-f-07', 'proj-freehand-001', 'refs', 'folder', 'Dara_Work_Reference_Board', 'Visual refs', '#', false),
  ('res-f-08', 'proj-freehand-001', 'refs', 'folder', 'DTLA_Location_Refs', 'Visual refs', '#', false),
  ('res-f-09', 'proj-freehand-001', 'refs', 'folder', 'Color_Grade_Ref_Stills', 'Visual refs', '#', false),
  ('res-f-10', 'proj-freehand-001', 'refs', 'folder', 'Title_Card_Design_v2', 'Visual refs', '#', false),
  ('res-f-11', 'proj-freehand-001', 'audio', 'folder', 'Score_Demo_Ref_Petra', 'Audio ref', '#', false),
  ('res-f-12', 'proj-freehand-001', 'audio', 'folder', 'Ambient_DTLA_Reference', 'Audio ref', '#', false),
  ('res-f-13', 'proj-freehand-001', 'audio', 'folder', 'Interview_Room_Tone_Reference', 'Audio ref', '#', false),
  ('res-f-14', 'proj-freehand-001', 'deliverables', 'video', 'Freehand_DirectorsCut_v3', 'Delivered Mar 12', '#', false),
  ('res-f-15', 'proj-freehand-001', 'deliverables', 'video', 'Freehand_RevisedCut_v4', 'Delivered Mar 26', '#', false),
  ('res-f-16', 'proj-freehand-001', 'deliverables', 'video', 'Freehand_PictureLock_PENDING', 'Pending', '#', false);

-- ── THREADS — FREEHAND ─────────────────────────────────────

INSERT INTO threads (id, project_id, context_type, context_label, context_ref, subject)
VALUES
  ('th-f-01', 'proj-freehand-001', 'general', 'Picture Lock', 'ms-f-11',
    'Picture Lock Notes'),
  ('th-f-02', 'proj-freehand-001', 'general', 'Score', 'res-f-11',
    'Score Direction'),
  ('th-f-03', 'proj-freehand-001', 'general', 'Delivery', 'ms-f-16',
    'Delivery Specs');

INSERT INTO thread_messages (id, thread_id, author_id, tagged, text)
VALUES
  ('tm-f-01', 'th-f-01', 'crew-f-06', '["crew-f-01","crew-f-02"]',
    'Opening 30 seconds still feels slow. First image should be Dara''s first mark on the wall.'),
  ('tm-f-02', 'th-f-02', 'crew-f-01', '["crew-f-08"]',
    'Working on version that sits further back in the underpass section. More air, less presence.'),
  ('tm-f-03', 'th-f-03', 'crew-f-02', '["crew-f-10"]',
    'Web H.264 and ProRes archive confirmed. No broadcast delivery needed.');
