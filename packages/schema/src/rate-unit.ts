// Unit of time for a CrewTimecard rate. 'day' = whole-day rate (one timecard
// date counts as one day, hours field informational); 'hour' = hourly rate
// (units = hours). The math fix that consumes this enum lands in the budget
// arc (PR 6) — schema lands first (this PR) so the column is populated.

import { z } from "zod";

export const RateUnit = z.enum(["day", "hour"]);

export type RateUnit = z.infer<typeof RateUnit>;
