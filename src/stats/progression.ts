import { type TimeInterval } from "#intervals.ts";
import { type History } from "#queries/history.ts";
import { getStat } from "./index.ts";
import { type GamemodeKey, type StatKey } from "./keys.ts";
import { PRESTIGE_EXP, bedwarsLevelFromExp } from "./stars.ts";

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

/**
 * Solve cubic equation at^3 + bt^2 + ct + d = 0 for t
 * Returns all non-negative real roots, sorted in ascending order
 */
const solveCubicAllRoots = (
    a: number,
    b: number,
    c: number,
    d: number,
): number[] => {
    const epsilon = 1e-10;

    // Handle degenerate cases
    if (Math.abs(a) < epsilon) {
        // Not a cubic, reduce to quadratic: bt^2 + ct + d = 0
        if (Math.abs(b) < epsilon) {
            // Not a quadratic, reduce to linear: ct + d = 0
            if (Math.abs(c) < epsilon) {
                // No solution (or all t are solutions if d = 0)
                return [];
            }
            // Linear solution: t = -d/c
            const t = -d / c;
            return t >= -epsilon ? [Math.max(0, t)] : [];
        }
        // Quadratic solution: t = (-c ± sqrt(c^2 - 4bd)) / (2b)
        const discriminant = c * c - 4 * b * d;
        if (discriminant < -epsilon) {
            return [];
        }
        const sqrtDisc = Math.sqrt(Math.max(0, discriminant));
        const t1 = (-c + sqrtDisc) / (2 * b);
        const t2 = (-c - sqrtDisc) / (2 * b);
        const roots = [t1, t2]
            .filter((t) => t >= -epsilon)
            .map((t) => Math.max(0, t))
            .sort((a, b) => a - b);
        // Remove duplicates
        return roots.filter((t, i, arr) => i === 0 || Math.abs(t - arr[i - 1]) > epsilon);
    }

    // Normalize to t^3 + pt^2 + qt + r = 0
    const p = b / a;
    const q = c / a;
    const r = d / a;

    // Use Cardano's formula
    // Substitute t = u - p/3 to eliminate the quadratic term
    // u^3 + Au + B = 0 where:
    const A = q - (p * p) / 3;
    const B = (2 * p * p * p) / 27 - (p * q) / 3 + r;

    // Discriminant for the depressed cubic
    const discriminant = -(4 * A * A * A + 27 * B * B);

    const roots: number[] = [];

    if (discriminant > epsilon) {
        // Three distinct real roots
        // Use trigonometric solution
        const m = 2 * Math.sqrt(-A / 3);
        const theta = Math.acos((3 * B) / (A * m)) / 3;
        for (let k = 0; k < 3; k++) {
            const u = m * Math.cos(theta - (2 * Math.PI * k) / 3);
            const t = u - p / 3;
            if (t >= -epsilon) {
                roots.push(Math.max(0, t));
            }
        }
    } else if (Math.abs(discriminant) <= epsilon) {
        // One or two real roots (with multiplicity)
        if (Math.abs(A) < epsilon && Math.abs(B) < epsilon) {
            // Triple root at t = -p/3
            const t = -p / 3;
            if (t >= -epsilon) {
                roots.push(Math.max(0, t));
            }
        } else {
            // Double root
            const u1 = (3 * B) / A;
            const u2 = (-3 * B) / (2 * A);
            for (const u of [u1, u2]) {
                const t = u - p / 3;
                if (t >= -epsilon) {
                    roots.push(Math.max(0, t));
                }
            }
        }
    } else {
        // One real root
        const sqrtTerm = Math.sqrt(-discriminant / 27);
        const cbrtArg = -B / 2;
        const u =
            Math.cbrt(cbrtArg + sqrtTerm) + Math.cbrt(cbrtArg - sqrtTerm);
        const t = u - p / 3;
        if (t >= -epsilon) {
            roots.push(Math.max(0, t));
        }
    }

    // Sort and remove duplicates
    const sorted = roots.sort((a, b) => a - b);
    return sorted.filter((t, i, arr) => i === 0 || Math.abs(t - arr[i - 1]) > epsilon);
};

/**
 * Solve cubic equation at^3 + bt^2 + ct + d = 0 for t
 * Returns the smallest non-negative real root, or null if none exists
 */
