import { type TimeInterval } from "#intervals.ts";
import { type History } from "#queries/history.ts";
import { getStat } from "./index.ts";
import { type GamemodeKey, type StatKey } from "./keys.ts";
import { PRESTIGE_EXP } from "./stars.ts";

interface ComplexNumber {
    real: number;
    imag: number;
}

/**
 * Solve cubic equation: ax^3 + bx^2 + cx + d = 0
 * Returns array of complex roots
 * Uses Cardano's formula for cubic equations
 */
const solveCubic = (
    a: number,
    b: number,
    c: number,
    d: number,
): ComplexNumber[] => {
    // Handle degenerate cases
    if (Math.abs(a) < 1e-10) {
        // Not actually cubic, solve as quadratic: bx^2 + cx + d = 0
        if (Math.abs(b) < 1e-10) {
            // Not quadratic either, solve as linear: cx + d = 0
            if (Math.abs(c) < 1e-10) {
                // No solution or infinite solutions
                return [];
            }
            return [{ real: -d / c, imag: 0 }];
        }
        // Quadratic formula
        const discriminant = c * c - 4 * b * d;
        if (discriminant >= 0) {
            const sqrtDisc = Math.sqrt(discriminant);
            return [
                { real: (-c + sqrtDisc) / (2 * b), imag: 0 },
                { real: (-c - sqrtDisc) / (2 * b), imag: 0 },
            ];
        } else {
            const sqrtDisc = Math.sqrt(-discriminant);
            return [
                { real: -c / (2 * b), imag: sqrtDisc / (2 * b) },
                { real: -c / (2 * b), imag: -sqrtDisc / (2 * b) },
            ];
        }
    }

    // Normalize to x^3 + px^2 + qx + r = 0
    const p = b / a;
    const q = c / a;
    const r = d / a;

    // Substitute x = t - p/3 to eliminate quadratic term
    // Gets: t^3 + At + B = 0
    const A = q - (p * p) / 3;
    const B = r + (2 * p * p * p) / 27 - (p * q) / 3;

    // Cardano's formula
    const discriminant = -(4 * A * A * A + 27 * B * B);

    if (discriminant > 0) {
        // Three distinct real roots
        // Use trigonometric method to avoid complex arithmetic
        const m = 2 * Math.sqrt(-A / 3);
        const theta = Math.acos((3 * B) / (A * m)) / 3;
        const shift = -p / 3;

        return [
            { real: m * Math.cos(theta) + shift, imag: 0 },
            {
                real: m * Math.cos(theta - (2 * Math.PI) / 3) + shift,
                imag: 0,
            },
            {
                real: m * Math.cos(theta - (4 * Math.PI) / 3) + shift,
                imag: 0,
            },
        ];
    } else {
        // One real root (and two complex conjugates)
        const sqrtDisc = Math.sqrt(-discriminant / 27);
        const u = Math.cbrt((-B + sqrtDisc) / 2);
        const v = Math.cbrt((-B - sqrtDisc) / 2);
        const shift = -p / 3;

        const root1 = u + v + shift;
        const realPart = -(u + v) / 2 + shift;
        const imagPart = ((u - v) * Math.sqrt(3)) / 2;

        return [
            { real: root1, imag: 0 },
            { real: realPart, imag: imagPart },
            { real: realPart, imag: -imagPart },
        ];
    }
};

interface BaseStatProgression {
    trackingDataTimeInterval: TimeInterval;
    stat: StatKey;
    endValue: number;
    nextMilestoneValue: number;
    daysUntilMilestone: number;
    progressPerDay: number;
    trendingUpward: boolean;
    error?: undefined;
}

type QuotientProgression = BaseStatProgression & {
    stat: "fkdr" | "kdr";
    sessionQuotient: number;
    dividendPerDay: number;
    divisorPerDay: number;
};

export type StatProgression =
    | (BaseStatProgression & { stat: Exclude<StatKey, "fkdr" | "kdr"> })
    | QuotientProgression;

