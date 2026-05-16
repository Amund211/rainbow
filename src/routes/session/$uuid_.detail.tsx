import {
    AcUnit,
    ArrowRightAlt,
    AutoAwesome,
    Block,
    Bolt,
    Cloud,
    ContentCopy,
    DirectionsRun,
    EmojiEvents,
    Help,
    Info,
    IosShare,
    LocalFireDepartment,
    Schedule,
    Speed,
    SportsEsports,
    Star,
    StopCircle,
    TrendingFlat,
    TrendingUp,
    Verified,
    WorkspacePremium,
} from "@mui/icons-material";
import type { SvgIconComponent } from "@mui/icons-material";
import {
    Alert,
    Box,
    Button,
    Chip,
    LinearProgress,
    Skeleton,
    Snackbar,
    Stack,
    Tooltip,
    Typography,
    useTheme,
} from "@mui/material";
import { captureException } from "@sentry/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import React from "react";
import { z } from "zod";

import { PlayerHead } from "#components/player.tsx";
import type { Milestone, SessionTag } from "#helpers/sessionDetail.ts";
import {
    aggregate,
    bestGame,
    computeMilestones,
    computeTags,
    fastestWin,
    fkdrTrajectory,
    formatClock,
    formatDate,
    formatDuration,
    formatLong,
    gamemodeLabel,
    inferredGameCount,
    MODE_COLORS,
    modeBreakdown,
    segmentDurationMs,
    segmentXPGained,
    trailingStreak,
} from "#helpers/sessionDetail.ts";
import { normalizeUUID } from "#helpers/uuid.ts";
import type { GameSegment, SessionAt } from "#queries/sessionAt.ts";
import { getSessionAtQueryOptions } from "#queries/sessionAt.ts";
import { useUUIDToUsername } from "#queries/username.ts";
import { bedwarsLevelFromExp } from "#stats/stars.ts";

const detailSearchSchema = z.object({
    date: z.coerce.date(),
});

export const Route = createFileRoute("/session/$uuid_/detail")({
    validateSearch: detailSearchSchema,
    // oxlint-disable-next-line eslint/no-use-before-define
    component: RouteComponent,
});

const TAG_ICONS: Record<string, SvgIconComponent> = {
    verified: Verified,
    workspace_premium: WorkspacePremium,
    local_fire_department: LocalFireDepartment,
    ac_unit: AcUnit,
    directions_run: DirectionsRun,
};

const MILESTONE_ICONS: Record<Milestone["key"], SvgIconComponent> = {
    prestige: AutoAwesome,
    wins: EmojiEvents,
    fkdr: TrendingUp,
};

const Card: React.FC<{ children: React.ReactNode; sx?: object }> = ({
    children,
    sx,
}) => (
    <Box
        sx={{
            bgcolor: "background.paper",
            border: 1,
            borderColor: "divider",
            borderRadius: 1.5,
            p: 2.5,
            ...sx,
        }}
    >
        {children}
    </Box>
);

const Breadcrumbs: React.FC<{ username: string }> = ({ username }) => {
    const theme = useTheme();
    return (
        <Stack direction="row" alignItems="center" gap={1}>
            <Typography variant="body2" color="textSecondary">
                {username}
            </Typography>
            <Typography variant="body2" color="textDisabled">
                ›
            </Typography>
            <Typography variant="body2" color="textSecondary">
                Sessions
            </Typography>
            <Typography variant="body2" color="textDisabled">
                ›
            </Typography>
            <Typography variant="body2" sx={{ color: theme.palette.text.primary }}>
                Session detail
            </Typography>
        </Stack>
    );
};

const NoSession: React.FC<{ username: string }> = ({ username }) => (
    <Box
        sx={{
            borderRadius: 1.5,
            border: 1,
            borderColor: "divider",
            p: 4,
            textAlign: "center",
        }}
    >
        <Info color="info" fontSize="large" />
        <Typography variant="h6" sx={{ mt: 1 }}>
            No session yet
        </Typography>
        <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            {`${username} has no recorded session overlapping this date. Come back after they've played a game with the Prism Overlay running.`}
        </Typography>
    </Box>
);

const EndedBadge: React.FC = () => (
    <Chip
        icon={<StopCircle sx={{ fontSize: 12 }} />}
        label="ENDED"
        size="small"
        sx={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 1,
            color: "text.secondary",
            bgcolor: "action.hover",
        }}
    />
);

interface PlayerBannerProps {
    uuid: string;
    username: string;
    session: NonNullable<SessionAt["session"]>;
    agg: ReturnType<typeof aggregate>;
    onShare: () => void;
}

