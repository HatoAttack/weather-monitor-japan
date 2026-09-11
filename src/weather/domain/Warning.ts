import type { MultiPolygon, Polygon } from 'geojson';

/** Severity tiers, from least to most severe. */
export const warningTiers = ['advisory', 'warning', 'danger', 'special'] as const;
export type WarningTier = (typeof warningTiers)[number];

export const warningTierLabels: Record<WarningTier, string> = {
  advisory: '注意報',
  warning: '警報',
  danger: '危険警報',
  special: '特別警報',
};

export type WarningKind = {
  code: string;
  name: string;
  tier: WarningTier;
  /** Alert level printed in the name under the 2026 system, where one applies. */
  level?: 2 | 3 | 4 | 5;
};

export type WarningArea = {
  code: string;
  name: string;
  shape: Polygon | MultiPolygon;
  /** Warnings and advisories currently in force, most severe first. */
  kinds: WarningKind[];
  /** Newest report that described this area. */
  reportedAt: string | null;
};

/** A municipality, the unit warnings are actually issued for; its shape loads on demand. */
export type WarningMunicipality = {
  code: string;
  name: string;
  /** Code of the area the municipality belongs to. */
  area: string;
  kinds: WarningKind[];
  reportedAt: string | null;
};

export type WarningSnapshot = {
  areas: WarningArea[];
  /** Municipalities with something in force. */
  municipalities: WarningMunicipality[];
  /** Newest report time across the whole country. */
  reportedAt: string | null;
  fetchedAt: string;
  /** Codes the app has no name for; shown rather than silently dropped. */
  unknownCodes: string[];
};

export function tierRank(tier: WarningTier | null): number {
  return tier ? warningTiers.indexOf(tier) + 1 : 0;
}

export function topTier(kinds: WarningKind[]): WarningTier | null {
  return kinds.reduce<WarningTier | null>(
    (top, kind) => tierRank(kind.tier) > tierRank(top) ? kind.tier : top, null);
}