const computeQuotientProgression = (
    trackingHistory: History,
    trackingEnd: Date,
    stat: QuotientProgression["stat"],
    dividendStat: Exclude<StatKey, "winstreak">,
    divisorStat: Exclude<StatKey, "winstreak">,
    gamemode: GamemodeKey,
): QuotientProgression | { error: true; reason: string } => {
    const [start, end] = trackingHistory;
    const startDate = start.queriedAt;
    const endDate = trackingEnd;
    const daysElapsed =
        (endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000);

    const startDividend = getStat(start, gamemode, dividendStat);
    const startDivisor = getStat(start, gamemode, divisorStat);
    const endDividend = getStat(end, gamemode, dividendStat);
    const endDivisor = getStat(end, gamemode, divisorStat);

    const sessionDividend = endDividend - startDividend;
    const sessionDivisor = endDivisor - startDivisor;

    const sessionQuotient =
        sessionDivisor === 0
            ? sessionDividend
            : sessionDividend / sessionDivisor;

    const endQuotient =
        endDivisor === 0 ? endDividend : endDividend / endDivisor;

    const dividendPerDay = sessionDividend / daysElapsed;
    const divisorPerDay = sessionDivisor / daysElapsed;

    if (endDivisor === 0 && sessionDivisor === 0) {
        // Have "infinite" ratio at the end -> ratio is computed as just dividend
        const dividendProgression = computeStatProgression(
            trackingHistory,
            trackingEnd,
            dividendStat,
            gamemode,
        );
        if (dividendProgression.error) {
            return dividendProgression;
        }
        return {
            ...dividendProgression,
            stat,
            dividendPerDay,
            divisorPerDay, // 0
            sessionQuotient,
            trendingUpward: true,
        };
    }

    const infiniteSessionQuotient = sessionDivisor === 0 && sessionDividend > 0;
    const noSessionProgress = sessionDividend === 0 && sessionDivisor === 0;
    // Trend upwards if the session quotient is greater than the end quotient
    // OR: if no progress was made during the tracking session -> just need somewhere to trend
    // OR: if the session quotient is infinite
    const trendingUpward =
        sessionQuotient >= endQuotient ||
        noSessionProgress ||
        infiniteSessionQuotient;

    // TODO: Smaller steps for smaller quotients
    const nextMilestoneValue = trendingUpward
        ? Math.floor(endQuotient) + 1
        : Math.ceil(endQuotient) - 1;

    if (
        // Will make no progress since the quotients are equal (as long as the session quotient is not infinite)
        (sessionQuotient === endQuotient && !infiniteSessionQuotient) ||
        // No progress is being made on the divisor or the dividend -> No progress on the quotient
        noSessionProgress
    ) {
        // Will make no progress -> Display milestone and infinite time
        return {
            stat,
            trackingDataTimeInterval: { start: startDate, end: endDate },
            endValue: endQuotient,
            nextMilestoneValue,
            daysUntilMilestone: Infinity,
            // NOTE: Progres per day changes over time
            progressPerDay: 0,
            sessionQuotient,
            dividendPerDay,
            divisorPerDay,
            trendingUpward,
        };
    }

    // Variables:
    // k0 = endDividend
    // k  = dividendPerDay
    // d0 = endDivisor
    // d  = divisorPerDay
    // t  = daysToNextMilestone
    // M  = nextMilestoneValue
    //
    // Solve for t:
    // (k0 + kt) / (d0 + dt) = M
    // k0 + kt = Md0 + Mdt         ((d0 + dt > 0) d0 + d > 0 validated above, t chosen to be non-negative by choosing M appropriately)
    // (k - Md) t = Md0 - k0
    // t = (Md0 - k0) / (k - Md)

    if (
        trendingUpward
            ? nextMilestoneValue >= sessionQuotient && !infiniteSessionQuotient
            : nextMilestoneValue <= sessionQuotient
    ) {
        // If the milestone is out of reach given the session quotient:
        // Won't make it all the way to the milestone, only approach the session quotient
        // -> Display "reachable" milestone (session quotient) and infinite time
        //
        // If the next milestone is equal to the session quotient:
        // (k - Md) = 0
        // k = Md
        // M = k / d (= sessionQuotient)
        // Will approach but never reach milestone
        // -> Display milestone and infinite time
        return {
            stat,
            trackingDataTimeInterval: { start: startDate, end: endDate },
            endValue: endQuotient,
            nextMilestoneValue,
            daysUntilMilestone: Infinity,
            // NOTE: Progres per day changes over time
            progressPerDay: 0,
            sessionQuotient,
            dividendPerDay,
            divisorPerDay,
            trendingUpward,
        };
    }

    // t = (Md0 - k0) / (k - Md)
    // NOTE: May be infinite
    const daysUntilMilestone =
        (nextMilestoneValue * endDivisor - endDividend) /
        (dividendPerDay - nextMilestoneValue * divisorPerDay);

    return {
        stat,
        trackingDataTimeInterval: { start: startDate, end: endDate },
        endValue: endQuotient,
        nextMilestoneValue,
        daysUntilMilestone,
        // NOTE: Progres per day changes over time
        progressPerDay: (nextMilestoneValue - endQuotient) / daysUntilMilestone,
        sessionQuotient,
        dividendPerDay,
        divisorPerDay,
        trendingUpward,
    };
};

