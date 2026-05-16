import type { GameSegment, Gamemode } from "#queries/sessionAt.ts";
import type { Session } from "#queries/sessions.ts";
import { bedwarsLevelFromExp } from "#stats/stars.ts";

export const GAMEMODES: readonly Gamemode[] = ["solo", "doubles", "threes", "fours"];

const GAMEMODE_LABELS: Record<Gamemode, string> = {
    solo: "Solo",
    doubles: "Doubles",
    threes: "Threes",
    fours: "Fours",
};

export const gamemodeLabel = (mode: Gamemode): string => GAMEMODE_LABELS[mode];

/**
 * Hand-picked palette used by the session-detail page. The values are
 * tied to the design handoff rather than the MUI theme, so they live in
 * one place here and are reused everywhere on the page.
 */
export const DETAIL_PALETTE = {
    mode: {
        solo: "#a855f7",
        doubles: "#06b6d4",
        threes: "#22c55e",
        fours: "#f59e0b",
    },
    tag: {
        flawless: "#fbbf24",
        perfect: "#22c55e",
        heater: "#ef4444",
        cold: "#60a5fa",
        marathon: "#a855f7",
    },
    milestone: {
        prestige: "#a855f7",
        wins: "#22c55e",
        fkdr: "#06b6d4",
    },
    state: {
        good: "#4ade80",
        bad: "#f87171",
        neutral: "#9aa3b2",
        muted: "#9ca3af",
        mutedDark: "#6b7280",
    },
    accent: {
        purple: "#a855f7",
        cyan: "#06b6d4",
        green: "#22c55e",
        amber: "#fbbf24",
        red: "#ef4444",
        blue: "#64b5f6",
        teal: "#06b6d4",
    },
    chip: {
        liveText: "#4ade80",
        liveBg: "rgba(74,222,128,0.12)",
        starBg: "rgba(168,85,247,0.12)",
    },
    ribbon: "linear-gradient(90deg, #ef4444, #f59e0b, #eab308, #22c55e, #06b6d4, #6366f1, #a855f7)",
} as const;

export const MODE_COLORS: Record<Gamemode, string> = DETAIL_PALETTE.mode;

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

