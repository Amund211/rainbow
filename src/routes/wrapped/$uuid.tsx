import { queryClient } from "#queryClient.ts";
import { getUsernameQueryOptions } from "#queries/username.ts";
import {
    getWrappedQueryOptions,
    type WrappedData,
    type BestSession,
} from "#queries/wrapped.ts";
import { useUUIDToUsername } from "#queries/username.ts";
import { computeStat } from "#stats/index.ts";
import {
    Avatar,
    Box,
    Card,
    CardContent,
    Chip,
    Divider,
    Fade,
    Grid,
    Grow,
    LinearProgress,
    Stack,
    Tooltip,
    Typography,
    Zoom,
    Alert,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import React, { type JSX } from "react";
import { usePlayerVisits } from "#contexts/PlayerVisits/hooks.ts";
import { normalizeUUID } from "#helpers/uuid.ts";
import { captureException } from "@sentry/react";
import { wrappedSearchSchema } from "#schemas/wrappedSearch.ts";
import { UserSearch } from "#components/UserSearch.tsx";
import {
    EmojiEvents,
    Star,
    TrendingUp,
    Celebration,
    Timer,
    LocalFireDepartment,
    Whatshot,
    EmojiEventsOutlined,
    Schedule,
    CalendarMonth,
    ShowChart,
    Warning,
    CheckCircle,
    Info,
} from "@mui/icons-material";

export const Route = createFileRoute("/wrapped/$uuid")({
    loaderDeps: ({ search: { year } }) => {
        return { year };
    },
    loader: ({ params: { uuid: rawUUID }, deps: { year } }) => {
        const uuid = normalizeUUID(rawUUID);
        if (!uuid) return;

        Promise.all([
            queryClient.fetchQuery(getWrappedQueryOptions({ uuid, year })),
            queryClient.fetchQuery(getUsernameQueryOptions(uuid)),
        ]).catch((error: unknown) => {
            captureException(error, {
                extra: {
                    uuid,
                    year,
                    message: "Failed to fetch wrapped + username data",
                },
            });
        });
    },
    validateSearch: wrappedSearchSchema,
    component: RouteComponent,
});

interface StatCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    icon?: JSX.Element;
    color?: string;
    delay?: number;
}

const StatCard: React.FC<StatCardProps> = ({
    title,
    value,
    subtitle,
    icon,
    color = "primary.main",
    delay = 0,
}) => {
    return (
        <Grow in timeout={1000} style={{ transformOrigin: "0 0 0" }}>
            <Card
                variant="outlined"
                sx={{
                    height: "100%",
                    background: `linear-gradient(135deg, ${color}22 0%, ${color}11 100%)`,
                    border: `2px solid ${color}`,
                    transition: "all 0.3s ease",
                    "&:hover": {
                        transform: "translateY(-8px) scale(1.02)",
                        boxShadow: `0 8px 24px ${color}44`,
                    },
                }}
            >
                <CardContent>
                    <Stack gap={1} alignItems="center" justifyContent="center">
                        {icon && (
                            <Zoom
                                in
                                timeout={1000}
                                style={{
                                    transitionDelay: `${delay.toString()}ms`,
                                }}
                            >
                                <Box sx={{ color }}>{icon}</Box>
                            </Zoom>
                        )}
                        <Typography
                            variant="subtitle2"
                            color="textSecondary"
                            textAlign="center"
                        >
                            {title}
                        </Typography>
                        <Typography
                            variant="h4"
                            fontWeight="bold"
                            textAlign="center"
                            sx={{
                                background: `linear-gradient(45deg, ${color}, ${color}dd)`,
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                            }}
                        >
                            {value}
                        </Typography>
                        {subtitle && (
                            <Typography
                                variant="caption"
                                color="textSecondary"
                                textAlign="center"
                            >
                                {subtitle}
                            </Typography>
                        )}
                    </Stack>
                </CardContent>
            </Card>
        </Grow>
    );
};

const formatHours = (hours: number): string => {
    if (hours < 1) {
        const minutes = Math.round(hours * 60);
        return `${minutes.toString()}m`;
    }
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    if (minutes === 0) {
        return `${wholeHours.toString()}h`;
    }
    return `${wholeHours.toString()}h ${minutes.toString()}m`;
};

// Confetti configuration
const CONFETTI_DURATION_SECONDS = 5;

// Confetti effect component
const ConfettiEffect: React.FC = () => {
    const [confetti, setConfetti] = React.useState<
        {
            id: number;
            left: number;
            delay: number;
            duration: number;
            hue: number;
            rotation: number;
        }[]
    >([]);
    const [showConfetti, setShowConfetti] = React.useState(true);

    React.useEffect(() => {
        const pieces = Array.from({ length: 50 }, (_, i) => ({
            id: i,
            left: Math.random() * 100,
            delay: Math.random() * 2,
            duration: 3 + Math.random() * 2,
            hue: Math.random() * 360,
            rotation: 360 + Math.random() * 360,
        }));
        setConfetti(pieces);

        // Stop confetti after configured duration
        const timer = setTimeout(() => {
            setShowConfetti(false);
        }, CONFETTI_DURATION_SECONDS * 1000);

        return () => {
            clearTimeout(timer);
        };
    }, []);

    if (!showConfetti) return null;

    return (
        <Box
            sx={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
                zIndex: 9999,
                overflow: "hidden",
            }}
        >
            {confetti.map((piece) => (
                <Box
                    key={piece.id}
                    sx={{
                        position: "absolute",
                        top: "-10px",
                        left: `${piece.left.toString()}%`,
                        width: "10px",
                        height: "10px",
                        backgroundColor: `hsl(${piece.hue.toString()}, 70%, 60%)`,
                        animation: `fall ${piece.duration.toString()}s linear ${piece.delay.toString()}s infinite`,
                        "@keyframes fall": {
                            "0%": {
                                transform: "translateY(0) rotate(0deg)",
                                opacity: 1,
                            },
                            "100%": {
                                transform: `translateY(100vh) rotate(${piece.rotation.toString()}deg)`,
                                opacity: 0,
                            },
                        },
                    }}
                />
            ))}
        </Box>
    );
};