export const ERR_NO_DATA = "No data";
export const ERR_TRACKING_STARTED = "Tracking started!";

export const computeStatProgression = (
    trackingHistory: History | undefined,
    trackingEnd: Date,
    stat: StatKey,
    gamemode: GamemodeKey,
): StatProgression | { error: true; reason: string } => {
    if (trackingHistory === undefined || trackingHistory.length === 0) {
        return { error: true, reason: ERR_NO_DATA };
    }

    if (trackingHistory.length === 1) {
        return { error: true, reason: ERR_TRACKING_STARTED };
    }

    if (trackingHistory.length > 2) {
        return { error: true, reason: "Expected at most 2 data points" };
    }

    const [start, end] = trackingHistory;
    const startDate = start.queriedAt;
    const endDate = trackingEnd;
    const daysElapsed =
        (endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000);

    switch (stat) {
        case "stars": {
            const startExp = getStat(start, gamemode, "experience");
            const endExp = getStat(end, gamemode, "experience");
            const endStars = getStat(end, gamemode, "stars");

            const expPerDay = (endExp - startExp) / daysElapsed;

            // NOTE: Slightly inaccurate over short distances as it does not account for the different exp requirements for different levels
            const starsPerDay = expPerDay / (PRESTIGE_EXP / 100);

            const nextPrestige = Math.floor(endStars / 100) + 1;
            const nextPrestigeExp = nextPrestige * PRESTIGE_EXP;
            const expToNextPrestige = nextPrestigeExp - endExp;
            const daysToNextPrestige = expToNextPrestige / expPerDay;
            return {
                stat,
                trackingDataTimeInterval: { start: startDate, end: endDate },
                endValue: endStars,
                nextMilestoneValue: nextPrestige * 100,
                daysUntilMilestone: daysToNextPrestige,
                progressPerDay: starsPerDay,
                trendingUpward: true,
            };
        }
        case "fkdr":
            return computeQuotientProgression(
                trackingHistory,
                trackingEnd,
                stat,
                "finalKills",
                "finalDeaths",
                gamemode,
            );
        case "kdr":
            return computeQuotientProgression(
                trackingHistory,
                trackingEnd,
                stat,
                "kills",
                "deaths",
                gamemode,
            );
        case "index": {
            // index(t) = fkdr(t)^2 * stars(t)
            // fkdr(t) = (k0 + kt) / (d0 + dt)
            // stars(t) = s0 + st
            // index(t) = ((k0 + kt) / (d0 + dt))^2 * (s0 + st)
            //
            // Need to solve: index(t) = M
            // ((k0 + kt) / (d0 + dt))^2 * (s0 + st) = M
            // (k0 + kt)^2 * (s0 + st) = M * (d0 + dt)^2
            //
            // This is a cubic polynomial in t when expanded
            // May have multiple real roots - use the smallest positive root

            const startExp = getStat(start, gamemode, "experience");
            const endExp = getStat(end, gamemode, "experience");
            const endStars = getStat(end, gamemode, "stars");
            const expPerDay = (endExp - startExp) / daysElapsed;
            const starsPerDay = expPerDay / (PRESTIGE_EXP / 100);

            const startFinalKills = getStat(start, gamemode, "finalKills");
            const startFinalDeaths = getStat(start, gamemode, "finalDeaths");
            const endFinalKills = getStat(end, gamemode, "finalKills");
            const endFinalDeaths = getStat(end, gamemode, "finalDeaths");

            const finalKillsPerDay =
                (endFinalKills - startFinalKills) / daysElapsed;
            const finalDeathsPerDay =
                (endFinalDeaths - startFinalDeaths) / daysElapsed;

            const startIndex = getStat(start, gamemode, "index");
            const endIndex = getStat(end, gamemode, "index");

            // Check if any progress is being made
            if (
                expPerDay === 0 &&
                finalKillsPerDay === 0 &&
                finalDeathsPerDay === 0
            ) {
                return { error: true, reason: "No progress" };
            }

            // Determine if index is trending upward based on actual progression
            const indexChange = endIndex - startIndex;
            const trendingUpward = indexChange >= 0;
            
            // Determine next milestone
            // TODO: More meaningful milestones
            const endMagnitude = Math.pow(10, Math.floor(Math.log10(endIndex)));
            const nextMilestoneValue =
                (Math.floor(endIndex / endMagnitude) +
                    (trendingUpward ? 1 : -1)) *
                endMagnitude;

            // Solve for t when index(t) = M
            // 
            // When deaths are non-zero: fkdr = finalKills / finalDeaths
            //   index(t) = ((k0 + kt) / (d0 + dt))^2 * (s0 + st)
            //   Equation: (k0 + kt)^2 * (s0 + st) = M * (d0 + dt)^2
            //
            // When deaths are zero: fkdr = finalKills
            //   index(t) = (k0 + kt)^2 * (s0 + st)
            //   Equation: (k0 + kt)^2 * (s0 + st) = M
            
            const k0 = endFinalKills;
            const k = finalKillsPerDay;
            const d0 = endFinalDeaths;
            const d = finalDeathsPerDay;
            const s0 = endStars;
            const s = starsPerDay;
            const M = nextMilestoneValue;

            let a, b, c, e;
            
            if (d0 === 0 && d === 0) {
                // Special case: no deaths, fkdr = finalKills
                // Equation: (k0 + kt)^2 * (s0 + st) = M
                // Expanding: (k0^2 + 2*k0*k*t + k^2*t^2) * (s0 + s*t) = M
                // k0^2*s0 + k0^2*s*t + 2*k0*k*s0*t + 2*k0*k*s*t^2 + k^2*s0*t^2 + k^2*s*t^3 = M
                // Rearranging to: a*t^3 + b*t^2 + c*t + e = 0
                a = k * k * s;
                b = 2 * k0 * k * s + k * k * s0;
                c = k0 * k0 * s + 2 * k0 * k * s0;
                e = k0 * k0 * s0 - M;
            } else {
                // General case: fkdr = finalKills / finalDeaths
                // Equation: (k0 + kt)^2 * (s0 + st) = M * (d0 + dt)^2
                // Expanding: (k0^2 + 2*k0*k*t + k^2*t^2) * (s0 + s*t) = M * (d0^2 + 2*d0*d*t + d^2*t^2)
                // k0^2*s0 + k0^2*s*t + 2*k0*k*s0*t + 2*k0*k*s*t^2 + k^2*s0*t^2 + k^2*s*t^3 = M*d0^2 + 2*M*d0*d*t + M*d^2*t^2
                // Rearranging to: a*t^3 + b*t^2 + c*t + e = 0
                a = k * k * s;
                b = 2 * k0 * k * s + k * k * s0 - M * d * d;
                c = k0 * k0 * s + 2 * k0 * k * s0 - 2 * M * d0 * d;
                e = k0 * k0 * s0 - M * d0 * d0;
            }

            // Solve cubic equation
            const roots = solveCubic(a, b, c, e);

            // Filter for positive real roots and find the smallest
            // Also verify that the index is actually progressing toward the milestone
            const positiveRoots = roots.filter((root) => {
                if (root.imag !== 0 || root.real <= 1e-10) {
                    return false;
                }
                
                // Calculate index at this time to verify direction
                const t = root.real;
                const fkdrAtT = (k0 + k * t) / (d0 + d * t);
                const starsAtT = s0 + s * t;
                const indexAtT = fkdrAtT * fkdrAtT * starsAtT;
                
                // Check if index is moving in the right direction
                if (trendingUpward) {
                    // For upward trend, index at t should be >= milestone
                    // (within small tolerance for numerical errors)
                    return indexAtT >= M - 1e-6;
                } else {
                    // For downward trend, index at t should be <= milestone
                    return indexAtT <= M + 1e-6;
                }
            });

            if (positiveRoots.length === 0) {
                // No positive roots - milestone is unreachable
                return {
                    stat,
                    trackingDataTimeInterval: { start: startDate, end: endDate },
                    endValue: endIndex,
                    nextMilestoneValue,
                    daysUntilMilestone: Infinity,
                    progressPerDay: 0,
                    trendingUpward,
                };
            }

            // Use the smallest positive root (first time reaching the milestone)
            const daysUntilMilestone = Math.min(
                ...positiveRoots.map((r) => r.real),
            );

            return {
                stat,
                trackingDataTimeInterval: { start: startDate, end: endDate },
                endValue: endIndex,
                nextMilestoneValue,
                daysUntilMilestone,
                progressPerDay:
                    (nextMilestoneValue - endIndex) / daysUntilMilestone,
                trendingUpward,
            };
        }
        case "experience":
        case "gamesPlayed":
        case "wins":
        case "losses":
        case "bedsBroken":
        case "bedsLost":
        case "finalKills":
        case "finalDeaths":
        case "kills":
        case "deaths": {
            const startValue = getStat(start, gamemode, stat);
            const endValue = getStat(end, gamemode, stat);
            const increasePerDay = (endValue - startValue) / daysElapsed;

            if (increasePerDay === 0) {
                // Will make no progress
                // TODO: Display upward milestone and infinite time
                return {
                    error: true,
                    reason: "No progress",
                };
            }

            const endMagnitude = Math.pow(10, Math.floor(Math.log10(endValue)));
            // TODO: More meaningful milestones (e.g. 100, 250, 500, 1000, 2500, 5000, 10000, 20000, 30000, ...)
            // TODO: Pick your own milestone
            const nextMilestoneValue =
                (Math.floor(endValue / endMagnitude) + 1) * endMagnitude;

            const daysUntilMilestone =
                (nextMilestoneValue - endValue) / increasePerDay;

            return {
                stat,
                trackingDataTimeInterval: { start: startDate, end: endDate },
                endValue,
                nextMilestoneValue,
                daysUntilMilestone,
                progressPerDay: increasePerDay,
                trendingUpward: true,
            };
        }

        case "winstreak":
            return { error: true, reason: "Not implemented" };
        default:
            stat satisfies never;
    }

    return { error: true, reason: "Unknown stat" };
};
