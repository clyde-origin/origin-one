// Default AICP commercial budget template — the 14-account skeleton ATL +
// BTL letters that the spec §7.1 (with Q3 refinements) describes. Located
// here in @origin-one/schema so packages/db/prisma/seed.ts can import it
// (One-Way Rule), same pattern as computeExpenseUnits in rate-unit.ts.
//
// Producers either start from this skeleton or clone-from-prior-project
// (PR 7). Sub-accounts and line items are added by the producer after
// the skeleton is created — this fixture is just the top-level scaffold.

import type { BudgetAccountSection } from "./budget";

export interface AicpAccountSpec {
  code: string;                      // "AA", "BB", "A", "B", … "L"
  name: string;
  section: BudgetAccountSection;     // 'ATL' | 'BTL'
  sortOrder: number;
}

export const DEFAULT_AICP_ACCOUNTS: readonly AicpAccountSpec[] = [
  // ATL — director / producer fees
  { code: "AA", name: "Director / Creative Fees",             section: "ATL", sortOrder:   1 },
  { code: "BB", name: "Producer / Production Manager",         section: "ATL", sortOrder:   2 },
  // BTL — production line items, AICP letter convention
  { code: "A",  name: "Pre-Production Wages",                  section: "BTL", sortOrder:  10 },
  { code: "B",  name: "Shooting Crew Labor",                   section: "BTL", sortOrder:  20 },
  { code: "C",  name: "Production Wrap Wages",                 section: "BTL", sortOrder:  30 },
  { code: "D",  name: "Locations & Travel",                    section: "BTL", sortOrder:  40 },
  { code: "E",  name: "Props · Wardrobe · HMU",                section: "BTL", sortOrder:  50 },
  { code: "F",  name: "Studio Rental & Expenses",              section: "BTL", sortOrder:  60 },
  { code: "G",  name: "Set Construction",                      section: "BTL", sortOrder:  70 },
  { code: "H",  name: "Equipment (Camera · Lighting · Grip)",  section: "BTL", sortOrder:  80 },
  // I was renamed from "Production Film & Lab" → "Media / Data Management"
  // per Q3 refinement (DIT, drives, transfer for digital workflows).
  { code: "I",  name: "Media / Data Management",               section: "BTL", sortOrder:  90 },
  { code: "J",  name: "Talent & Talent Expenses",              section: "BTL", sortOrder: 100 },
  { code: "K",  name: "Editorial · Post · Music",              section: "BTL", sortOrder: 110 },
  { code: "L",  name: "Insurance · Misc",                      section: "BTL", sortOrder: 120 },
] as const;
