import type { History } from "#queries/history.ts";
import type {
    GameOutcome,
    GameResult,
    GameSegment,
    Gamemode,
} from "#queries/sessionAt.ts";
import type { Session } from "#queries/sessions.ts";
import { computeStatProgression } from "#stats/progression.ts";
import { bedwarsLevelFromExp } from "#stats/stars.ts";

export const GAMEMODES: readonly Gamemode[] = ["solo", "doubles", "threes", "fours"];

export interface SessionAggregate {
    readonly games: number;
    readonly wins: number;
    readonly losses: number;
    readonly fk: number;
    readonly fd: number;
    readonly bb: number;
    readonly bl: number;
    readonly k: number;
    readonly d: number;
    readonly xp: number;
    readonly stars: number;
    readonly fkdr: number;
    readonly lifetimeFkdr: number;
    readonly winRate: number;
    readonly lifetimeWR: number;
    readonly elapsedMs: number;
}

const ratio = (numerator: number, denominator: number): number =>
    denominator === 0 ? numerator : numerator / denominator;

export const aggregate = (session: Session): SessionAggregate => {
    const first = session.start.overall;
    const last = session.end.overall;
    const games = last.gamesPlayed - first.gamesPlayed;
    const wins = last.wins - first.wins;
    const losses = last.losses - first.losses;
    const fk = last.finalKills - first.finalKills;
    const fd = last.finalDeaths - first.finalDeaths;
    const bb = last.bedsBroken - first.bedsBroken;
    const bl = last.bedsLost - first.bedsLost;
    const k = last.kills - first.kills;
    const d = last.deaths - first.deaths;
    const xp = session.end.experience - session.start.experience;
    const stars =
        bedwarsLevelFromExp(session.end.experience) -
        bedwarsLevelFromExp(session.start.experience);
    return {
        games,
        wins,
        losses,
        fk,
        fd,
        bb,
        bl,
        k,
        d,
        xp,
        stars,
        fkdr: ratio(fk, fd),
        lifetimeFkdr: ratio(first.finalKills, first.finalDeaths),
        winRate: ratio(wins, games),
        lifetimeWR: ratio(first.wins, first.gamesPlayed),
        elapsedMs: session.end.queriedAt.getTime() - session.start.queriedAt.getTime(),
    };
};

export interface ModeStats {
    readonly games: number;
    readonly wins: number;
    readonly losses: number;
    readonly winRate: number;
    readonly fk: number;
    readonly fd: number;
    readonly fkdr: number;
    readonly bb: number;
    readonly bl: number;
    readonly k: number;
    readonly d: number;
    readonly kdr: number;
}

export const modeBreakdown = (session: Session): Record<Gamemode, ModeStats> => {
    const out = {} as Record<Gamemode, ModeStats>;
    for (const mode of GAMEMODES) {
        const first = session.start[mode];
        const last = session.end[mode];
        const games = last.gamesPlayed - first.gamesPlayed;
        const wins = last.wins - first.wins;
        const losses = last.losses - first.losses;
        const fk = last.finalKills - first.finalKills;
        const fd = last.finalDeaths - first.finalDeaths;
        const bb = last.bedsBroken - first.bedsBroken;
        const bl = last.bedsLost - first.bedsLost;
        const k = last.kills - first.kills;
        const d = last.deaths - first.deaths;
        out[mode] = {
            games,
            wins,
            losses,
            winRate: ratio(wins, games),
            fk,
            fd,
            fkdr: ratio(fk, fd),
            bb,
            bl,
            k,
            d,
            kdr: ratio(k, d),
        };
    }
    return out;
};

export interface TrajectoryPoint {
    readonly x: number;
    readonly sessionFkdr: number;
    readonly lifetimeFkdr: number;
}

/**
 * Compute the per-segment FKDR trajectory: the cumulative session FKDR
 * and the live lifetime FKDR after each segment. Segments without a
 * derivable game (no-game windows / ambiguous jumps) still anchor a
 * trajectory point — using the segment's end-of-window stats — so the
 * line stays continuous.
 */
export const fkdrTrajectory = (
    session: Session,
    segments: readonly GameSegment[],
): TrajectoryPoint[] => {
    const baseFK = session.start.overall.finalKills;
    const baseFD = session.start.overall.finalDeaths;
    return segments.map((seg, i) => ({
        x: i + 1,
        sessionFkdr: ratio(
            seg.end.overall.finalKills - baseFK,
            seg.end.overall.finalDeaths - baseFD,
        ),
        lifetimeFkdr: ratio(seg.end.overall.finalKills, seg.end.overall.finalDeaths),
    }));
};