const PlayerBanner: React.FC<PlayerBannerProps> = ({
    uuid,
    username,
    session,
    agg,
    onShare,
}) => {
    const stars = Math.floor(bedwarsLevelFromExp(session.end.experience));
    const startedAt = session.start.queriedAt;
    const endedAt = session.end.queriedAt;
    return (
        <Box
            sx={{
                position: "relative",
                bgcolor: "background.paper",
                border: 1,
                borderColor: "divider",
                borderRadius: 1.5,
                p: 3,
                overflow: "hidden",
            }}
        >
            <Box
                sx={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background:
                        "linear-gradient(90deg, #ef4444, #f59e0b, #eab308, #22c55e, #06b6d4, #6366f1, #a855f7)",
                }}
            />
            <Stack
                direction={{ xs: "column", sm: "row" }}
                alignItems={{ xs: "stretch", sm: "center" }}
                gap={2}
            >
                <PlayerHead uuid={uuid} username={username} variant="face" width={64} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack
                        direction="row"
                        alignItems="center"
                        gap={1.5}
                        flexWrap="wrap"
                    >
                        <Chip
                            icon={<Star sx={{ color: "#a855f7" }} />}
                            label={stars}
                            size="small"
                            sx={{
                                color: "#a855f7",
                                bgcolor: "rgba(168,85,247,0.12)",
                                fontFamily: "monospace",
                            }}
                            title="Bedwars star (prestige level)"
                        />
                        <Typography variant="h5">{username}</Typography>
                        <EndedBadge />
                    </Stack>
                    <Stack
                        direction="row"
                        gap={3}
                        flexWrap="wrap"
                        sx={{ mt: 1 }}
                        color="text.secondary"
                    >
                        <Stack direction="row" alignItems="center" gap={0.5}>
                            <Schedule fontSize="small" />
                            <Typography variant="body2">
                                {`${formatDate(startedAt)} · ${formatClock(startedAt)}–${formatClock(endedAt)} · ${formatDuration(agg.elapsedMs)}`}
                            </Typography>
                        </Stack>
                        <Stack direction="row" alignItems="center" gap={0.5}>
                            <SportsEsports fontSize="small" />
                            <Typography variant="body2">
                                {`${agg.games.toString()} games`}
                            </Typography>
                        </Stack>
                    </Stack>
                </Box>
                <Button
                    variant="outlined"
                    startIcon={<IosShare />}
                    onClick={onShare}
                    sx={{ alignSelf: { xs: "flex-start", sm: "center" } }}
                >
                    Share
                </Button>
            </Stack>
        </Box>
    );
};

const TagsRow: React.FC<{ tags: readonly SessionTag[] }> = ({ tags }) => (
    <Stack direction="row" gap={1} flexWrap="wrap">
        {tags.map((tag) => {
            const Icon = TAG_ICONS[tag.icon];
            return (
                <Tooltip key={tag.key} title={tag.tooltip}>
                    <Chip
                        icon={
                            Icon === undefined ? undefined : (
                                <Icon sx={{ color: `${tag.color} !important` }} />
                            )
                        }
                        label={tag.label}
                        size="small"
                        sx={{
                            color: tag.color,
                            bgcolor: `${tag.color}14`,
                            border: 1,
                            borderColor: `${tag.color}55`,
                            fontWeight: 600,
                            letterSpacing: 0.3,
                        }}
                    />
                </Tooltip>
            );
        })}
    </Stack>
);

const DeltaTag: React.FC<{
    value: number;
    suffix?: string;
    goodIfPositive: boolean;
}> = ({ value, suffix = "", goodIfPositive }) => {
    const positive = value >= 0;
    const good = goodIfPositive ? positive : !positive;
    const color = good ? "#4ade80" : "#f87171";
    const sign = positive ? "+" : "";
    return (
        <Stack
            direction="row"
            alignItems="center"
            gap={0.5}
            component="span"
            sx={{ color }}
        >
            {positive ? (
                <TrendingUp sx={{ fontSize: 14 }} />
            ) : (
                <TrendingFlat sx={{ fontSize: 14 }} />
            )}
            <span>{`${sign}${value.toFixed(2)}${suffix} vs lifetime`}</span>
        </Stack>
    );
};

interface KpiCardProps {
    label: string;
    value: string;
    sub: React.ReactNode;
    accentColor?: string;
}

const KpiCard: React.FC<KpiCardProps> = ({ label, value, sub, accentColor }) => (
    <Card sx={{ p: 2 }}>
        <Typography
            variant="caption"
            sx={{
                color: "text.secondary",
                textTransform: "uppercase",
                letterSpacing: 0.8,
            }}
        >
            {label}
        </Typography>
        <Typography
            sx={{
                fontSize: 30,
                fontWeight: 400,
                lineHeight: 1,
                mt: 1,
                mb: 0.75,
                color: accentColor ?? "text.primary",
            }}
        >
            {value}
        </Typography>
        <Typography variant="body2" color="textSecondary" component="div">
            {sub}
        </Typography>
    </Card>
);

const KPIRow: React.FC<{ agg: ReturnType<typeof aggregate> }> = ({ agg }) => {
    const fkdrDelta = agg.fkdr - agg.lifetimeFkdr;
    const wrDelta = (agg.winRate - agg.lifetimeWR) * 100;
    return (
        <Box
            sx={{
                display: "grid",
                gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(4, 1fr)" },
                gap: 1.5,
            }}
        >
            <KpiCard
                label="Games"
                value={agg.games.toString()}
                sub={`${agg.wins.toString()}W · ${agg.losses.toString()}L`}
            />
            <KpiCard
                label="Win rate"
                value={`${Math.round(agg.winRate * 100).toString()}%`}
                sub={<DeltaTag value={wrDelta} suffix="%" goodIfPositive />}
                accentColor="#4ade80"
            />
            <KpiCard
                label="Session FKDR"
                value={agg.fkdr.toFixed(2)}
                sub={<DeltaTag value={fkdrDelta} goodIfPositive />}
                accentColor="#64b5f6"
            />
            <KpiCard
                label="Stars gained"
                value={`+${agg.stars.toFixed(2)}`}
                sub={`${(agg.xp / 1000).toFixed(1)}k XP`}
                accentColor="#a855f7"
            />
        </Box>
    );
};

