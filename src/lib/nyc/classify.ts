import type { IssueCategory } from "./types";

/**
 * Deterministic keyword classification, defined once and compiled two ways:
 * a JS regex for rows we hold in memory, and a SoQL `case()` expression so
 * Socrata can classify millions of rows server-side and hand back counts.
 *
 * Keeping both in one table is the point - if they drifted apart, the issue
 * cards and the violation list would disagree with each other.
 *
 * Order matters and first match wins. Heating is tested before Hot Water so a
 * combined "NO HEAT AND NO HOT WATER" report lands in one category, not both.
 */
interface Rule {
  category: IssueCategory;
  regex: RegExp;
  /** Uppercase SQL LIKE patterns. Must stay semantically aligned with `regex`. */
  like: string[];
}

const RULES: Rule[] = [
  {
    category: "Heating",
    regex:
      /\bheat\b|\bheating\b|no heat|boiler|radiator|burner|steam|air valve/,
    like: [
      "%HEAT%",
      "%BOILER%",
      "%RADIATOR%",
      "%BURNER%",
      "%STEAM%",
      "%AIR VALVE%",
    ],
  },
  {
    category: "Hot Water",
    regex: /hot water|water temperature/,
    like: ["%HOT WATER%", "%WATER TEMPERATURE%"],
  },
  {
    category: "Pests",
    // Bare "rat" is deliberately excluded - it matches SEPARATE, and LIKE has no
    // word boundaries, so it would quietly inflate every pest count.
    regex:
      /\bmice\b|\bmouse\b|\brats?\b|roach|cockroach|vermin|rodent|bed ?bugs?|infestation/,
    like: [
      "%MICE%",
      "%MOUSE%",
      "%RATS%",
      "%ROACH%",
      "%VERMIN%",
      "%RODENT%",
      "%BED BUG%",
      "%BEDBUG%",
      "%INFEST%",
    ],
  },
  {
    category: "Mold",
    regex: /\bmold\b|mildew/,
    like: ["%MOLD%", "%MILDEW%"],
  },
  {
    category: "Leaks",
    regex:
      /\bleak|water damage|seepage|cascading|damp or wet|leaky roof|continuous from above|\bdrip/,
    like: [
      "%LEAK%",
      "%WATER DAMAGE%",
      "%SEEPAGE%",
      "%CASCADING%",
      "%DAMP%",
      "%DRIP%",
    ],
  },
  {
    category: "Electrical",
    regex: /electric|wiring|\boutlet|power failure/,
    like: ["%ELECTRIC%", "%WIRING%", "%OUTLET%", "%POWER FAILURE%"],
  },
];

/**
 * HPD's complaint categories name two different problems at once: both
 * "HEAT/HOT WATER" and "HEATING" cover no-heat and no-hot-water reports alike.
 * Left in the text they match the Heating rule on their own, which files every
 * "NO HOT WATER" report under Heating. We remove them so the problem code
 * decides, and fall back to Heating only when nothing more specific matches.
 */
const AMBIGUOUS_COMPLAINT_CATEGORIES = ["HEAT/HOT WATER", "HEATING"];

export const CATEGORIES: IssueCategory[] = [
  ...RULES.map((r) => r.category),
  "Other",
];

export function classifyText(text: string): IssueCategory {
  const haystack = text.toLowerCase();
  for (const rule of RULES) {
    if (rule.regex.test(haystack)) return rule.category;
  }
  return "Other";
}

export function classifyComplaint(
  majorCategory?: string | null,
  minorCategory?: string | null,
  problemCode?: string | null,
): IssueCategory {
  const joined = [majorCategory, minorCategory, problemCode]
    .filter(Boolean)
    .join(" ");

  let stripped = joined;
  for (const term of AMBIGUOUS_COMPLAINT_CATEGORIES) {
    stripped = stripped.replace(new RegExp(term, "gi"), " ");
  }

  const category = classifyText(stripped);
  if (category !== "Other") return category;

  // Heating equipment codes such as "OTHER" carry no keyword of their own, so
  // the category they arrived under is the only signal left.
  const major = (majorCategory ?? "").toUpperCase();
  if (AMBIGUOUS_COMPLAINT_CATEGORIES.includes(major)) return "Heating";
  return "Other";
}

/** Violations only give us the raw legal text of the notice of violation. */
export function classifyViolation(description?: string | null): IssueCategory {
  return classifyText(description ?? "");
}

function branches(haystack: string): string[] {
  return RULES.flatMap((rule) => [
    rule.like.map((p) => `${haystack} like '${p}'`).join(" OR "),
    `'${rule.category}'`,
  ]);
}

/**
 * Compiles the rules above into SoQL so classification happens inside Socrata.
 * Without this we would have to download every violation row to count them -
 * some buildings carry well over 5,000.
 */
export function violationCaseExpression(column = "novdescription"): string {
  return `case(${branches(`upper(${column})`).join(", ")}, true, 'Other')`;
}

/** The complaint variant, with the ambiguous category labels removed first. */
export function complaintCaseExpression(
  major = "major_category",
  minor = "minor_category",
  code = "problem_code",
): string {
  const joined = [major, minor, code]
    .map((c) => `coalesce(${c}, '')`)
    .join(" || ' ' || ");

  const stripped = AMBIGUOUS_COMPLAINT_CATEGORIES.reduce(
    (expr, term) => `replace(${expr}, '${term}', ' ')`,
    `upper(${joined})`,
  );

  return `case(${branches(stripped).join(", ")}, upper(${major}) in (${AMBIGUOUS_COMPLAINT_CATEGORIES.map(
    (t) => `'${t}'`,
  ).join(", ")}), 'Heating', true, 'Other')`;
}

export const CATEGORY_ICONS: Record<IssueCategory, string> = {
  Heating: "🔥",
  "Hot Water": "🚿",
  Pests: "🐀",
  Mold: "🦠",
  Leaks: "💧",
  Electrical: "⚡",
  Other: "🏚️",
};
