import { describe, expect, test } from "vitest";

import { formatStatValue } from "./format.ts";

// `toLocaleString` uses the runtime's default locale, so the decimal separator
// is environment-dependent (a comma in nb-NO, a dot in en-US). Assertions that
// span the separator therefore accept either character instead of hard-coding
// one, while the collapse logic under test (tier selection, suffix, threshold
// gating, sign handling) is locale-independent.
const sep = "[.,]";

describe("formatStatValue collapsed notation", () => {
    test("collapses millions to an M suffix (the motivating case)", () => {
        // 1_123_123 -> "1,123M" (nb) / "1.123M" (en)
        expect(
            formatStatValue("index", 1_123_123, {
                notation: "collapsed",
                precision: "detailed",
            }),
        ).toMatch(new RegExp(`^1${sep}123M$`));
    });

    test("picks the right tier per magnitude", () => {
        expect(formatStatValue("index", 45_000, { notation: "collapsed" })).toBe("45K");
        expect(formatStatValue("index", 2_500_000, { notation: "collapsed" })).toMatch(
            new RegExp(`^2${sep}5M$`),
        );
        expect(
            formatStatValue("index", 2_500_000_000, { notation: "collapsed" }),
        ).toMatch(new RegExp(`^2${sep}5B$`));
        expect(
            formatStatValue("index", 12_000_000_000_000, { notation: "collapsed" }),
        ).toBe("12T");
    });

    test("trims trailing zeros on exact tiers", () => {
        expect(formatStatValue("index", 1_000_000, { notation: "collapsed" })).toBe(
            "1M",
        );
        expect(formatStatValue("index", 1000, { notation: "collapsed" })).toBe("1K");
    });

    test("does not collapse below the smallest tier", () => {
        expect(formatStatValue("index", 999, { notation: "collapsed" })).toBe("999");
        expect(formatStatValue("index", 0, { notation: "collapsed" })).toBe("0");
    });

    test("carries a smaller mantissa in compact vs detailed precision", () => {
        // compact -> 2 fraction digits, detailed -> 3.
        expect(
            formatStatValue("index", 1_123_400, {
                notation: "collapsed",
                precision: "compact",
            }),
        ).toMatch(new RegExp(`^1${sep}12M$`));
        expect(
            formatStatValue("index", 1_123_400, {
                notation: "collapsed",
                precision: "detailed",
            }),
        ).toMatch(new RegExp(`^1${sep}123M$`));
    });

    test("honours signDisplay and negatives", () => {
        expect(
            formatStatValue("index", 1_200_000, {
                notation: "collapsed",
                signDisplay: "always",
            }),
        ).toMatch(new RegExp(`^\\+1${sep}2M$`));
        expect(formatStatValue("index", -1_200_000, { notation: "collapsed" })).toMatch(
            new RegExp(`^-1${sep}2M$`),
        );
    });

    test("collapses large decimal-kind stats too", () => {
        expect(formatStatValue("fkdr", 1500, { notation: "collapsed" })).toMatch(
            new RegExp(`^1${sep}5K$`),
        );
    });

    test("leaves small decimal-kind stats to standard formatting", () => {
        expect(
            formatStatValue("fkdr", 5.25, {
                notation: "collapsed",
                precision: "detailed",
            }),
        ).toBe(formatStatValue("fkdr", 5.25, { precision: "detailed" }));
    });

    test("never collapses percentage-kind stats", () => {
        expect(formatStatValue("winrate", 0.734, { notation: "collapsed" })).toBe(
            formatStatValue("winrate", 0.734),
        );
    });
});

describe("formatStatValue standard notation is unchanged", () => {
    test("integers keep full digit grouping by default", () => {
        expect(formatStatValue("index", 1_123_123)).toBe(
            (1_123_123).toLocaleString(undefined, { maximumFractionDigits: 0 }),
        );
        // No magnitude suffix leaks into the default rendering.
        expect(formatStatValue("index", 1_123_123)).not.toMatch(/[KMBT]$/);
    });

    test("explicitly requesting standard notation matches the default", () => {
        expect(formatStatValue("index", 1_123_123, { notation: "standard" })).toBe(
            formatStatValue("index", 1_123_123),
        );
    });
});