const GameDetail: React.FC<{ segment: GameSegment; index: number }> = ({
    segment,
    index,
}) => {
    const xp = segmentXPGained(segment);
    let items: [string, string][];
    if (segment.game === null) {
        const count = inferredGameCount(segment);
        items =
            count === 0
                ? [
                      ["Status", "Heartbeat"],
                      ["Games", "0"],
                      ["XP", `+${xp.toLocaleString()}`],
                      [
                          "Span",
                          formatDuration(segmentDurationMs(segment)).replace(
                              / \d{2}s$/,
                              "",
                          ),
                      ],
                  ]
                : [
                      ["Status", "Multi-game"],
                      ["Games", count.toString()],
                      ["XP", `+${xp.toLocaleString()}`],
                      [
                          "Span",
                          formatDuration(segmentDurationMs(segment)).replace(
                              / \d{2}s$/,
                              "",
                          ),
                      ],
                  ];
    } else {
        const { game } = segment;
        items = [
            [
                "Finals",
                `${game.finalKills.toString()} / ${game.finalDeaths.toString()}`,
            ],
            ["Beds", `${game.bedsBroken.toString()} / ${game.bedsLost.toString()}`],
            ["Kills", `${game.kills.toString()} / ${game.deaths.toString()}`],
            ["XP", `+${game.xpGained.toLocaleString()}`],
        ];
    }
    return (
        <Box
            sx={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 1,
                mt: 1.75,
                pt: 1.75,
                borderTop: 1,
                borderColor: "divider",
            }}
        >
            <Box sx={{ gridColumn: "1 / -1", mb: 0.5 }}>
                <Typography
                    variant="caption"
                    color="textSecondary"
                    sx={{
                        textTransform: "uppercase",
                        letterSpacing: 0.6,
                        fontSize: 10,
                    }}
                >
                    {`Segment ${index.toString()}`}
                </Typography>
            </Box>
            {items.map(([k, v]) => (
                <Box key={k}>
                    <Typography
                        variant="caption"
                        color="textSecondary"
                        sx={{
                            textTransform: "uppercase",
                            letterSpacing: 0.6,
                            fontSize: 10,
                        }}
                    >
                        {k}
                    </Typography>
                    <Typography sx={{ fontFamily: "monospace", fontSize: 14, mt: 0.5 }}>
                        {v}
                    </Typography>
                </Box>
            ))}
        </Box>
    );
};

const GameTile: React.FC<{
    segment: GameSegment;
    index: number;
    active: boolean;
    onClick: () => void;
}> = ({ segment, index, active, onClick }) => {
    const { game } = segment;
    const durationMs = segmentDurationMs(segment);
    const mins = Math.max(1, Math.round(durationMs / 60_000));

    if (game === null) {
        const count = inferredGameCount(segment);
        const isHeartbeat = count === 0;
        const c = isHeartbeat ? "#6b7280" : "#9ca3af";
        return (
            <Button
                onClick={onClick}
                sx={{
                    p: 1,
                    borderRadius: 1.25,
                    bgcolor: active ? `${c}22` : "action.hover",
                    border: 1,
                    borderColor: active ? c : "divider",
                    borderStyle: "dashed",
                    color: "text.primary",
                    textTransform: "none",
                    textAlign: "left",
                    flexDirection: "column",
                    alignItems: "stretch",
                    position: "relative",
                    overflow: "hidden",
                    minWidth: 0,
                    ":hover": { bgcolor: `${c}11` },
                }}
                title={
                    isHeartbeat
                        ? "Heartbeat snapshot — no game played in this window"
                        : `${count.toString()} games — couldn't be split out individually`
                }
            >
                <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    sx={{ mb: 0.5 }}
                >
                    <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
                        {`#${index.toString()}`}
                    </Typography>
                    <Help sx={{ fontSize: 14, color: c }} />
                </Stack>
                <Typography sx={{ fontSize: 18, lineHeight: 1, fontWeight: 500 }}>
                    {isHeartbeat ? "—" : count.toString()}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                    {isHeartbeat ? "no game" : "games"}
                </Typography>
                <Stack direction="row" gap={0.75} sx={{ mt: 1, fontSize: 10 }}>
                    <Typography variant="caption" color="textSecondary">
                        ?
                    </Typography>
                    <Typography variant="caption" sx={{ ml: "auto" }}>
                        {`${mins.toString()}m`}
                    </Typography>
                </Stack>
            </Button>
        );
    }

    const c = game.won ? "#4ade80" : "#f87171";
    const fkdr =
        game.finalDeaths === 0 ? game.finalKills : game.finalKills / game.finalDeaths;
    return (
        <Button
            onClick={onClick}
            sx={{
                p: 1,
                borderRadius: 1.25,
                bgcolor: active ? `${c}22` : "action.hover",
                border: 1,
                borderColor: active ? c : "divider",
                color: "text.primary",
                textTransform: "none",
                textAlign: "left",
                flexDirection: "column",
                alignItems: "stretch",
                position: "relative",
                overflow: "hidden",
                minWidth: 0,
                ":hover": { bgcolor: `${c}11` },
            }}
        >
            <Box
                sx={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    bgcolor: c,
                }}
            />
            <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ mb: 0.5 }}
            >
                <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
                    {`G${index.toString()}`}
                </Typography>
                <Chip
                    size="small"
                    label={game.won ? "W" : "L"}
                    sx={{
                        height: 18,
                        fontSize: 10,
                        fontWeight: 600,
                        color: c,
                        bgcolor: `${c}1f`,
                    }}
                />
            </Stack>
            <Typography sx={{ fontSize: 18, lineHeight: 1, fontWeight: 500 }}>
                {fkdr.toFixed(1)}
            </Typography>
            <Typography variant="caption" color="textSecondary">
                FKDR
            </Typography>
            <Stack direction="row" gap={0.75} sx={{ mt: 1, fontSize: 10 }}>
                <Box sx={{ color: MODE_COLORS[game.gamemode] }}>●</Box>
                <Typography variant="caption">
                    {gamemodeLabel(game.gamemode).slice(0, 3)}
                </Typography>
                <Typography variant="caption" sx={{ ml: "auto" }}>
                    {`${mins.toString()}m`}
                </Typography>
            </Stack>
        </Button>
    );
};