interface BestSessionCardProps {
    title: string;
    icon: JSX.Element;
    session: BestSession | undefined;
    statLabel: string;
    color: string;
    showDuration?: boolean;
}

const BestSessionCard: React.FC<BestSessionCardProps> = ({
    title,
    icon,
    session,
    statLabel,
    color,
    showDuration = true,
}) => {
    if (!session) return null;

    const startDate = new Date(session.start);
    return (
        <Grow in timeout={1500}>
            <Card
                variant="outlined"
                sx={{
                    background: `linear-gradient(135deg, ${color}22 0%, ${color}11 100%)`,
                    border: `2px solid ${color}`,
                }}
            >
                <CardContent>
                    <Stack gap={2}>
                        <Stack
                            direction="row"
                            gap={1}
                            alignItems="center"
                            justifyContent="center"
                        >
                            <Box sx={{ color, fontSize: 32 }}>{icon}</Box>
                            <Typography variant="h6" fontWeight="bold">
                                {title}
                            </Typography>
                        </Stack>
                        <Typography
                            variant="body2"
                            textAlign="center"
                            color="textSecondary"
                        >
                            {startDate.toLocaleDateString(undefined, {
                                month: "long",
                                day: "numeric",
                                year: "numeric",
                            })}
                        </Typography>
                        <Typography
                            variant="h4"
                            textAlign="center"
                            fontWeight="bold"
                        >
                            {session.value.toLocaleString(undefined, {
                                maximumFractionDigits: 2,
                            })}{" "}
                            {statLabel}
                        </Typography>
                        <Stack
                            direction="row"
                            gap={2}
                            justifyContent="center"
                            flexWrap="wrap"
                        >
                            <Typography variant="caption" color="textSecondary">
                                {session.stats.gamesPlayed.toString()} games
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                                {session.stats.wins.toString()} wins
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                                {session.stats.finalKills.toString()} finals
                            </Typography>
                            {showDuration && (
                                <Typography
                                    variant="caption"
                                    color="textSecondary"
                                >
                                    {formatHours(session.durationHours)}
                                </Typography>
                            )}
                        </Stack>
                    </Stack>
                </CardContent>
            </Card>
        </Grow>
    );
};

// Session Overview Component
interface SessionOverviewProps {
    wrappedData: WrappedData;
}

const SessionOverview: React.FC<SessionOverviewProps> = ({ wrappedData }) => {
    if (!wrappedData.sessionLengths || !wrappedData.sessionsPerMonth) {
        return null;
    }

    return (
        <Fade in timeout={1000}>
            <Card variant="outlined">
                <CardContent>
                    <Stack gap={2}>
                        <Stack direction="row" alignItems="center" gap={1}>
                            <Schedule color="primary" />
                            <Typography variant="h6">
                                Session Overview
                            </Typography>
                        </Stack>
                        <Grid container spacing={2}>
                            <Grid size={{ xs: 6, sm: 3 }}>
                                <Stack alignItems="center">
                                    <Typography variant="h4" color="primary">
                                        {wrappedData.totalSessions.toString()}
                                    </Typography>
                                    <Typography
                                        variant="caption"
                                        color="textSecondary"
                                    >
                                        Total Sessions
                                    </Typography>
                                </Stack>
                            </Grid>
                            {wrappedData.nonConsecutiveSessions > 0 && (
                                <Grid size={{ xs: 6, sm: 3 }}>
                                    <Tooltip title="These sessions had gaps in tracking and were excluded">
                                        <Stack alignItems="center">
                                            <Typography
                                                variant="h4"
                                                color="warning.main"
                                            >
                                                {wrappedData.nonConsecutiveSessions.toString()}
                                            </Typography>
                                            <Typography
                                                variant="caption"
                                                color="textSecondary"
                                            >
                                                Filtered Out
                                            </Typography>
                                        </Stack>
                                    </Tooltip>
                                </Grid>
                            )}
                            <Grid size={{ xs: 6, sm: 3 }}>
                                <Stack alignItems="center">
                                    <Typography
                                        variant="h4"
                                        color="success.main"
                                    >
                                        {formatHours(
                                            wrappedData.sessionLengths
                                                .totalHours,
                                        )}
                                    </Typography>
                                    <Typography
                                        variant="caption"
                                        color="textSecondary"
                                    >
                                        Total Time
                                    </Typography>
                                </Stack>
                            </Grid>
                            <Grid size={{ xs: 6, sm: 3 }}>
                                <Stack alignItems="center">
                                    <Typography variant="h4" color="info.main">
                                        {formatHours(
                                            wrappedData.sessionLengths
                                                .averageHours,
                                        )}
                                    </Typography>
                                    <Typography
                                        variant="caption"
                                        color="textSecondary"
                                    >
                                        Avg Session
                                    </Typography>
                                </Stack>
                            </Grid>
                        </Grid>

                        <Divider />

                        <Typography variant="subtitle2">
                            Sessions per Month
                        </Typography>
                        <Grid container spacing={1}>
                            {[
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
                            ].map((month, index) => {
                                const count =
                                    wrappedData.sessionsPerMonth?.[
                                        (index + 1).toString()
                                    ] ?? 0;
                                return (
                                    <Grid
                                        size={{
                                            xs: 3,
                                            sm: 2,
                                            md: 1,
                                        }}
                                        key={month}
                                    >
                                        <Tooltip
                                            title={`${count.toString()} sessions`}
                                        >
                                            <Stack
                                                alignItems="center"
                                                gap={0.5}
                                            >
                                                <Typography
                                                    variant="caption"
                                                    color="textSecondary"
                                                >
                                                    {month}
                                                </Typography>
                                                <Chip
                                                    label={count.toString()}
                                                    size="small"
                                                    color={
                                                        count > 0
                                                            ? "primary"
                                                            : "default"
                                                    }
                                                />
                                            </Stack>
                                        </Tooltip>
                                    </Grid>
                                );
                            })}
                        </Grid>

                        {/* Bar chart for sessions per month */}
                        <Box sx={{ mt: 2, mb: 1 }}>
                            <Grid container spacing={1}>
                                {[
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
                                ].map((month, index) => {
                                    const count =
                                        wrappedData.sessionsPerMonth?.[
                                            (index + 1).toString()
                                        ] ?? 0;
                                    const maxCount = Math.max(
                                        ...Object.values(
                                            wrappedData.sessionsPerMonth ?? {},
                                        ),
                                        1,
                                    );
                                    const heightPercent =
                                        (count / maxCount) * 100;
                                    return (
                                        <Grid
                                            size={{
                                                xs: 3,
                                                sm: 2,
                                                md: 1,
                                            }}
                                            key={`bar-${month}`}
                                        >
                                            <Tooltip
                                                title={`${count.toString()} sessions`}
                                            >
                                                <Box
                                                    sx={{
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        alignItems: "center",
                                                        height: 60,
                                                        justifyContent:
                                                            "flex-end",
                                                    }}
                                                >
                                                    <Box
                                                        sx={{
                                                            width: "100%",
                                                            height: `${heightPercent.toString()}%`,
                                                            bgcolor:
                                                                count > 0
                                                                    ? "primary.main"
                                                                    : "action.disabled",
                                                            borderRadius:
                                                                "4px 4px 0 0",
                                                            minHeight:
                                                                count > 0
                                                                    ? "4px"
                                                                    : "2px",
                                                        }}
                                                    />
                                                </Box>
                                            </Tooltip>
                                        </Grid>
                                    );
                                })}
                            </Grid>
                        </Box>
                    </Stack>
                </CardContent>
            </Card>
        </Fade>
    );
};