export interface Milestone {
    readonly key: "prestige" | "wins" | "fkdr";
    readonly label: string;
    readonly current: number;
    /** The next milestone value, or null when no progress was made this session. */
    readonly target: number | null;
    readonly format: (v: number) => string;
    readonly deltaFormat: () => string;
    /** How many sessions like this one to reach the target (∞ if not on pace). */
    readonly sessions: number;
    /** Projected playtime to reach the target, in ms (0 if not on pace). */
    readonly playtimeMs: number;
    /** Set when the target is unreachable at this session's pace. */
    readonly blockedReason: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

interface MilestoneSpec {
    readonly key: Milestone["key"];
    readonly label: string;
    readonly stat: "stars" | "wins" | "fkdr";
    readonly format: (v: number) => string;
    readonly deltaFormat: () => string;
    readonly currentFallback: number;
}

/**
 * Milestones for the session, computed with the *same* projection helper the
 * regular session page uses (`computeStatProgression`), so the milestone
 * targets and ETAs always agree between the two pages.
 *
 * The trick: feed the session itself as the tracking interval. The pace is then
 * "progress per session-worth of play", so `daysUntilMilestone` comes back as
 * the projected playtime to reach the target — which divided by the session
 * length is "X sessions like this".
 */
export const computeMilestones = (
    session: Session,
    agg: SessionAggregate,
): Milestone[] => {
    const history: History = [session.start, session.end];
    const trackingEnd = session.end.queriedAt;
    const sessionMs = agg.elapsedMs;
    const last = session.end;

    const specs: readonly MilestoneSpec[] = [
        {
            key: "prestige",
            label: "Next prestige",
            stat: "stars",
            format: (v) => `✦${v.toFixed(0)}`,
            deltaFormat: () => `+${agg.stars.toFixed(2)}/session`,
            currentFallback: bedwarsLevelFromExp(last.experience),
        },
        {
            key: "wins",
            label: "Next wins milestone",
            stat: "wins",
            format: (v) => v.toLocaleString(),
            deltaFormat: () => `+${agg.wins.toString()}/session`,
            currentFallback: last.overall.wins,
        },
        {
            key: "fkdr",
            label: "Next FKDR milestone",
            stat: "fkdr",
            format: (v) => v.toFixed(2),
            deltaFormat: () => `session: ${agg.fkdr.toFixed(2)}`,
            currentFallback: ratio(last.overall.finalKills, last.overall.finalDeaths),
        },
    ];

    return specs.map((spec): Milestone => {
        const progression = computeStatProgression(
            history,
            trackingEnd,
            spec.stat,
            "overall",
        );
        if (progression.error) {
            return {
                key: spec.key,
                label: spec.label,
                current: spec.currentFallback,
                target: null,
                format: spec.format,
                deltaFormat: spec.deltaFormat,
                sessions: Number.POSITIVE_INFINITY,
                playtimeMs: 0,
                blockedReason: "No progress this session",
            };
        }

        const reachable = Number.isFinite(progression.daysUntilMilestone);
        const playtimeMs = reachable ? progression.daysUntilMilestone * DAY_MS : 0;
        const sessions =
            reachable && sessionMs > 0
                ? playtimeMs / sessionMs
                : Number.POSITIVE_INFINITY;
        return {
            key: spec.key,
            label: spec.label,
            current: progression.endValue,
            target: progression.nextMilestoneValue,
            format: spec.format,
            deltaFormat: spec.deltaFormat,
            sessions,
            playtimeMs,
            blockedReason: reachable ? null : "Not on pace to reach this",
        };
    });
};

export const formatLong = (ms: number): string => {
    const totalMin = Math.max(0, Math.round(ms / 60_000));
    const days = Math.floor(totalMin / (60 * 24));
    const hours = Math.floor((totalMin % (60 * 24)) / 60);
    const mins = totalMin % 60;
    if (days > 0) return `${days.toString()}d ${hours.toString()}h`;
    if (hours > 0) return `${hours.toString()}h ${String(mins).padStart(2, "0")}m`;
    return `${mins.toString()}m`;
};

/**
 * Count how many games happened in a segment with no derivable per-game
 * stats. Returns 0 for a no-game window (no stats moved), N>=1 for a segment
 * that covers N games we couldn't split (e.g. gamesPlayed jumped by 2).
 */
export const inferredGameCount = (seg: GameSegment): number => {
    let total = 0;
    for (const mode of GAMEMODES) {
        const delta = seg.end[mode].gamesPlayed - seg.start[mode].gamesPlayed;
        if (delta > 0) total += delta;
    }
    return total;
};

export const segmentDurationMs = (seg: GameSegment): number =>
    seg.end.queriedAt.getTime() - seg.start.queriedAt.getTime();

export const segmentExperience = (seg: GameSegment): number =>
    seg.end.experience - seg.start.experience;

/**
 * Best game = the single-game segment with the most final kills, breaking ties
 * first toward no final death, then toward no bed lost. Ambiguous segments
 * (no-game windows / multi-game gaps) are excluded.
 */
export const bestGame = (segments: readonly GameSegment[]): GameSegment | undefined => {
    const games = segments.filter(
        (seg): seg is GameSegment & { game: GameResult } => seg.game !== null,
    );
    const [best] = games.toSorted(
        (a, b) =>
            b.game.finalKills - a.game.finalKills ||
            Number(a.game.finalDeath) - Number(b.game.finalDeath) ||
            Number(a.game.bedLost) - Number(b.game.bedLost),
    );
    return best;
};

export const fastestWin = (
    segments: readonly GameSegment[],
): GameSegment | undefined => {
    let fastest: GameSegment | undefined;
    let fastestMs = Number.POSITIVE_INFINITY;
    for (const seg of segments) {
        if (seg.game === null || seg.game.outcome !== "win") continue;
        const ms = segmentDurationMs(seg);
        if (ms < fastestMs) {
            fastest = seg;
            fastestMs = ms;
        }
    }
    return fastest;
};

/**
 * Trailing streak of identical outcomes across single-game segments
 * (ambiguous segments break the streak — we don't know individual
 * outcomes). Returns null when no meaningful streak exists.
 */
export const trailingStreak = (
    segments: readonly GameSegment[],
): { length: number; outcome: GameOutcome } | null => {
    let length = 0;
    let outcome: GameOutcome | undefined;
    for (let i = segments.length - 1; i >= 0; i--) {
        const { game } = segments[i];
        if (game === null) break;
        if (outcome === undefined) {
            ({ outcome } = game);
            length = 1;
            continue;
        }
        if (game.outcome === outcome) {
            length++;
        } else {
            break;
        }
    }
    if (length < 2 || outcome === undefined) return null;
    return { length, outcome };
};
