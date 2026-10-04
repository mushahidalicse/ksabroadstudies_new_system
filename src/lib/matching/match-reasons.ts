import type { MatchCategory } from "@/lib/matching/programme-match";

export const MATCH_CATEGORY_LABEL: Record<MatchCategory, string> = {
  strong: "Strong profile match",
  possible: "Possible match",
  "needs-checking": "Requirement needs checking",
  mismatch: "Profile mismatch",
};

export const REQUIREMENT_LABEL = {
  "no-known-conflict": "No known conflict",
  "published-conflict": "Published conflict",
  unknown: "Some requirements are unknown",
} as const;

export const PREFERENCE_LABEL = {
  fits: "Fits preferences",
  conflict: "Preference conflict",
} as const;

export const MATCH_STATUS_LABEL: Record<string, string> = {
  open: "Open",
  closing: "Closing soon",
  upcoming: "Upcoming",
  closed: "Closed",
  unannounced: "Not announced",
};