const solveCubic = (
    a: number,
    b: number,
    c: number,
    d: number,
): number | null => {
    const roots = solveCubicAllRoots(a, b, c, d);
    return roots.length > 0 ? roots[0] : null;
};

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
            const startExp = getStat(start, gamemode, "experience");
            const endExp = getStat(end, gamemode, "experience");
            const startFinalKills = getStat(start, gamemode, "finalKills");
            const endFinalKills = getStat(end, gamemode, "finalKills");
            const startFinalDeaths = getStat(start, gamemode, "finalDeaths");
            const endFinalDeaths = getStat(end, gamemode, "finalDeaths");

            const endStars = bedwarsLevelFromExp(endExp);
            const endFkdr =
                endFinalDeaths === 0
                    ? endFinalKills
                    : endFinalKills / endFinalDeaths;
            const endIndex = endFkdr ** 2 * endStars;

            // Calculate per-day rates
            const starsPerDay = (endExp - startExp) / daysElapsed / (PRESTIGE_EXP / 100);
            const finalKillsPerDay = (endFinalKills - startFinalKills) / daysElapsed;
            const finalDeathsPerDay = (endFinalDeaths - startFinalDeaths) / daysElapsed;

            // Calculate session fkdr
            const sessionFinalKills = endFinalKills - startFinalKills;
            const sessionFinalDeaths = endFinalDeaths - startFinalDeaths;
            const sessionFkdr =
                sessionFinalDeaths === 0
                    ? sessionFinalKills
                    : sessionFinalKills / sessionFinalDeaths;

            // Check for no progress case
            const noSessionProgress =
                sessionFinalKills === 0 &&
                sessionFinalDeaths === 0 &&
                endExp === startExp;

            if (noSessionProgress) {
                // Determine next milestone
                const endIndexMagnitude = Math.pow(10, Math.floor(Math.log10(Math.max(1, endIndex))));
                const nextMilestoneValue = (Math.floor(endIndex / endIndexMagnitude) + 1) * endIndexMagnitude;
                
                return {
                    stat,
                    trackingDataTimeInterval: { start: startDate, end: endDate },
                    endValue: endIndex,
                    nextMilestoneValue,
                    daysUntilMilestone: Infinity,
                    progressPerDay: 0,
                    trendingUpward: true,
                };
            }

            // Calculate rate of change of fkdr
            // fkdr(t) = (k0 + k*t) / (d0 + d*t)  where k=finalKillsPerDay, d=finalDeathsPerDay
            // d(fkdr)/dt = (k * (d0 + d*t) - (k0 + k*t) * d) / (d0 + d*t)^2
            //            = (k * d0 - k0 * d) / (d0 + d*t)^2
            // At t=0 (now): d(fkdr)/dt = (k * d0 - k0 * d) / d0^2
            const fkdrRatePerDay = 
                endFinalDeaths === 0 
                    ? finalKillsPerDay 
                    : (finalKillsPerDay * endFinalDeaths - endFinalKills * finalDeathsPerDay) / (endFinalDeaths * endFinalDeaths);

            // Calculate rate of change of index
            // index(t) = stars(t) * fkdr(t)^2
            // d(index)/dt = starsPerDay * fkdr^2 + 2 * stars * fkdr * d(fkdr)/dt
            const indexRatePerDay = starsPerDay * endFkdr * endFkdr + 2 * endStars * endFkdr * fkdrRatePerDay;

            // Determine if trending upward
            const trendingUpward = indexRatePerDay >= 0;

            // Determine next milestone
            // Calculate magnitude based on the current index value
            let endIndexMagnitude = Math.pow(10, Math.floor(Math.log10(Math.max(1, endIndex))));
            
            let nextMilestoneValue: number;
            if (trendingUpward) {
                // Round down to nearest magnitude and add one magnitude
                nextMilestoneValue = (Math.floor(endIndex / endIndexMagnitude) + 1) * endIndexMagnitude;
            } else {
                // For downward trends: if we're exactly at a magnitude boundary, use a smaller step
                // E.g., for index=100 going down, we want milestone 90 (step=10), not 0 (step=100)
                if (endIndex === endIndexMagnitude) {
                    endIndexMagnitude = endIndexMagnitude / 10;
                }
                // Round up to nearest magnitude and subtract one magnitude
                nextMilestoneValue = (Math.ceil(endIndex / endIndexMagnitude) - 1) * endIndexMagnitude;
                // Handle case where we'd go negative
                if (nextMilestoneValue < 0) {
                    nextMilestoneValue = 0;
                }
            }

            // Special case: zero final deaths throughout (compute fkdr as just final kills)
            if (endFinalDeaths === 0 && sessionFinalDeaths === 0) {
                // index(t) = (s_0 + s*t) * (k_0 + k*t)^2
                // Solve for index(t) = M
                // (s_0 + s*t) * (k_0 + k*t)^2 = M
                // Let s_0 = endStars, s = starsPerDay, k_0 = endFinalKills, k = finalKillsPerDay
                const s0 = endStars;
                const s = starsPerDay;
                const k0 = endFinalKills;
                const k = finalKillsPerDay;
                const M = nextMilestoneValue;

                // Expand: (s_0 + s*t) * (k_0^2 + 2*k_0*k*t + k^2*t^2) = M
                // s_0*k_0^2 + 2*s_0*k_0*k*t + s_0*k^2*t^2 + s*k_0^2*t + 2*s*k_0*k*t^2 + s*k^2*t^3 = M
                // s*k^2*t^3 + (s_0*k^2 + 2*s*k_0*k)*t^2 + (2*s_0*k_0*k + s*k_0^2)*t + (s_0*k_0^2 - M) = 0
                const a = s * k * k;
                const b = s0 * k * k + 2 * s * k0 * k;
                const c = 2 * s0 * k0 * k + s * k0 * k0;
                const d = s0 * k0 * k0 - M;

                const daysUntilMilestone = solveCubic(a, b, c, d);
                if (daysUntilMilestone === null) {
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

                return {
                    stat,
                    trackingDataTimeInterval: { start: startDate, end: endDate },
                    endValue: endIndex,
                    nextMilestoneValue,
                    daysUntilMilestone,
                    progressPerDay: (nextMilestoneValue - endIndex) / daysUntilMilestone,
                    trendingUpward,
                };
            }

            // General case: solve cubic equation
            // index(t) = (s_0 + s*t) * (k_0+k*t)^2/(d_0+d*t)^2 = M
            // (s_0 + s*t) * (k_0^2 + 2*k_0*k*t + k^2*t^2) = M * (d_0^2 + 2*d_0*d*t + d^2*t^2)
            // Expanding and collecting terms:
            // s*k^2*t^3 + (s_0*k^2 + 2*s*k_0*k - M*d^2)*t^2 + (2*s_0*k_0*k + s*k_0^2 - 2*M*d_0*d)*t + (s_0*k_0^2 - M*d_0^2) = 0
            const s0 = endStars;
            const s = starsPerDay;
            const k0 = endFinalKills;
            const k = finalKillsPerDay;
            const d0 = endFinalDeaths;
            const d = finalDeathsPerDay;
            const M = nextMilestoneValue;

            const a = s * k * k;
            const b = s0 * k * k + 2 * s * k0 * k - M * d * d;
            const c = 2 * s0 * k0 * k + s * k0 * k0 - 2 * M * d0 * d;
            const d_coef = s0 * k0 * k0 - M * d0 * d0;

            // Find all roots
            const allRoots = solveCubicAllRoots(a, b, c, d_coef);
            
            // Filter roots based on trend direction
            // Calculate d(index)/dt at each root to check if we're crossing in the right direction
            const validRoots = allRoots.filter((t) => {
                // Calculate index derivative at time t
                // index(t) = (s_0 + s*t) * (k_0+k*t)^2/(d_0+d*t)^2
                // Using the derivative we calculated earlier but at time t
                const stars_t = s0 + s * t;
                const fk_t = k0 + k * t;
                const fd_t = d0 + d * t;
                const fkdr_t = fk_t / fd_t;
                const fkdrRate_t = (k * fd_t - fk_t * d) / (fd_t * fd_t);
                const indexRate_t = s * fkdr_t * fkdr_t + 2 * stars_t * fkdr_t * fkdrRate_t;
                
                // For upward trend (indexRatePerDay >= 0), we want crossings where d(index)/dt >= 0
                // For downward trend (indexRatePerDay < 0), we want crossings where d(index)/dt < 0
                // Use the same sign as the overall trend direction
                const epsilon = 1e-6;
                if (trendingUpward) {
                    return indexRate_t > -epsilon;
                } else {
                    return indexRate_t < epsilon;
                }
            });
            
            const daysUntilMilestone = validRoots.length > 0 ? validRoots[validRoots.length - 1] : null;
            
            if (daysUntilMilestone === null) {
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

            return {
                stat,
                trackingDataTimeInterval: { start: startDate, end: endDate },
                endValue: endIndex,
                nextMilestoneValue,
                daysUntilMilestone,
                progressPerDay: (nextMilestoneValue - endIndex) / daysUntilMilestone,
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
