import type { PlayerDataPIT, StatsPIT } from "#queries/playerdata.ts";
import type { Session } from "#queries/sessions.ts";
import { bedwarsLevelFromExp } from "#stats/stars.ts";

export type Gamemode = "solo" | "doubles" | "threes" | "fours";

const GAMEMODES: readonly Gamemode[] = ["solo", "doubles", "threes", "fours"];

const GAMEMODE_LABELS: Record<Gamemode, string> = {
    solo: "Solo",
    doubles: "Doubles",
    threes: "Threes",
    fours: "Fours",
};

export const gamemodeLabel = (g: Gamemode): string => GAMEMODE_LABELS[g];

export const MODE_COLORS: Record<Gamemode, string> = {
    solo: "#a855f7",
    doubles: "#06b6d4",
    threes: "#22c55e",
    fours: "#f59e0b",
};

const statKeys = [
    "gamesPlayed",
    "wins",
    "losses",
    "bedsBroken",
    "bedsLost",
    "finalKills",
    "finalDeaths",
    "kills",
    "deaths",
] as const;
type StatKey = (typeof statKeys)[number];

const diffStats = (a: StatsPIT, b: StatsPIT): Record<StatKey, number> => {
    const out = {} as Record<StatKey, number>;
    for (const k of statKeys) {
        out[k] = b[k] - a[k];
    }
    return out;
};

export interface Game {
    readonly index: number;
    readonly mode: Gamemode;
    readonly won: boolean;
    readonly fk: number;
    readonly fd: number;
    readonly bb: number;
    readonly bl: number;
    readonly k: number;
    readonly d: number;
    readonly xp: number;
    readonly endedAt: Date;
    readonly startedAt: Date;
    readonly durationMs: number;
}

/**
 * Derive per-game info by walking pairs of PIT snapshots and observing which
 * gamemode's `gamesPlayed` increased. Snapshots are assumed to be sorted by
 * `queriedAt` ascending.
 */