// Year Stats Cards Component
interface YearStatsCardsProps {
    wrappedData: WrappedData;
    totalGames: number | null;
    totalWins: number | null;
    totalFinalKills: number | null;
    totalBedsBroken: number | null;
    startFKDR: number | null;
    endFKDR: number | null;
    starsEnd: number | null;
    starsGained: number | null;
    winRate: number;
}

const YearStatsCards: React.FC<YearStatsCardsProps> = ({
    wrappedData,
    totalGames,
    totalWins,
    totalFinalKills,
    totalBedsBroken,
    startFKDR,
    endFKDR,
    starsGained,
    starsEnd,
    winRate,
}) => {
    return (
        <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <StatCard
                    title="Games Played"
                    value={(totalGames ?? 0).toLocaleString()}
                    subtitle={
                        wrappedData.sessionCoverage
                            ? `${wrappedData.sessionCoverage.gamesPlayedPercentage.toFixed(1)}% in sessions`
                            : undefined
                    }
                    icon={<EmojiEvents sx={{ fontSize: 48 }} />}
                    color="#FF6B6B"
                    delay={100}
                />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <StatCard
                    title="Wins"
                    value={(totalWins ?? 0).toLocaleString()}
                    subtitle={`${winRate.toFixed(1)}% win rate`}
                    icon={<Star sx={{ fontSize: 48 }} />}
                    color="#4ECDC4"
                    delay={200}
                />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <StatCard
                    title="Final Kills"
                    value={(totalFinalKills ?? 0).toLocaleString()}
                    subtitle="enemies eliminated"
                    icon={<Whatshot sx={{ fontSize: 48 }} />}
                    color="#FFD93D"
                    delay={300}
                />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <StatCard
                    title="Beds Broken"
                    value={(totalBedsBroken ?? 0).toLocaleString()}
                    subtitle="beds destroyed"
                    icon={<Celebration sx={{ fontSize: 48 }} />}
                    color="#95E1D3"
                    delay={400}
                />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <StatCard
                    title="FKDR"
                    value={(endFKDR ?? 0).toFixed(2)}
                    subtitle={
                        startFKDR && endFKDR
                            ? (endFKDR - startFKDR).toLocaleString(undefined, {
                                  signDisplay: "always",
                                  maximumFractionDigits: 2,
                              })
                            : undefined
                    }
                    icon={<TrendingUp sx={{ fontSize: 48 }} />}
                    color="#A8E6CF"
                    delay={500}
                />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <StatCard
                    title="Stars Gained"
                    value={
                        starsGained ? `+${starsGained.toLocaleString()}` : "0"
                    }
                    subtitle={
                        starsEnd
                            ? `now at ${starsEnd.toLocaleString()} ⭐`
                            : undefined
                    }
                    icon={<Star sx={{ fontSize: 48 }} />}
                    color="#FFB6D9"
                    delay={600}
                />
            </Grid>
        </Grid>
    );
};

// Average Session Stats Component
interface AverageSessionStatsProps {
    wrappedData: WrappedData;
}

const AverageSessionStats: React.FC<AverageSessionStatsProps> = ({
    wrappedData,
}) => {
    if (!wrappedData.averages) return null;

    return (
        <Fade in timeout={1200}>
            <Card variant="outlined">
                <CardContent>
                    <Stack gap={2}>
                        <Stack direction="row" alignItems="center" gap={1}>
                            <ShowChart color="primary" />
                            <Typography variant="h6">
                                Average Session Stats
                            </Typography>
                        </Stack>
                        <Grid container spacing={2}>
                            <Grid size={{ xs: 6, sm: 3 }}>
                                <Stack alignItems="center">
                                    <Typography variant="h5" color="primary">
                                        {wrappedData.averages.gamesPlayed.toFixed(
                                            1,
                                        )}
                                    </Typography>
                                    <Typography
                                        variant="caption"
                                        color="textSecondary"
                                    >
                                        Games/Session
                                    </Typography>
                                </Stack>
                            </Grid>
                            <Grid size={{ xs: 6, sm: 3 }}>
                                <Stack alignItems="center">
                                    <Typography
                                        variant="h5"
                                        color="success.main"
                                    >
                                        {wrappedData.averages.wins.toFixed(1)}
                                    </Typography>
                                    <Typography
                                        variant="caption"
                                        color="textSecondary"
                                    >
                                        Wins/Session
                                    </Typography>
                                </Stack>
                            </Grid>
                            <Grid size={{ xs: 6, sm: 3 }}>
                                <Stack alignItems="center">
                                    <Typography
                                        variant="h5"
                                        color="warning.main"
                                    >
                                        {wrappedData.averages.finalKills.toFixed(
                                            1,
                                        )}
                                    </Typography>
                                    <Typography
                                        variant="caption"
                                        color="textSecondary"
                                    >
                                        Finals/Session
                                    </Typography>
                                </Stack>
                            </Grid>
                            <Grid size={{ xs: 6, sm: 3 }}>
                                <Stack alignItems="center">
                                    <Typography variant="h5" color="info.main">
                                        {formatHours(
                                            wrappedData.averages
                                                .sessionLengthHours,
                                        )}
                                    </Typography>
                                    <Typography
                                        variant="caption"
                                        color="textSecondary"
                                    >
                                        Avg Length
                                    </Typography>
                                </Stack>
                            </Grid>
                        </Grid>
                    </Stack>
                </CardContent>
            </Card>
        </Fade>
    );
};