const StreakIndicator: React.FC<{ segments: readonly GameSegment[] }> = ({
    segments,
}) => {
    const streak = trailingStreak(segments);
    if (streak === null) return null;
    const c = streak.won ? "#4ade80" : "#f87171";
    const Icon = streak.won ? LocalFireDepartment : Cloud;
    const label = `${streak.length.toString()} ${streak.won ? "win" : "loss"} streak`;
    return (
        <Stack
            direction="row"
            alignItems="center"
            gap={0.75}
            sx={{
                px: 1.25,
                py: 0.75,
                borderRadius: 0.75,
                bgcolor: `${c}14`,
                color: c,
            }}
        >
            <Icon fontSize="small" sx={{ color: c }} />
            <Typography variant="body2" sx={{ color: c, fontWeight: 600 }}>
                {label}
            </Typography>
        </Stack>
    );
};

const MomentumStrip: React.FC<{ segments: readonly GameSegment[] }> = ({
    segments,
}) => {
    const [focused, setFocused] = React.useState<number | null>(null);
    const focusedSegment = focused === null ? undefined : segments[focused];
    return (
        <Card>
            <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="baseline"
                sx={{ mb: 1.5 }}
            >
                <Box>
                    <Typography variant="subtitle1">Game-by-game</Typography>
                    <Typography variant="caption" color="textSecondary">
                        Click a tile to inspect. Dashed tiles are heartbeats or
                        multi-game gaps where individual games can&apos;t be attributed.
                    </Typography>
                </Box>
                <StreakIndicator segments={segments} />
            </Stack>
            <Box
                sx={{
                    display: "grid",
                    // Tiles share the row when there's room (1fr each), but
                    // never shrink below 100px — past that the container
                    // scrolls horizontally so long sessions stay legible
                    // instead of squishing every tile.
                    gridTemplateColumns: `repeat(${segments.length.toString()}, minmax(100px, 1fr))`,
                    gap: 1,
                    overflowX: "auto",
                    pb: 1,
                }}
            >
                {segments.map((seg, i) => (
                    <GameTile
                        key={seg.end.queriedAt.toISOString()}
                        segment={seg}
                        index={i + 1}
                        active={focused === i}
                        onClick={() => {
                            setFocused(focused === i ? null : i);
                        }}
                    />
                ))}
            </Box>
            {focusedSegment !== undefined && focused !== null && (
                <GameDetail segment={focusedSegment} index={focused + 1} />
            )}
        </Card>
    );
};

interface TrajectoryChartProps {
    session: NonNullable<SessionAt["session"]>;
    segments: readonly GameSegment[];
}

