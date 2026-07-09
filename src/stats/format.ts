import type { StatKey } from "./keys.ts";

export type StatFormatKind = "integer" | "decimal" | "percentage";

// Record<StatKey, …> is exhaustive: a new stat won't compile until its format
// kind is declared here. (Commit 3 adds "percentage" and the `winrate` entry.)
export const STAT_FORMAT_KIND: Record<StatKey, StatFormatKind> = {
    experience: "integer",
    stars: "decimal",
    winstreak: "integer",
    gamesPlayed: "integer",
    wins: "integer",
    losses: "integer",
    bedsBroken: "integer",
    bedsLost: "integer",
    finalKills: "integer",
    finalDeaths: "integer",
    kills: "integer",
    deaths: "integer",
    fkdr: "decimal",
    kdr: "decimal",
    bblr: "decimal",
    wlr: "decimal",
    winrate: "percentage",
    index: "integer",
};

export const getStatFormatKind = (stat: StatKey): StatFormatKind =>
    STAT_FORMAT_KIND[stat];

// --- Collapsed notation for large magnitudes --------------------------------
// Large integer stats (index, experience, lifetime kill/win counts) render as
// long digit strings ("1.123.123") that are hard to scan at a glance. In
// "collapsed" notation we shorten them to a mantissa + a single-letter
// magnitude suffix, keeping the locale's own decimal separator:
//   1_123_123     -> "1,123M" (nb-NO)  / "1.123M" (en-US)
//   45_000        -> "45K"
//   2_500_000_000 -> "2,5B"
// The suffix stays Latin (K/M/B/T) rather than the locale-spelled form
// ("mill.") that `Intl` compact notation would produce, so the shape is stable
// across locales. Only magnitudes at/above the smallest tier collapse; smaller
// values fall through to the normal per-kind formatting, so "42 wins" is left
// as "42".
const COLLAPSE_TIERS = [
    { threshold: 1e12, suffix: "T" },
    { threshold: 1e9, suffix: "B" },
    { threshold: 1e6, suffix: "M" },
    { threshold: 1e3, suffix: "K" },
] as const;

const SMALLEST_COLLAPSE_TIER = 1e3;

const formatCollapsed = (
    value: number,
    maximumFractionDigits: number,
    signDisplay: Intl.NumberFormatOptions["signDisplay"],
): string => {
    const tier = COLLAPSE_TIERS.find(({ threshold }) => Math.abs(value) >= threshold);
    if (tier === undefined) {
        // Callers gate on `>= SMALLEST_COLLAPSE_TIER`, so this is unreachable;
        // fall back to a plain integer render to stay safe.
        return value.toLocaleString(undefined, {
            maximumFractionDigits: 0,
            signDisplay,
        });
    }
    // `maximumFractionDigits` (with the implicit `minimumFractionDigits: 0`)
    // trims trailing zeros, so an exact tier renders as "2M", not "2,00M".
    const mantissa = (value / tier.threshold).toLocaleString(undefined, {
        maximumFractionDigits,
        signDisplay,
    });
    return `${mantissa}${tier.suffix}`;
};

interface FormatStatValueOptions {
    // "compact" → cards / diffs / short contexts (fewer decimals);
    // "detailed" → values / tooltips / hover detail (more decimals).
    readonly precision?: "compact" | "detailed";
    // "collapsed" shortens large magnitudes to a mantissa + K/M/B/T suffix (see
    // `formatCollapsed`). "standard" (the default) keeps full digit grouping.
    readonly notation?: "standard" | "collapsed";
    readonly signDisplay?: Intl.NumberFormatOptions["signDisplay"];
}

export const formatStatValue = (
    stat: StatKey,
    value: number,
    {
        precision = "compact",
        notation = "standard",
        signDisplay,
    }: FormatStatValueOptions = {},
): string => {
    const kind = getStatFormatKind(stat);

    // Collapse only genuinely large magnitudes. Percentages are bounded in
    // practice (a winrate never leaves [0, 1]), so they always keep their own
    // formatting and never grow a K/M suffix.
    if (
        notation === "collapsed" &&
        kind !== "percentage" &&
        Math.abs(value) >= SMALLEST_COLLAPSE_TIER
    ) {
        return formatCollapsed(value, precision === "detailed" ? 3 : 2, signDisplay);
    }

    switch (kind) {
        case "decimal": {
            const digits = precision === "detailed" ? 3 : 2;
            return value.toLocaleString(undefined, {
                minimumFractionDigits: digits,
                maximumFractionDigits: digits,
                signDisplay,
            });
        }
        case "integer": {
            return value.toLocaleString(undefined, {
                maximumFractionDigits: 0,
                signDisplay,
            });
        }
        case "percentage": {
            // `style: "percent"` scales by 100 and appends a locale-aware percent
            // sign/spacing, so pass the raw fraction (not `value * 100`).
            // min = max (like the decimal case) for a fixed number of decimals.
            const digits = precision === "detailed" ? 2 : 1;
            return value.toLocaleString(undefined, {
                style: "percent",
                minimumFractionDigits: digits,
                maximumFractionDigits: digits,
                signDisplay,
            });
        }
    }
};