// Best Sessions Component
interface BestSessionsProps {
    wrappedData: WrappedData;
}

const BestSessions: React.FC<BestSessionsProps> = ({ wrappedData }) => {
    if (!wrappedData.bestSessions) return null;

    return (
        <>
            <Typography variant="h5" fontWeight="bold" sx={{ mt: 3 }}>
                🏆 Best Sessions
            </Typography>

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                    <BestSessionCard
                        title="Highest FKDR"
                        icon={<TrendingUp />}
                        session={wrappedData.bestSessions.highestFKDR}
                        statLabel="FKDR"
                        color="#667eea"
                    />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <BestSessionCard
                        title="Most Kills"
                        icon={<LocalFireDepartment />}
                        session={wrappedData.bestSessions.mostKills}
                        statLabel="Kills"
                        color="#f093fb"
                    />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <BestSessionCard
                        title="Most Final Kills"
                        icon={<Whatshot />}
                        session={wrappedData.bestSessions.mostFinalKills}
                        statLabel="Final Kills"
                        color="#FFD93D"
                    />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <BestSessionCard
                        title="Most Wins"
                        icon={<EmojiEventsOutlined />}
                        session={wrappedData.bestSessions.mostWins}
                        statLabel="Wins"
                        color="#4ECDC4"
                    />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <BestSessionCard
                        title="Longest Session"
                        icon={<Timer />}
                        session={wrappedData.bestSessions.longestSession}
                        statLabel="hours"
                        color="#A8E6CF"
                        showDuration={false}
                    />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <BestSessionCard
                        title="Most Wins/Hour"
                        icon={<TrendingUp />}
                        session={wrappedData.bestSessions.mostWinsPerHour}
                        statLabel="wins/hr"
                        color="#95E1D3"
                    />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <BestSessionCard
                        title="Most Finals/Hour"
                        icon={<Whatshot />}
                        session={wrappedData.bestSessions.mostFinalsPerHour}
                        statLabel="finals/hr"
                        color="#FF6B6B"
                    />
                </Grid>
            </Grid>
        </>
    );
};

// Streaks Component
interface StreaksProps {
    wrappedData: WrappedData;
}

const Streaks: React.FC<StreaksProps> = ({ wrappedData }) => {
    if (!wrappedData.winstreaks || !wrappedData.finalKillStreaks) return null;

    return (
        <>
            <Typography variant="h5" fontWeight="bold" sx={{ mt: 3 }}>
                🔥 Streaks
            </Typography>

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                    <Fade in timeout={1400}>
                        <Card variant="outlined">
                            <CardContent>
                                <Stack gap={2}>
                                    <Typography variant="h6" textAlign="center">
                                        Highest Winstreaks
                                    </Typography>
                                    <Divider />
                                    {Object.entries(wrappedData.winstreaks).map(
                                        ([mode, streak]) => (
                                            <Stack
                                                key={mode}
                                                direction="row"
                                                justifyContent="space-between"
                                                alignItems="center"
                                            >
                                                <Typography
                                                    variant="body2"
                                                    sx={{
                                                        textTransform:
                                                            "capitalize",
                                                    }}
                                                >
                                                    {mode}
                                                </Typography>
                                                <Stack alignItems="flex-end">
                                                    <Typography
                                                        variant="h6"
                                                        color="primary.main"
                                                    >
                                                        {streak.highest.toString()}
                                                    </Typography>
                                                    <Typography
                                                        variant="caption"
                                                        color="textSecondary"
                                                    >
                                                        {new Date(
                                                            streak.when,
                                                        ).toLocaleDateString(
                                                            undefined,
                                                            {
                                                                month: "short",
                                                                day: "numeric",
                                                            },
                                                        )}
                                                    </Typography>
                                                </Stack>
                                            </Stack>
                                        ),
                                    )}
                                </Stack>
                            </CardContent>
                        </Card>
                    </Fade>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                    <Fade in timeout={1400}>
                        <Card variant="outlined">
                            <CardContent>
                                <Stack gap={2}>
                                    <Typography variant="h6" textAlign="center">
                                        Highest Final Kill Streaks
                                    </Typography>
                                    <Divider />
                                    {Object.entries(
                                        wrappedData.finalKillStreaks,
                                    ).map(([mode, streak]) => (
                                        <Stack
                                            key={mode}
                                            direction="row"
                                            justifyContent="space-between"
                                            alignItems="center"
                                        >
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    textTransform: "capitalize",
                                                }}
                                            >
                                                {mode}
                                            </Typography>
                                            <Stack alignItems="flex-end">
                                                <Typography
                                                    variant="h6"
                                                    color="error.main"
                                                >
                                                    {streak.highest.toString()}
                                                </Typography>
                                                <Typography
                                                    variant="caption"
                                                    color="textSecondary"
                                                >
                                                    {new Date(
                                                        streak.when,
                                                    ).toLocaleDateString(
                                                        undefined,
                                                        {
                                                            month: "short",
                                                            day: "numeric",
                                                        },
                                                    )}
                                                </Typography>
                                            </Stack>
                                        </Stack>
                                    ))}
                                </Stack>
                            </CardContent>
                        </Card>
                    </Fade>
                </Grid>
            </Grid>
        </>
    );
};