const TrajectoryChart: React.FC<TrajectoryChartProps> = ({ session, segments }) => {
    const theme = useTheme();
    const points = fkdrTrajectory(session, segments);

    if (points.length < 2) {
        return (
            <Card sx={{ height: "100%" }}>
                <Typography variant="subtitle1">FKDR trajectory</Typography>
                <Typography variant="caption" color="textSecondary">
                    Not enough games to draw a trajectory.
                </Typography>
            </Card>
        );
    }

    const W = 800;
    const H = 220;
    const padL = 44;
    const padR = 16;
    const padT = 16;
    const padB = 28;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;
    const allY = points.flatMap((p) => [p.sessionFkdr, p.lifetimeFkdr]);
    const yMax = Math.max(...allY, 0) * 1.15 || 1;
    const xScale = (x: number) =>
        padL + ((x - 1) / Math.max(1, points.length - 1)) * innerW;
    const yScale = (y: number) => padT + innerH - (y / yMax) * innerH;

    const sessionPath = points
        .map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(p.x)} ${yScale(p.sessionFkdr)}`)
        .join(" ");
    const lifetimePath = points
        .map(
            (p, i) => `${i === 0 ? "M" : "L"} ${xScale(p.x)} ${yScale(p.lifetimeFkdr)}`,
        )
        .join(" ");
    const [first] = points;
    const last = points.at(-1) ?? first;
    const areaPath = `${sessionPath} L ${xScale(last.x)} ${yScale(0)} L ${xScale(first.x)} ${yScale(0)} Z`;

    const yTicks = 4;
    const ticks = Array.from({ length: yTicks + 1 }, (_, i) => yMax * (i / yTicks));

    const primary = theme.palette.primary.main;
    const { divider } = theme.palette;
    const textMuted = theme.palette.text.disabled;

    return (
        <Card sx={{ height: "100%" }}>
            <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="baseline"
                sx={{ mb: 1.5 }}
                flexWrap="wrap"
                gap={1}
            >
                <Box>
                    <Typography variant="subtitle1">FKDR trajectory</Typography>
                    <Typography variant="caption" color="textSecondary">
                        Session FKDR after each game vs. all-time
                    </Typography>
                </Box>
                <Stack direction="row" gap={1.75}>
                    <Stack direction="row" alignItems="center" gap={0.75}>
                        <Box
                            sx={{
                                width: 18,
                                height: 2,
                                bgcolor: primary,
                                borderRadius: 1,
                            }}
                        />
                        <Typography variant="caption" color="textSecondary">
                            Session
                        </Typography>
                    </Stack>
                    <Stack direction="row" alignItems="center" gap={0.75}>
                        <Box
                            sx={{
                                width: 18,
                                borderTop: `2px dashed ${theme.palette.text.secondary}`,
                            }}
                        />
                        <Typography variant="caption" color="textSecondary">
                            Lifetime
                        </Typography>
                    </Stack>
                </Stack>
            </Stack>
            <svg
                viewBox={`0 0 ${W.toString()} ${H.toString()}`}
                style={{ width: "100%", height: "auto", display: "block" }}
            >
                <defs>
                    <linearGradient id="fkdrFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={primary} stopOpacity="0.32" />
                        <stop offset="100%" stopColor={primary} stopOpacity="0" />
                    </linearGradient>
                </defs>
                {ticks.map((v) => (
                    <g key={v}>
                        <line
                            x1={padL}
                            x2={W - padR}
                            y1={yScale(v)}
                            y2={yScale(v)}
                            stroke={divider}
                            strokeDasharray="2 4"
                        />
                        <text
                            x={padL - 8}
                            y={yScale(v) + 4}
                            textAnchor="end"
                            fill={textMuted}
                            fontSize="11"
                            fontFamily="monospace"
                        >
                            {v.toFixed(1)}
                        </text>
                    </g>
                ))}
                {points.map((p) => (
                    <text
                        key={p.x}
                        x={xScale(p.x)}
                        y={H - 8}
                        textAnchor="middle"
                        fill={textMuted}
                        fontSize="11"
                        fontFamily="monospace"
                    >
                        {`G${p.x.toString()}`}
                    </text>
                ))}
                <path d={areaPath} fill="url(#fkdrFill)" />
                <path
                    d={lifetimePath}
                    fill="none"
                    stroke={theme.palette.text.secondary}
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                />
                <path
                    d={sessionPath}
                    fill="none"
                    stroke={primary}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                {points.map((p) => (
                    <circle
                        key={p.x}
                        cx={xScale(p.x)}
                        cy={yScale(p.sessionFkdr)}
                        r="4"
                        fill={theme.palette.background.paper}
                        stroke={primary}
                        strokeWidth="2"
                    />
                ))}
            </svg>
        </Card>
    );
};

interface SessionMetaCardProps {
    session: NonNullable<SessionAt["session"]>;
    agg: ReturnType<typeof aggregate>;
}

const SessionMetaCard: React.FC<SessionMetaCardProps> = ({ session, agg }) => {
    const avgGameMs = agg.games > 0 ? agg.elapsedMs / agg.games : 0;
    const items: [string, string][] = [
        ["Started", formatClock(session.start.queriedAt)],
        ["Ended", formatClock(session.end.queriedAt)],
        [
            "Avg game",
            agg.games > 0 ? formatDuration(avgGameMs).replace(/ \d{2}s$/, "") : "—",
        ],
        ["Finals", `${agg.fk.toString()} / ${agg.fd.toString()}`],
        ["Beds", `${agg.bb.toString()} / ${agg.bl.toString()}`],
        ["XP", `+${agg.xp.toLocaleString()}`],
    ];
    return (
        <Card sx={{ height: "100%" }}>
            <Typography variant="subtitle1" sx={{ mb: 1.75 }}>
                Totals
            </Typography>
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 1.75,
                }}
            >
                {items.map(([k, v]) => (
                    <Box key={k}>
                        <Typography
                            variant="caption"
                            color="textSecondary"
                            sx={{ textTransform: "uppercase", letterSpacing: 0.6 }}
                        >
                            {k}
                        </Typography>
                        <Typography sx={{ fontFamily: "monospace", mt: 0.5 }}>
                            {v}
                        </Typography>
                    </Box>
                ))}
            </Box>
        </Card>
    );
};

const ModeBreakdown: React.FC<{
    session: NonNullable<SessionAt["session"]>;
}> = ({ session }) => {
    const data = modeBreakdown(session);
    const modes = ["solo", "doubles", "threes", "fours"] as const;
    return (
        <Card>
            <Typography variant="subtitle1" sx={{ mb: 1.75 }}>
                By gamemode
            </Typography>
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(4, 1fr)" },
                    gap: 1.25,
                }}
            >
                {modes.map((m) => {
                    const d = data[m];
                    const c = MODE_COLORS[m];
                    const winPct = d.games === 0 ? 0 : d.wins / d.games;
                    return (
                        <Box
                            key={m}
                            sx={{
                                bgcolor: "action.hover",
                                border: 1,
                                borderColor: "divider",
                                borderRadius: 1.25,
                                p: 1.75,
                                opacity: d.games === 0 ? 0.4 : 1,
                            }}
                        >
                            <Stack
                                direction="row"
                                alignItems="center"
                                gap={0.75}
                                sx={{ mb: 1.25 }}
                            >
                                <Box
                                    sx={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: 0.25,
                                        bgcolor: c,
                                    }}
                                />
                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                    {gamemodeLabel(m)}
                                </Typography>
                            </Stack>
                            <Typography sx={{ fontSize: 22, lineHeight: 1.1 }}>
                                {d.games.toString()}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                                {`games · ${d.wins.toString()}W`}
                            </Typography>
                            <LinearProgress
                                variant="determinate"
                                value={winPct * 100}
                                sx={{
                                    mt: 1.5,
                                    height: 4,
                                    borderRadius: 1,
                                    bgcolor: "divider",
                                    "& .MuiLinearProgress-bar": { bgcolor: c },
                                }}
                            />
                            <Stack
                                direction="row"
                                justifyContent="space-between"
                                sx={{ mt: 1 }}
                            >
                                <Typography variant="caption" color="textSecondary">
                                    FKDR
                                </Typography>
                                <Typography
                                    variant="caption"
                                    sx={{ fontFamily: "monospace" }}
                                >
                                    {d.fkdr.toFixed(2)}
                                </Typography>
                            </Stack>
                        </Box>
                    );
                })}
            </Box>
        </Card>
    );
};

interface MilestonesCardProps {
    milestones: readonly Milestone[];
    sessionMs: number;
}

const MilestonesCard: React.FC<MilestonesCardProps> = ({ milestones, sessionMs }) => (
    <Card>
        <Typography variant="subtitle1">Milestones</Typography>
        <Typography variant="caption" color="textSecondary" sx={{ mb: 1.75 }}>
            At this session&apos;s pace
        </Typography>
        <Box
            sx={{
                mt: 1.75,
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
                gap: 1.25,
            }}
        >
            {milestones.map((m) => {
                const Icon = MILESTONE_ICONS[m.key];
                const blocked = m.blocked === true;
                const reachable = Number.isFinite(m.sessions) && !blocked;
                const progress = Math.max(0, Math.min(1, m.progress));
                const totalMs = reachable ? m.sessions * sessionMs : 0;
                return (
                    <Box
                        key={m.key}
                        sx={{
                            bgcolor: "action.hover",
                            border: 1,
                            borderColor: "divider",
                            borderRadius: 1.25,
                            p: 2,
                            display: "flex",
                            flexDirection: "column",
                            gap: 1.25,
                        }}
                    >
                        <Stack direction="row" alignItems="center" gap={1}>
                            <Box
                                sx={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: 0.875,
                                    bgcolor: `${m.color}1f`,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <Icon sx={{ fontSize: 16, color: m.color }} />
                            </Box>
                            <Typography
                                variant="caption"
                                color="textSecondary"
                                sx={{ textTransform: "uppercase", letterSpacing: 0.6 }}
                            >
                                {m.label}
                            </Typography>
                        </Stack>
                        <Stack
                            direction="row"
                            alignItems="baseline"
                            gap={1}
                            sx={{ fontFamily: "monospace" }}
                        >
                            <Typography sx={{ fontSize: 18 }}>
                                {m.format(m.current)}
                            </Typography>
                            <ArrowRightAlt
                                sx={{ fontSize: 16, color: "text.disabled" }}
                            />
                            <Typography sx={{ fontSize: 18, color: m.color }}>
                                {m.format(m.target)}
                            </Typography>
                        </Stack>
                        <LinearProgress
                            variant="determinate"
                            value={progress * 100}
                            sx={{
                                height: 4,
                                borderRadius: 1,
                                bgcolor: "divider",
                                "& .MuiLinearProgress-bar": { bgcolor: m.color },
                            }}
                        />
                        {reachable ? (
                            <Box>
                                <Stack direction="row" alignItems="baseline" gap={0.75}>
                                    <Typography sx={{ fontSize: 26, lineHeight: 1 }}>
                                        {m.sessions < 1
                                            ? "This session"
                                            : Math.ceil(m.sessions).toString()}
                                    </Typography>
                                    {m.sessions >= 1 && (
                                        <Typography
                                            variant="caption"
                                            color="textSecondary"
                                        >
                                            {`session${Math.ceil(m.sessions) === 1 ? "" : "s"} like this`}
                                        </Typography>
                                    )}
                                </Stack>
                                {m.sessions >= 1 && (
                                    <Stack
                                        direction="row"
                                        gap={0.5}
                                        alignItems="center"
                                        sx={{ mt: 0.75 }}
                                    >
                                        <Schedule
                                            sx={{
                                                fontSize: 12,
                                                color: "text.disabled",
                                            }}
                                        />
                                        <Typography
                                            variant="caption"
                                            color="textSecondary"
                                            sx={{ fontFamily: "monospace" }}
                                        >
                                            {`≈ ${formatLong(totalMs)} of playtime`}
                                        </Typography>
                                    </Stack>
                                )}
                            </Box>
                        ) : (
                            <Stack
                                direction="row"
                                alignItems="center"
                                gap={0.75}
                                color="text.disabled"
                            >
                                <Block fontSize="small" />
                                <Typography variant="caption">
                                    {blocked
                                        ? (m.blockedReason ?? "")
                                        : "No progress this session"}
                                </Typography>
                            </Stack>
                        )}
                        <Typography
                            variant="caption"
                            color="textSecondary"
                            sx={{ fontFamily: "monospace" }}
                        >
                            {m.deltaFormat()}
                        </Typography>
                    </Box>
                );
            })}
        </Box>
    </Card>
);

interface HighlightItem {
    readonly id: string;
    readonly icon: SvgIconComponent;
    readonly color: string;
    readonly title: string;
    readonly value: string;
    readonly sub: string;
}

const HighlightsCard: React.FC<{
    agg: ReturnType<typeof aggregate>;
    segments: readonly GameSegment[];
}> = ({ agg, segments }) => {
    const best = bestGame(segments);
    const fastest = fastestWin(segments);
    const beatLifetime = agg.fkdr > agg.lifetimeFkdr;
    const hours = agg.elapsedMs / 3_600_000;

    const bestIndex = best === undefined ? -1 : segments.indexOf(best);
    const fastestIndex = fastest === undefined ? -1 : segments.indexOf(fastest);

    const items: readonly HighlightItem[] = [
        {
            id: "signature",
            icon: WorkspacePremium,
            color: "#fbbf24",
            title: "Signature game",
            value:
                best?.game === undefined || best.game === null
                    ? "—"
                    : `G${(bestIndex + 1).toString()} · ${best.game.finalKills.toString()} finals`,
            sub:
                best?.game === undefined || best.game === null
                    ? "No single-game segments"
                    : `${best.game.kills.toString()} kills · ${gamemodeLabel(best.game.gamemode)}`,
        },
        {
            id: "fastest",
            icon: Bolt,
            color: "#22c55e",
            title: "Fastest win",
            value:
                fastest === undefined
                    ? "—"
                    : `${Math.max(1, Math.round(segmentDurationMs(fastest) / 60_000)).toString()}m`,
            sub:
                fastest === undefined || fastest.game === null
                    ? "No wins yet"
                    : `Game ${(fastestIndex + 1).toString()} · ${gamemodeLabel(fastest.game.gamemode)}`,
        },
        {
            id: "vs-lifetime",
            icon: beatLifetime ? TrendingUp : TrendingFlat,
            color: beatLifetime ? "#06b6d4" : "#9aa3b2",
            title: beatLifetime ? "Beating lifetime" : "On par with lifetime",
            value: agg.fkdr.toFixed(2),
            sub: `vs ${agg.lifetimeFkdr.toFixed(2)} all-time`,
        },
        {
            id: "pace",
            icon: Speed,
            color: "#a855f7",
            title: "Pace",
            value: hours > 0 ? `${(agg.fk / hours).toFixed(1)} fk/hr` : "—",
            sub: hours > 0 ? `${(agg.games / hours).toFixed(1)} games/hr` : "",
        },
    ];

    return (
        <Card>
            <Typography variant="subtitle1" sx={{ mb: 1.75 }}>
                Highlights
            </Typography>
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(4, 1fr)" },
                    gap: 1.25,
                }}
            >
                {items.map((h) => (
                    <Box
                        key={h.id}
                        sx={{
                            bgcolor: "action.hover",
                            border: 1,
                            borderColor: "divider",
                            borderRadius: 1.25,
                            p: 1.75,
                            display: "flex",
                            flexDirection: "column",
                            gap: 0.75,
                        }}
                    >
                        <Box
                            sx={{
                                width: 32,
                                height: 32,
                                borderRadius: 1,
                                bgcolor: `${h.color}1f`,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                mb: 0.5,
                            }}
                        >
                            <h.icon sx={{ fontSize: 18, color: h.color }} />
                        </Box>
                        <Typography
                            variant="caption"
                            color="textSecondary"
                            sx={{ textTransform: "uppercase", letterSpacing: 0.6 }}
                        >
                            {h.title}
                        </Typography>
                        <Typography
                            sx={{ fontSize: 18, fontWeight: 500, lineHeight: 1.1 }}
                        >
                            {h.value}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                            {h.sub}
                        </Typography>
                    </Box>
                ))}
            </Box>
        </Card>
    );
};

interface SessionDetailProps {
    data: SessionAt;
    uuid: string;
    username: string | undefined;
    onShare: () => void;
}

const SessionDetail: React.FC<SessionDetailProps> = ({
    data,
    uuid,
    username,
    onShare,
}) => {
    if (data.session === null) return null;
    const { session, games } = data;
    const agg = aggregate(session);
    const tags = computeTags(agg);
    const milestones = computeMilestones(session, agg);

    const displayName = username ?? "Player";

    return (
        <Stack spacing={2}>
            <PlayerBanner
                uuid={uuid}
                username={displayName}
                session={session}
                agg={agg}
                onShare={onShare}
            />
            {tags.length > 0 && <TagsRow tags={tags} />}
            <KPIRow agg={agg} />
            {games.length > 0 && <MomentumStrip segments={games} />}
            <Stack
                direction={{ xs: "column", md: "row" }}
                gap={1.5}
                alignItems="stretch"
            >
                <Box sx={{ flex: 2, minWidth: 0 }}>
                    <TrajectoryChart session={session} segments={games} />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <SessionMetaCard session={session} agg={agg} />
                </Box>
            </Stack>
            <ModeBreakdown session={session} />
            <MilestonesCard milestones={milestones} sessionMs={agg.elapsedMs} />
            <HighlightsCard agg={agg} segments={games} />
        </Stack>
    );
};

function RouteComponent() {
    const { uuid: rawUUID } = Route.useParams();
    const { date } = Route.useSearch();
    const navigate = Route.useNavigate();
    const queryClient = useQueryClient();

    const uuid = normalizeUUID(rawUUID);

    const { data, isFetching, isError } = useQuery({
        ...getSessionAtQueryOptions({
            uuid: uuid ?? "",
            time: date,
        }),
        enabled: uuid !== null,
    });

    const uuidToUsername = useUUIDToUsername(uuid !== null ? [uuid] : []);
    const username = uuid !== null ? uuidToUsername[uuid] : undefined;

    const [snackbarOpen, setSnackbarOpen] = React.useState(false);

    // After data comes back, normalize the URL date to the start of the session.
    // Pre-populate the query cache for the canonical URL so the navigation
    // doesn't trigger a duplicate fetch with the new query key.
    const sessionStart = data?.session?.start.queriedAt;
    React.useEffect(() => {
        if (sessionStart === undefined) return;
        if (uuid === null) return;
        if (sessionStart.getTime() === date.getTime()) return;
        const run = async () => {
            try {
                queryClient.setQueryData(
                    getSessionAtQueryOptions({ uuid, time: sessionStart }).queryKey,
                    data,
                );
                await navigate({
                    replace: true,
                    search: (old) => ({ ...old, date: sessionStart }),
                });
            } catch (error: unknown) {
                captureException(error, {
                    tags: { param: "date" },
                    extra: { message: "Failed to normalize session detail URL" },
                });
            }
        };
        void run();
    }, [sessionStart, date, navigate, queryClient, uuid, data]);

    if (uuid === null) {
        return <Navigate to="/session" replace />;
    }

    if (uuid !== rawUUID) {
        return (
            <Navigate
                from="/session/$uuid/detail"
                to="/session/$uuid/detail"
                replace
                params={{ uuid }}
                search={(old) => ({ ...old, date })}
            />
        );
    }

    const handleShare = () => {
        const url = globalThis.location.href;
        const run = async () => {
            try {
                await navigator.clipboard.writeText(url);
                setSnackbarOpen(true);
            } catch (error: unknown) {
                captureException(error, {
                    extra: { message: "Failed to copy share link" },
                });
            }
        };
        void run();
    };

    return (
        <Stack spacing={2}>
            <meta
                name="description"
                content={`${username ?? "Player"}'s Bedwars session detail.`}
            />
            <Breadcrumbs username={username ?? rawUUID} />
            {isFetching && data === undefined && (
                <Skeleton variant="rounded" height={140} />
            )}
            {isError && !isFetching && (
                <Alert severity="error">Failed to load session.</Alert>
            )}
            {!isFetching && data !== undefined && data.session === null && (
                <NoSession username={username ?? rawUUID} />
            )}
            {data !== undefined && data.session !== null && (
                <SessionDetail
                    data={data}
                    uuid={uuid}
                    username={username}
                    onShare={handleShare}
                />
            )}
            <Snackbar
                open={snackbarOpen}
                autoHideDuration={2500}
                onClose={() => {
                    setSnackbarOpen(false);
                }}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
            >
                <Alert
                    severity="success"
                    variant="filled"
                    icon={<ContentCopy fontSize="small" />}
                    sx={{ width: "100%" }}
                >
                    Link copied!
                </Alert>
            </Snackbar>
        </Stack>
    );
}
