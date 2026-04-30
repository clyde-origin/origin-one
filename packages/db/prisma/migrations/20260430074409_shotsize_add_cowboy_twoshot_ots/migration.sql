-- ShotSize enum — adds three additional framings the UI now exposes:
--   cowboy            (mid-thigh up; classic western framing)
--   two_shot          (two subjects in frame)
--   over_the_shoulder (OTS; classic dialog reverse)
--
-- `full` is intentionally retained — 2 shots in prod still reference it,
-- and dropping enum values requires either rewriting those rows or
-- DROP+CREATE TYPE shenanigans. Keeping `full` in the schema while
-- removing it from the UI option list is the cheapest path.
--
-- ALTER TYPE ... ADD VALUE is non-blocking but cannot run inside a
-- transaction prior to PG12. Each ADD lives in its own statement.

ALTER TYPE "ShotSize" ADD VALUE IF NOT EXISTS 'cowboy';
ALTER TYPE "ShotSize" ADD VALUE IF NOT EXISTS 'two_shot';
ALTER TYPE "ShotSize" ADD VALUE IF NOT EXISTS 'over_the_shoulder';