// Favorite Play Times Component
// Favorite Play Times Component
interface FavoritePlayTimesProps {
    wrappedData: WrappedData;
}

const FavoritePlayTimes: React.FC<FavoritePlayTimesProps> = ({
    wrappedData,
}) => {
    if (!wrappedData.playtimeDistribution) return null;

    // Helper function to convert UTC day/hour to local day/hour
    const utcToLocalDayHour = (
        utcDay: string,
        utcHour: number,
    ): { day: string; hour: number } => {
        // Map weekday names to numbers (Sunday = 0, Monday = 1, etc.)
        const dayMap: Record<string, number> = {
            Sunday: 0,
            Monday: 1,
            Tuesday: 2,
            Wednesday: 3,
            Thursday: 4,
            Friday: 5,
            Saturday: 6,
        };

        // Create a date for the given UTC day and hour
        const now = new Date();
        const utcDayNum = dayMap[utcDay];

        // Find next occurrence of this weekday
        const daysUntilTarget = (utcDayNum - now.getUTCDay() + 7) % 7;
        const targetDate = new Date(now);
        targetDate.setUTCDate(now.getUTCDate() + daysUntilTarget);
        targetDate.setUTCHours(utcHour, 0, 0, 0);

        // Get local day and hour
        const localDayNum = targetDate.getDay();
        const localHour = targetDate.getHours();
        const dayNames = [
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
        ];

        return {
            day: dayNames[localDayNum],
            hour: localHour,
        };
    };

    // Convert UTC day/hour distribution to local day/hour distribution
    const getLocalDayHourDistribution = (): Record<string, number[]> => {
        if (!wrappedData.playtimeDistribution?.dayHourDistribution) {
            return {};
        }

        const localDistribution: Record<string, number[]> = {
            Sunday: Array.from({ length: 24 }, () => 0),
            Monday: Array.from({ length: 24 }, () => 0),
            Tuesday: Array.from({ length: 24 }, () => 0),
            Wednesday: Array.from({ length: 24 }, () => 0),
            Thursday: Array.from({ length: 24 }, () => 0),
            Friday: Array.from({ length: 24 }, () => 0),
            Saturday: Array.from({ length: 24 }, () => 0),
        };

        // For each UTC day/hour, add to the corresponding local day/hour
        Object.entries(
            wrappedData.playtimeDistribution.dayHourDistribution,
        ).forEach(([utcDay, hours]) => {
            hours.forEach((value, utcHour) => {
                if (value > 0) {
                    const local = utcToLocalDayHour(utcDay, utcHour);
                    localDistribution[local.day][local.hour] += value;
                }
            });
        });

        return localDistribution;
    };

    // Convert UTC hourly distribution to local hourly distribution
    const getLocalHourlyDistribution = (): number[] => {
        if (!wrappedData.playtimeDistribution?.hourlyDistribution) {
            return Array.from({ length: 24 }, () => 0);
        }

        const localDistribution = Array.from({ length: 24 }, () => 0);
        const timezoneOffset = new Date().getTimezoneOffset() / 60; // Hours difference from UTC

        wrappedData.playtimeDistribution.hourlyDistribution.forEach(
            (value, utcHour) => {
                const localHour = (utcHour - timezoneOffset + 24) % 24;
                localDistribution[localHour] += value;
            },
        );

        return localDistribution;
    };

    const localHourlyDist = getLocalHourlyDistribution();
    const localDayHourDist = getLocalDayHourDistribution();

    const maxHourlyValue = Math.max(...localHourlyDist, 0.01);

    return (
        <Fade in timeout={1600}>
            <Card variant="outlined">
                <CardContent>
                    <Stack gap={2}>
                        <Stack direction="row" alignItems="center" gap={1}>
                            <CalendarMonth color="primary" />
                            <Typography variant="h6">
                                Play Time Patterns (Local Time)
                            </Typography>
                        </Stack>

                        {/* 24-hour bar chart using actual playtime distribution */}
                        <Box sx={{ mt: 2 }}>
                            <Typography
                                variant="caption"
                                color="textSecondary"
                                sx={{ mb: 1, display: "block" }}
                            >
                                Playtime distribution across the day
                            </Typography>
                            <Box
                                sx={{
                                    display: "flex",
                                    gap: 0.5,
                                    alignItems: "flex-end",
                                    height: 80,
                                }}
                            >
                                {localHourlyDist.map((hours, localHour) => {
                                    const heightPercent =
                                        (hours / maxHourlyValue) * 100;

                                    return (
                                        <Tooltip
                                            key={localHour}
                                            title={`${localHour.toString()}:00 - ${((localHour + 1) % 24).toString()}:00: ${hours.toFixed(1)} hours`}
                                        >
                                            <Box
                                                sx={{
                                                    flex: 1,
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    justifyContent: "flex-end",
                                                    alignItems: "center",
                                                    height: "100%",
                                                }}
                                            >
                                                <Box
                                                    sx={{
                                                        width: "100%",
                                                        height: `${heightPercent.toString()}%`,
                                                        bgcolor:
                                                            hours > 0
                                                                ? "primary.main"
                                                                : "action.disabled",
                                                        borderRadius:
                                                            "2px 2px 0 0",
                                                        minHeight:
                                                            hours > 0
                                                                ? "4px"
                                                                : "2px",
                                                        transition:
                                                            "all 0.3s ease",
                                                        "&:hover": {
                                                            opacity: 0.8,
                                                        },
                                                    }}
                                                />
                                                {localHour % 6 === 0 && (
                                                    <Typography
                                                        variant="caption"
                                                        sx={{
                                                            fontSize: "0.65rem",
                                                            mt: 0.5,
                                                        }}
                                                    >
                                                        {localHour.toString()}
                                                    </Typography>
                                                )}
                                            </Box>
                                        </Tooltip>
                                    );
                                })}
                            </Box>
                        </Box>

                        {/* Heatmap: day of week x hour of day */}
                        <Box sx={{ mt: 3 }}>
                            <Typography
                                variant="caption"
                                color="textSecondary"
                                sx={{ mb: 1, display: "block" }}
                            >
                                Playtime heatmap: when you play during the week
                            </Typography>
                            <Box
                                sx={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 0.5,
                                }}
                            >
                                {[
                                    "Monday",
                                    "Tuesday",
                                    "Wednesday",
                                    "Thursday",
                                    "Friday",
                                    "Saturday",
                                    "Sunday",
                                ].map((day) => {
                                    const dayData = localDayHourDist[day];
                                    const maxDayValue = Math.max(
                                        ...Object.values(
                                            localDayHourDist,
                                        ).flat(),
                                        0.01,
                                    );

                                    return (
                                        <Box
                                            key={day}
                                            sx={{
                                                display: "flex",
                                                gap: 0.5,
                                                alignItems: "center",
                                            }}
                                        >
                                            <Typography
                                                variant="caption"
                                                sx={{
                                                    width: "70px",
                                                    fontSize: "0.7rem",
                                                }}
                                            >
                                                {day.substring(0, 3)}
                                            </Typography>
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    gap: 0.25,
                                                    flex: 1,
                                                }}
                                            >
                                                {dayData.map((hours, hour) => {
                                                    const intensity =
                                                        hours / maxDayValue;
                                                    const opacity =
                                                        hours > 0
                                                            ? 0.2 +
                                                              intensity * 0.8
                                                            : 0.05;

                                                    return (
                                                        <Tooltip
                                                            key={hour}
                                                            title={`${day} ${hour.toString()}:00 - ${((hour + 1) % 24).toString()}:00: ${hours.toFixed(1)} hours`}
                                                        >
                                                            <Box
                                                                sx={{
                                                                    flex: 1,
                                                                    height: 20,
                                                                    bgcolor:
                                                                        "primary.main",
                                                                    opacity:
                                                                        opacity,
                                                                    borderRadius: 0.5,
                                                                    transition:
                                                                        "all 0.2s ease",
                                                                    "&:hover": {
                                                                        transform:
                                                                            "scale(1.2)",
                                                                        zIndex: 10,
                                                                        opacity: 1,
                                                                    },
                                                                }}
                                                            />
                                                        </Tooltip>
                                                    );
                                                })}
                                            </Box>
                                        </Box>
                                    );
                                })}
                                {/* Hour labels */}
                                <Box
                                    sx={{
                                        display: "flex",
                                        gap: 0.25,
                                        ml: "70px",
                                    }}
                                >
                                    {Array.from({ length: 24 }).map(
                                        (_, hour) =>
                                            hour % 6 === 0 ? (
                                                <Typography
                                                    key={hour}
                                                    variant="caption"
                                                    sx={{
                                                        flex: 1,
                                                        fontSize: "0.6rem",
                                                        textAlign: "center",
                                                    }}
                                                >
                                                    {hour.toString()}
                                                </Typography>
                                            ) : (
                                                <Box
                                                    key={hour}
                                                    sx={{ flex: 1 }}
                                                />
                                            ),
                                    )}
                                </Box>
                            </Box>
                        </Box>
                    </Stack>
                </CardContent>
            </Card>
        </Fade>
    );
};