export const derivedGames = (history: readonly PlayerDataPIT[]): Game[] => {
    if (history.length < 2) return [];

    const games: Game[] = [];
    let index = 1;
    for (let i = 1; i < history.length; i++) {
        const prev = history[i - 1];
        const curr = history[i];

        let mode: Gamemode | null = null;
        for (const g of GAMEMODES) {
            if (curr[g].gamesPlayed > prev[g].gamesPlayed) {
                mode = g;
                break;
            }
        }
        if (mode === null) continue;

        const delta = diffStats(prev[mode], curr[mode]);
        if (delta.gamesPlayed <= 0) continue;

        games.push({
            index,
            mode,
            won: delta.wins > 0,
            fk: delta.finalKills,
            fd: delta.finalDeaths,
            bb: delta.bedsBroken,
            bl: delta.bedsLost,
            k: delta.kills,
            d: delta.deaths,
            xp: curr.experience - prev.experience,
            endedAt: curr.queriedAt,
            startedAt: prev.queriedAt,
            durationMs: curr.queriedAt.getTime() - prev.queriedAt.getTime(),
        });
        index++;
    }
    return games;
};

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
    const fkdr = fd === 0 ? fk : fk / fd;
    const lifetimeFkdr =
        first.finalDeaths === 0
            ? first.finalKills
            : first.finalKills / Math.max(1, first.finalDeaths);
    const winRate = games === 0 ? 0 : wins / games;
    const lifetimeWR = first.gamesPlayed === 0 ? 0 : first.wins / first.gamesPlayed;
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
        fkdr,
        lifetimeFkdr,
        winRate,
        lifetimeWR,
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
    for (const m of GAMEMODES) {
        const first = session.start[m];
        const last = session.end[m];
        const games = last.gamesPlayed - first.gamesPlayed;
        const wins = last.wins - first.wins;
        const fk = last.finalKills - first.finalKills;
        const fd = last.finalDeaths - first.finalDeaths;
        out[m] = {
            games,
            wins,
            losses: games - wins,
            fkdr: fd === 0 ? fk : fk / fd,
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
 * Compute cumulative session FKDR vs lifetime FKDR after each game.
 */
export const fkdrTrajectory = (
    session: Session,
    games: readonly Game[],
): TrajectoryPoint[] => {
    const baseFK = session.start.overall.finalKills;
    const baseFD = session.start.overall.finalDeaths;
    let cumFK = 0;
    let cumFD = 0;
    return games.map((g, i) => {
        cumFK += g.fk;
        cumFD += g.fd;
        const liveFK = baseFK + cumFK;
        const liveFD = baseFD + cumFD;
        return {
            x: i + 1,
            sessionFkdr: cumFD === 0 ? cumFK : cumFK / cumFD,
            lifetimeFkdr: liveFK / Math.max(1, liveFD),
        };
    });
};

export const formatDuration = (ms: number): string => {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) {
        return `${h.toString()}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
    }
    return `${m.toString()}m ${String(s).padStart(2, "0")}s`;
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
            color: "#fbbf24",
            tooltip: "No losses and no final deaths this session",
        });
    } else if (agg.games >= 3 && agg.losses === 0) {
        out.push({
            key: "perfect",
            label: "Perfect run",
            icon: "workspace_premium",
            color: "#22c55e",
            tooltip: "Won every game this session",
        });
    }

    if (agg.fkdr > agg.lifetimeFkdr * 1.4 && agg.fk >= 6) {
        out.push({
            key: "heater",
            label: "Heater",
            icon: "local_fire_department",
            color: "#ef4444",
            tooltip: `${agg.fkdr.toFixed(1)} session FKDR vs ${agg.lifetimeFkdr.toFixed(1)} lifetime`,
        });
    } else if (agg.fkdr < agg.lifetimeFkdr * 0.6 && agg.games >= 3) {
        out.push({
            key: "slump",
            label: "Cold",
            icon: "ac_unit",
            color: "#60a5fa",
            tooltip: "Session FKDR well below lifetime",
        });
    }

    const hours = agg.elapsedMs / 3_600_000;
    if (hours >= 3) {
        out.push({
            key: "marathon",
            label: "Marathon",
            icon: "directions_run",
            color: "#a855f7",
            tooltip: `${hours.toFixed(1)} hours played`,
        });
    }

    return out;
};

const roundUpNice = (n: number): number => {
    const steps = [100, 250, 500, 1000, 2500, 5000, 10_000, 25_000];
    for (const s of steps) {
        const next = Math.floor(n / s) * s + s;
        if (next - n <= s * 0.6) return next;
    }
    return Math.ceil(n / 10_000) * 10_000 + 10_000;
};

const niceStep = (n: number): number => {
    const target = roundUpNice(n);
    return target - Math.floor(n / 100) * 100;
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
    const nextWins = roundUpNice(currentWins);
    const winsToGo = nextWins - currentWins;
    const winsSessions = agg.wins > 0 ? winsToGo / agg.wins : Number.POSITIVE_INFINITY;

    const currentFKDR = last.overall.finalKills / Math.max(1, last.overall.finalDeaths);
    const nextFKDR = Math.ceil(currentFKDR * 2 + 0.001) / 2;
    const LFK = last.overall.finalKills;
    const LFD = last.overall.finalDeaths;
    const denom = agg.fk - nextFKDR * agg.fd;
    const fkdrSessions =
        denom > 0 ? (nextFKDR * LFD - LFK) / denom : Number.POSITIVE_INFINITY;

    return [
        {
            key: "prestige",
            label: "Next prestige",
            icon: "auto_awesome",
            color: "#a855f7",
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
            color: "#22c55e",
            current: currentWins,
            target: nextWins,
            format: (v) => v.toLocaleString(),
            deltaFormat: () => `+${agg.wins.toString()}/session`,
            sessions: winsSessions,
            progress: 1 - winsToGo / niceStep(currentWins),
        },
        {
            key: "fkdr",
            label: "Next FKDR milestone",
            icon: "trending_up",
            color: "#06b6d4",
            current: currentFKDR,
            target: nextFKDR,
            format: (v) => v.toFixed(2),
            deltaFormat: () => `session: ${agg.fkdr.toFixed(2)}`,
            sessions: fkdrSessions,
            progress: (currentFKDR - (nextFKDR - 0.5)) / 0.5,
            blocked: denom <= 0,
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
    if (hours > 0) {
        return `${hours.toString()}h ${String(mins).padStart(2, "0")}m`;
    }
    return `${mins.toString()}m`;
};