export const modeBreakdown = (
    session: Session,
): Record<Gamemode, { games: number; wins: number; losses: number; fkdr: number }> => {
    const out = {} as Record<
        Gamemode,
        { games: number; wins: number; losses: number; fkdr: number }
    >;
    for (const mode of GAMEMODES) {
        const first = session.start[mode];
        const last = session.end[mode];
        const games = last.gamesPlayed - first.gamesPlayed;
        const wins = last.wins - first.wins;
        const fk = last.finalKills - first.finalKills;
        const fd = last.finalDeaths - first.finalDeaths;
        out[mode] = {
            games,
            wins,
            losses: games - wins,
            fkdr: ratio(fk, fd),
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
 * derivable game (heartbeats / ambiguous jumps) still anchor a
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

export const formatClock = (date: Date): string => {
    const h = String(date.getHours()).padStart(2, "0");
    const m = String(date.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
};

const MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
];

export const formatDate = (date: Date): string => {
    return `${date.getDate().toString()} ${MONTHS[date.getMonth()]} ${date.getFullYear().toString()}`;
};

export interface SessionTag {
    readonly key: string;
    readonly label: string;
    readonly icon: string;
    readonly color: string;
    readonly tooltip: string;
}

export const computeTags = (agg: SessionAggregate): SessionTag[] => {
    const out: SessionTag[] = [];

    if (agg.games >= 2 && agg.losses === 0 && agg.fd === 0) {
        out.push({
            key: "flawless",
            label: "Flawless",
            icon: "verified",
            color: DETAIL_PALETTE.tag.flawless,
            tooltip: "No losses and no final deaths this session",
        });
    } else if (agg.games >= 3 && agg.losses === 0) {
        out.push({
            key: "perfect",
            label: "Perfect run",
            icon: "workspace_premium",
            color: DETAIL_PALETTE.tag.perfect,
            tooltip: "Won every game this session",
        });
    }

    if (agg.fkdr > agg.lifetimeFkdr * 1.4 && agg.fk >= 6) {
        out.push({
            key: "heater",
            label: "Heater",
            icon: "local_fire_department",
            color: DETAIL_PALETTE.tag.heater,
            tooltip: `${agg.fkdr.toFixed(1)} session FKDR vs ${agg.lifetimeFkdr.toFixed(1)} lifetime`,
        });
    } else if (agg.fkdr < agg.lifetimeFkdr * 0.6 && agg.games >= 3) {
        out.push({
            key: "slump",
            label: "Cold",
            icon: "ac_unit",
            color: DETAIL_PALETTE.tag.cold,
            tooltip: "Session FKDR well below lifetime",
        });
    }

    const hours = agg.elapsedMs / 3_600_000;
    if (hours >= 3) {
        out.push({
            key: "marathon",
            label: "Marathon",
            icon: "directions_run",
            color: DETAIL_PALETTE.tag.marathon,
            tooltip: `${hours.toFixed(1)} hours played`,
        });
    }

    return out;
};

const ROUND_UP_STEPS = [100, 250, 500, 1000, 2500, 5000, 10_000, 25_000];

/**
 * Round `n` up to the next "nice" milestone, and return both the
 * milestone and the step size that produced it. The step size is what
 * "progress towards the next milestone" should be measured against —
 * e.g. for n=4523 we land on 5000 with step 1000, so the player is
 * 477/1000 = 47.7% of the way from the previous milestone to the next.
 */
export const nextMilestone = (n: number): { target: number; step: number } => {
    for (const step of ROUND_UP_STEPS) {
        const next = Math.floor(n / step) * step + step;
        if (next - n <= step * 0.6) return { target: next, step };
    }
    const step = 10_000;
    return { target: Math.ceil(n / step) * step + step, step };
};

export interface Milestone {
    readonly key: "prestige" | "wins" | "fkdr";
    readonly label: string;
    readonly icon: string;
    readonly color: string;
    readonly current: number;
    readonly target: number;
    readonly format: (v: number) => string;
    readonly deltaFormat: () => string;
    readonly sessions: number;
    readonly progress: number;
    readonly blocked?: boolean;
    readonly blockedReason?: string;
}

export const computeMilestones = (
    session: Session,
    agg: SessionAggregate,
): Milestone[] => {
    const last = session.end;
    const currentStars = bedwarsLevelFromExp(last.experience);
    const nextPrestige = Math.floor(currentStars / 100) * 100 + 100;
    const starsToGo = nextPrestige - currentStars;
    const prestigeSessions =
        agg.stars > 0 ? starsToGo / agg.stars : Number.POSITIVE_INFINITY;

    const currentWins = last.overall.wins;
    const { target: nextWins, step: winsStep } = nextMilestone(currentWins);
    const winsToGo = nextWins - currentWins;
    const winsSessions = agg.wins > 0 ? winsToGo / agg.wins : Number.POSITIVE_INFINITY;

    const currentFKDR = ratio(last.overall.finalKills, last.overall.finalDeaths);
    const nextFKDR = Math.ceil(currentFKDR * 2 + 0.001) / 2;
    const lifetimeFK = last.overall.finalKills;
    const lifetimeFD = last.overall.finalDeaths;
    // Solve: (lifetimeFK + n*agg.fk) / (lifetimeFD + n*agg.fd) = nextFKDR
    // => n = (nextFKDR*lifetimeFD - lifetimeFK) / (agg.fk - nextFKDR*agg.fd)
    const fkdrDenom = agg.fk - nextFKDR * agg.fd;
    const fkdrSessions =
        fkdrDenom > 0
            ? (nextFKDR * lifetimeFD - lifetimeFK) / fkdrDenom
            : Number.POSITIVE_INFINITY;

    return [
        {
            key: "prestige",
            label: "Next prestige",
            icon: "auto_awesome",
            color: DETAIL_PALETTE.milestone.prestige,
            current: currentStars,
            target: nextPrestige,
            format: (v) => `✦${v.toFixed(0)}`,
            deltaFormat: () => `+${agg.stars.toFixed(2)}/session`,
            sessions: prestigeSessions,
            progress: 1 - starsToGo / 100,
        },
        {
            key: "wins",
            label: "Next wins milestone",
            icon: "emoji_events",
            color: DETAIL_PALETTE.milestone.wins,
            current: currentWins,
            target: nextWins,
            format: (v) => v.toLocaleString(),
            deltaFormat: () => `+${agg.wins.toString()}/session`,
            sessions: winsSessions,
            progress: 1 - winsToGo / winsStep,
        },
        {
            key: "fkdr",
            label: "Next FKDR milestone",
            icon: "trending_up",
            color: DETAIL_PALETTE.milestone.fkdr,
            current: currentFKDR,
            target: nextFKDR,
            format: (v) => v.toFixed(2),
            deltaFormat: () => `session: ${agg.fkdr.toFixed(2)}`,
            sessions: fkdrSessions,
            progress: (currentFKDR - (nextFKDR - 0.5)) / 0.5,
            blocked: fkdrDenom <= 0,
            blockedReason: "Session FKDR too low to reach this",
        },
    ];
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
 * stats. Returns 0 for a heartbeat (no stats moved), N>=1 for a segment
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

export const segmentXPGained = (seg: GameSegment): number =>
    seg.end.experience - seg.start.experience;

/**
 * Best game = the (single-game) segment with the highest final kills.
 * Skips ambiguous segments entirely.
 */
export const bestGame = (segments: readonly GameSegment[]): GameSegment | undefined => {
    let best: GameSegment | undefined;
    let bestKills = -1;
    for (const seg of segments) {
        if (seg.game === null) continue;
        if (seg.game.finalKills > bestKills) {
            best = seg;
            bestKills = seg.game.finalKills;
        }
    }
    return best;
};

export const fastestWin = (
    segments: readonly GameSegment[],
): GameSegment | undefined => {
    let fastest: GameSegment | undefined;
    let fastestMs = Number.POSITIVE_INFINITY;
    for (const seg of segments) {
        if (seg.game === null || !seg.game.won) continue;
        const ms = segmentDurationMs(seg);
        if (ms < fastestMs) {
            fastest = seg;
            fastestMs = ms;
        }
    }
    return fastest;
};

/**
 * Trailing streak across single-game segments (ambiguous segments break
 * the streak — we don't know individual W/L). Returns null when no
 * meaningful streak exists.
 */
export const trailingStreak = (
    segments: readonly GameSegment[],
): { length: number; won: boolean } | null => {
    let length = 0;
    let won: boolean | undefined;
    for (let i = segments.length - 1; i >= 0; i--) {
        const { game } = segments[i];
        if (game === null) break;
        if (won === undefined) {
            ({ won } = game);
            length = 1;
            continue;
        }
        if (game.won === won) {
            length++;
        } else {
            break;
        }
    }
    if (length < 2 || won === undefined) return null;
    return { length, won };
};