// Flawless Sessions Component
interface FlawlessSessionsProps {
    wrappedData: WrappedData;
}

const FlawlessSessions: React.FC<FlawlessSessionsProps> = ({ wrappedData }) => {
    if (!wrappedData.flawlessSessions) return null;

    return (
        <Fade in timeout={1800}>
            <Card
                variant="outlined"
                sx={{
                    background:
                        "linear-gradient(135deg, #FFD70022 0%, #FFD70011 100%)",
                    border: "2px solid #FFD700",
                }}
            >
                <CardContent>
                    <Stack gap={2} alignItems="center">
                        <Stack direction="row" alignItems="center" gap={1}>
                            <CheckCircle
                                sx={{
                                    fontSize: 32,
                                    color: "#FFD700",
                                }}
                            />
                            <Typography variant="h5">
                                Flawless Sessions
                            </Typography>
                        </Stack>
                        <Typography
                            variant="h3"
                            fontWeight="bold"
                            color="#FFD700"
                        >
                            {wrappedData.flawlessSessions.count.toString()}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                            {wrappedData.flawlessSessions.percentage.toFixed(1)}
                            % of sessions with no losses and no final deaths
                        </Typography>
                    </Stack>
                </CardContent>
            </Card>
        </Fade>
    );
};

// Session Coverage Component
interface SessionCoverageProps {
    wrappedData: WrappedData;
}

const SessionCoverage: React.FC<SessionCoverageProps> = ({ wrappedData }) => {
    if (!wrappedData.sessionCoverage) return null;

    return (
        <Fade in timeout={2000}>
            <Card variant="outlined">
                <CardContent>
                    <Stack gap={2}>
                        <Stack direction="row" alignItems="center" gap={1}>
                            <Info color="primary" />
                            <Typography variant="h6">
                                Session Coverage
                            </Typography>
                        </Stack>
                        <Grid container spacing={2}>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <Stack alignItems="center">
                                    <Typography variant="h4" color="primary">
                                        {wrappedData.sessionCoverage.gamesPlayedPercentage.toFixed(
                                            1,
                                        )}
                                        %
                                    </Typography>
                                    <Typography
                                        variant="caption"
                                        color="textSecondary"
                                        textAlign="center"
                                    >
                                        of games played captured in sessions
                                    </Typography>
                                </Stack>
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <Stack alignItems="center">
                                    <Typography
                                        variant="h4"
                                        color="success.main"
                                    >
                                        {formatHours(
                                            wrappedData.sessionCoverage
                                                .adjustedTotalHours,
                                        )}
                                    </Typography>
                                    <Typography
                                        variant="caption"
                                        color="textSecondary"
                                        textAlign="center"
                                    >
                                        adjusted total playtime (accounting for
                                        gaps)
                                    </Typography>
                                </Stack>
                            </Grid>
                        </Grid>
                    </Stack>
                </CardContent>
            </Card>
        </Fade>
    );
};

function RouteComponent() {
    const { uuid: rawUUID } = Route.useParams();
    const uuid = normalizeUUID(rawUUID);
    const { year } = Route.useLoaderDeps();

    const navigate = Route.useNavigate();
    const uuidToUsername = useUUIDToUsername(uuid ? [uuid] : []);
    const username = uuid ? uuidToUsername[uuid] : undefined;
    const { visitPlayer } = usePlayerVisits();

    const { data: wrappedData, isLoading } = useQuery(
        getWrappedQueryOptions({
            uuid: uuid ?? "",
            year,
        }),
    );

    // Register visits for player on page load
    const [initialUUID] = React.useState(uuid);
    const [initialVisitPlayer] = React.useState(() => visitPlayer);
    React.useEffect(() => {
        if (!initialUUID) return;
        initialVisitPlayer(initialUUID);
    }, [initialVisitPlayer, initialUUID]);

    if (!uuid) {
        return <Navigate to="/wrapped" replace />;
    }

    if (uuid !== rawUUID) {
        return (
            <Navigate
                from="/wrapped/$uuid"
                to="/wrapped/$uuid"
                replace
                params={{ uuid }}
                search={(oldSearch) => ({
                    ...oldSearch,
                    uuid,
                })}
            />
        );
    }

    // Calculate year stats from yearStats
    const startStats = wrappedData?.yearStats?.start;
    const endStats = wrappedData?.yearStats?.end;

    const totalGames =
        startStats && endStats
            ? computeStat(endStats, "overall", "gamesPlayed", "session", [
                  startStats,
                  endStats,
              ])
            : null;
    const totalWins =
        startStats && endStats
            ? computeStat(endStats, "overall", "wins", "session", [
                  startStats,
                  endStats,
              ])
            : null;
    const totalFinalKills =
        startStats && endStats
            ? computeStat(endStats, "overall", "finalKills", "session", [
                  startStats,
                  endStats,
              ])
            : null;
    const totalBedsBroken =
        startStats && endStats
            ? computeStat(endStats, "overall", "bedsBroken", "session", [
                  startStats,
                  endStats,
              ])
            : null;

    const startFKDR =
        startStats && endStats
            ? computeStat(startStats, "overall", "fkdr", "overall", [
                  startStats,
                  endStats,
              ])
            : null;
    const endFKDR =
        startStats && endStats
            ? computeStat(endStats, "overall", "fkdr", "overall", [
                  startStats,
                  endStats,
              ])
            : null;

    const starsStart =
        startStats && endStats
            ? computeStat(startStats, "overall", "stars", "overall", [
                  startStats,
                  endStats,
              ])
            : null;
    const starsEnd =
        startStats && endStats
            ? computeStat(endStats, "overall", "stars", "overall", [
                  startStats,
                  endStats,
              ])
            : null;
    const starsGained = starsEnd && starsStart ? starsEnd - starsStart : null;

    const winRate =
        totalGames && totalWins ? (totalWins / totalGames) * 100 : 0;

    const lowCoverage =
        wrappedData?.sessionCoverage?.gamesPlayedPercentage &&
        wrappedData.sessionCoverage.gamesPlayedPercentage < 50;

    return (
        <Stack spacing={3}>
            <ConfettiEffect />
            <meta
                name="description"
                content={`View ${username ?? "a player"}&apos;s year in review for ${year.toString()}, showcasing their achievements, milestones, and highlights.`}
            />
            <link
                rel="canonical"
                href={`https://prismoverlay.com/wrapped/${uuid}`}
            />
            <UserSearch
                onSubmit={(uuid) => {
                    visitPlayer(uuid);
                    navigate({
                        params: { uuid },
                        search: (oldSearch) => oldSearch,
                    }).catch((error: unknown) => {
                        captureException(error, {
                            tags: {
                                param: "uuid",
                            },
                            extra: {
                                message: "Failed to update search params",
                                uuid,
                            },
                        });
                    });
                }}
            />

            <Fade in timeout={1000}>
                <Box>
                    <Stack
                        direction="row"
                        gap={2}
                        alignItems="center"
                        justifyContent="center"
                    >
                        <Avatar
                            key={uuid}
                            alt={`Profile picture for ${username ?? "unknown"}`}
                            src={`https://crafatar.com/avatars/${uuid}?overlay`}
                            variant="square"
                            sx={{ width: 80, height: 80 }}
                        />
                        <Stack alignItems="center">
                            <Typography
                                variant="h3"
                                fontWeight="bold"
                                textAlign="center"
                                sx={{
                                    background:
                                        "linear-gradient(45deg, #FF6B6B, #4ECDC4, #45B7D1)",
                                    WebkitBackgroundClip: "text",
                                    WebkitTextFillColor: "transparent",
                                }}
                            >
                                {username
                                    ? `${username}'s ${year.toString()} Wrapped`
                                    : `${year.toString()} Wrapped`}
                            </Typography>
                            <Typography
                                variant="subtitle1"
                                color="textSecondary"
                            >
                                A year of Bed Wars achievements
                            </Typography>
                        </Stack>
                    </Stack>
                </Box>
            </Fade>

            {isLoading || !wrappedData ? (
                <Fade in timeout={1000}>
                    <Card variant="outlined">
                        <CardContent>
                            <Typography variant="h6" textAlign="center">
                                Loading your year in review...
                            </Typography>
                            <LinearProgress sx={{ mt: 2 }} />
                        </CardContent>
                    </Card>
                </Fade>
            ) : wrappedData.totalSessions === 0 ? (
                <>
                    <Fade in timeout={1000}>
                        <Alert severity="info" icon={<Info />}>
                            <Typography variant="body2">
                                This player didn&apos;t record any sessions with
                                the Prism Overlay in {year.toString()}. Showing
                                overall year statistics instead.
                            </Typography>
                        </Alert>
                    </Fade>

                    {/* Show basic year stats without session data */}
                    {wrappedData.yearStats && (
                        <>
                            <Grid container spacing={2}>
                                <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                                    <StatCard
                                        title="Games Played"
                                        value={(
                                            totalGames ?? 0
                                        ).toLocaleString()}
                                        icon={
                                            <EmojiEvents
                                                sx={{ fontSize: 48 }}
                                            />
                                        }
                                        color="#FF6B6B"
                                        delay={100}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                                    <StatCard
                                        title="Wins"
                                        value={(
                                            totalWins ?? 0
                                        ).toLocaleString()}
                                        subtitle={`${winRate.toFixed(1)}% win rate`}
                                        icon={<Star sx={{ fontSize: 48 }} />}
                                        color="#4ECDC4"
                                        delay={200}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                                    <StatCard
                                        title="Final Kills"
                                        value={(
                                            totalFinalKills ?? 0
                                        ).toLocaleString()}
                                        subtitle="enemies eliminated"
                                        icon={
                                            <Whatshot sx={{ fontSize: 48 }} />
                                        }
                                        color="#FFD93D"
                                        delay={300}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                                    <StatCard
                                        title="Beds Broken"
                                        value={(
                                            totalBedsBroken ?? 0
                                        ).toLocaleString()}
                                        subtitle="beds destroyed"
                                        icon={
                                            <Celebration
                                                sx={{ fontSize: 48 }}
                                            />
                                        }
                                        color="#95E1D3"
                                        delay={400}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                                    <StatCard
                                        title="FKDR"
                                        value={(endFKDR ?? 0).toFixed(2)}
                                        subtitle={
                                            startFKDR && endFKDR
                                                ? (
                                                      endFKDR - startFKDR
                                                  ).toLocaleString(undefined, {
                                                      signDisplay: "always",
                                                      maximumFractionDigits: 2,
                                                  })
                                                : undefined
                                        }
                                        icon={
                                            <TrendingUp sx={{ fontSize: 48 }} />
                                        }
                                        color="#A8E6CF"
                                        delay={500}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                                    <StatCard
                                        title="Stars Gained"
                                        value={
                                            starsGained
                                                ? `+${starsGained.toLocaleString()}`
                                                : "0"
                                        }
                                        subtitle={
                                            starsEnd
                                                ? `now at ${starsEnd.toLocaleString()} ⭐`
                                                : undefined
                                        }
                                        icon={<Star sx={{ fontSize: 48 }} />}
                                        color="#FFB6D9"
                                        delay={600}
                                    />
                                </Grid>
                            </Grid>

                            <Fade in timeout={1800}>
                                <Card variant="outlined">
                                    <CardContent>
                                        <Stack gap={2} alignItems="center">
                                            <Typography variant="h5">
                                                🎉 {year.toString()} Summary 🎉
                                            </Typography>
                                            <Typography
                                                variant="body2"
                                                color="textSecondary"
                                                textAlign="center"
                                            >
                                                Enable the Prism Overlay to
                                                track detailed session
                                                statistics in the future!
                                            </Typography>
                                        </Stack>
                                    </CardContent>
                                </Card>
                            </Fade>
                        </>
                    )}
                </>
            ) : (
                <>
                    {lowCoverage && wrappedData.sessionCoverage && (
                        <Fade in timeout={800}>
                            <Alert severity="warning" icon={<Warning />}>
                                <Typography variant="body2">
                                    Session coverage is low (
                                    {wrappedData.sessionCoverage.gamesPlayedPercentage.toFixed(
                                        1,
                                    )}
                                    % of games in sessions). Many stats gained
                                    outside recorded sessions.
                                </Typography>
                            </Alert>
                        </Fade>
                    )}

                    {/* Session Overview */}
                    <SessionOverview wrappedData={wrappedData} />

                    {/* Main Stats Grid */}
                    <YearStatsCards
                        wrappedData={wrappedData}
                        totalGames={totalGames}
                        totalWins={totalWins}
                        totalFinalKills={totalFinalKills}
                        totalBedsBroken={totalBedsBroken}
                        endFKDR={endFKDR}
                        startFKDR={startFKDR}
                        starsGained={starsGained}
                        starsEnd={starsEnd}
                        winRate={winRate}
                    />

                    {/* Session Averages */}
                    <AverageSessionStats wrappedData={wrappedData} />

                    {/* Best Sessions */}
                    <BestSessions wrappedData={wrappedData} />

                    {/* Streaks Section */}
                    <Streaks wrappedData={wrappedData} />

                    {/* Play Patterns */}
                    <FavoritePlayTimes wrappedData={wrappedData} />

                    {/* Flawless Sessions */}
                    <FlawlessSessions wrappedData={wrappedData} />

                    {/* Session Coverage Info */}
                    <SessionCoverage wrappedData={wrappedData} />

                    {/* Closing Message */}
                    <Fade in timeout={2000}>
                        <Card
                            variant="outlined"
                            sx={{
                                background:
                                    "linear-gradient(135deg, #a8edea22 0%, #fed6e311 100%)",
                                border: "2px solid #a8edea",
                            }}
                        >
                            <CardContent>
                                <Typography
                                    variant="h5"
                                    textAlign="center"
                                    fontWeight="bold"
                                    gutterBottom
                                >
                                    🎉 What a Year! 🎉
                                </Typography>
                                <Typography
                                    variant="body1"
                                    textAlign="center"
                                    color="textSecondary"
                                >
                                    Thank you for an amazing {year.toString()}!
                                    Here&apos;s to even more victories in the
                                    next year.
                                </Typography>
                            </CardContent>
                        </Card>
                    </Fade>
                </>
            )}
        </Stack>
    );
}
