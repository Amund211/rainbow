import { queryClient } from "#queryClient.ts";
import { getUsernameQueryOptions } from "#queries/username.ts";
import { getWrappedQueryOptions, type WrappedData } from "#queries/wrapped.ts";
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

const formatTimeRange = (hourStart: number): string => {
    const endHour = (hourStart + 4) % 24;
    const formatHour = (h: number) => {
        if (h === 0) return "12am";
        if (h < 12) return `${h.toString()}am`;
        if (h === 12) return "12pm";
        return `${(h - 12).toString()}pm`;
    };
    return `${formatHour(hourStart)}-${formatHour(endHour)}`;
};

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
    }, []);

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
    session: WrappedData["bestSessions"]["highestFKDR"];
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
    const startStats = wrappedData?.yearStats.start;
    const endStats = wrappedData?.yearStats.end;

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
        wrappedData && wrappedData.sessionCoverage.gamesPlayedPercentage < 50;

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
                                    ? `${username}&apos;s ${year.toString()} Wrapped`
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
                <Fade in timeout={1000}>
                    <Card variant="outlined">
                        <CardContent>
                            <Typography variant="h6" textAlign="center">
                                No sessions found in {year.toString()}
                            </Typography>
                            <Typography
                                variant="body2"
                                color="textSecondary"
                                textAlign="center"
                            >
                                This player didn&apos;t record any sessions with
                                the Prism Overlay in {year.toString()}
                            </Typography>
                        </CardContent>
                    </Card>
                </Fade>
            ) : (
                <>
                    {lowCoverage && (
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
                    <Fade in timeout={1000}>
                        <Card variant="outlined">
                            <CardContent>
                                <Stack gap={2}>
                                    <Stack
                                        direction="row"
                                        alignItems="center"
                                        gap={1}
                                    >
                                        <Schedule color="primary" />
                                        <Typography variant="h6">
                                            Session Overview
                                        </Typography>
                                    </Stack>
                                    <Grid container spacing={2}>
                                        <Grid size={{ xs: 6, sm: 3 }}>
                                            <Stack alignItems="center">
                                                <Typography
                                                    variant="h4"
                                                    color="primary"
                                                >
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
                                        {wrappedData.nonConsecutiveSessions >
                                            0 && (
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
                                                        wrappedData
                                                            .sessionLengths
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
                                                <Typography
                                                    variant="h4"
                                                    color="info.main"
                                                >
                                                    {formatHours(
                                                        wrappedData
                                                            .sessionLengths
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
                                                wrappedData.sessionsPerMonth[
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
                                </Stack>
                            </CardContent>
                        </Card>
                    </Fade>

                    {/* Main Stats Grid */}
                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                            <StatCard
                                title="Games Played"
                                value={(totalGames ?? 0).toLocaleString()}
                                subtitle={
                                    wrappedData
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
                                icon={
                                    <LocalFireDepartment
                                        sx={{ fontSize: 48 }}
                                    />
                                }
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
                                        ? (endFKDR - startFKDR).toLocaleString(
                                              undefined,
                                              {
                                                  signDisplay: "always",
                                                  maximumFractionDigits: 2,
                                              },
                                          )
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
                                value={`+${(starsGained ?? 0).toFixed(1)}`}
                                subtitle={`now at ${(starsEnd ?? 0).toFixed(1)} ⭐`}
                                icon={<Star sx={{ fontSize: 48 }} />}
                                color="#FFB6D9"
                                delay={600}
                            />
                        </Grid>
                    </Grid>

                    {/* Session Averages */}
                    <Fade in timeout={1200}>
                        <Card variant="outlined">
                            <CardContent>
                                <Stack gap={2}>
                                    <Stack
                                        direction="row"
                                        alignItems="center"
                                        gap={1}
                                    >
                                        <ShowChart color="primary" />
                                        <Typography variant="h6">
                                            Average Session Stats
                                        </Typography>
                                    </Stack>
                                    <Grid container spacing={2}>
                                        <Grid size={{ xs: 6, sm: 3 }}>
                                            <Stack alignItems="center">
                                                <Typography variant="h5">
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
                                                <Typography variant="h5">
                                                    {wrappedData.averages.wins.toFixed(
                                                        1,
                                                    )}
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
                                                <Typography variant="h5">
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
                                                <Typography variant="h5">
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

                    {/* Best Sessions */}
                    <Typography variant="h5" fontWeight="bold" sx={{ mt: 2 }}>
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
                                session={
                                    wrappedData.bestSessions.mostFinalKills
                                }
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
                                session={
                                    wrappedData.bestSessions.longestSession
                                }
                                statLabel="hours"
                                color="#A8E6CF"
                                showDuration={false}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <BestSessionCard
                                title="Most Wins/Hour"
                                icon={<TrendingUp />}
                                session={
                                    wrappedData.bestSessions.mostWinsPerHour
                                }
                                statLabel="wins/hr"
                                color="#95E1D3"
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <BestSessionCard
                                title="Most Finals/Hour"
                                icon={<Whatshot />}
                                session={
                                    wrappedData.bestSessions.mostFinalsPerHour
                                }
                                statLabel="finals/hr"
                                color="#FF6B6B"
                            />
                        </Grid>
                    </Grid>

                    {/* Streaks Section */}
                    <Typography variant="h5" fontWeight="bold" sx={{ mt: 3 }}>
                        🔥 Streaks
                    </Typography>

                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Fade in timeout={1400}>
                                <Card variant="outlined">
                                    <CardContent>
                                        <Stack gap={2}>
                                            <Typography
                                                variant="h6"
                                                textAlign="center"
                                            >
                                                Highest Winstreaks
                                            </Typography>
                                            <Divider />
                                            {Object.entries(
                                                wrappedData.winstreaks,
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
                                                            textTransform:
                                                                "capitalize",
                                                        }}
                                                    >
                                                        {mode}
                                                    </Typography>
                                                    <Stack alignItems="flex-end">
                                                        <Typography
                                                            variant="h6"
                                                            color="success.main"
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

                        <Grid size={{ xs: 12, md: 6 }}>
                            <Fade in timeout={1400}>
                                <Card variant="outlined">
                                    <CardContent>
                                        <Stack gap={2}>
                                            <Typography
                                                variant="h6"
                                                textAlign="center"
                                            >
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
                                                            textTransform:
                                                                "capitalize",
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

                    {/* Play Patterns */}
                    <Fade in timeout={1600}>
                        <Card variant="outlined">
                            <CardContent>
                                <Stack gap={2}>
                                    <Stack
                                        direction="row"
                                        alignItems="center"
                                        gap={1}
                                    >
                                        <CalendarMonth color="primary" />
                                        <Typography variant="h6">
                                            Favorite Play Times
                                        </Typography>
                                    </Stack>
                                    <Grid container spacing={2}>
                                        {wrappedData.favoritePlayIntervals.map(
                                            (interval, index) => (
                                                <Grid
                                                    size={{ xs: 12, sm: 4 }}
                                                    key={index}
                                                >
                                                    <Card
                                                        variant="outlined"
                                                        sx={{
                                                            bgcolor:
                                                                "action.hover",
                                                        }}
                                                    >
                                                        <CardContent>
                                                            <Stack
                                                                alignItems="center"
                                                                gap={1}
                                                            >
                                                                <Typography variant="h6">
                                                                    #
                                                                    {(
                                                                        index +
                                                                        1
                                                                    ).toString()}
                                                                </Typography>
                                                                <Typography
                                                                    variant="h5"
                                                                    color="primary"
                                                                >
                                                                    {formatTimeRange(
                                                                        interval.hourStart,
                                                                    )}
                                                                </Typography>
                                                                <Typography variant="body2">
                                                                    {interval.percentage.toFixed(
                                                                        1,
                                                                    )}
                                                                    % of
                                                                    playtime
                                                                </Typography>
                                                            </Stack>
                                                        </CardContent>
                                                    </Card>
                                                </Grid>
                                            ),
                                        )}
                                    </Grid>
                                </Stack>
                            </CardContent>
                        </Card>
                    </Fade>

                    {/* Flawless Sessions */}
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
                                    <Stack
                                        direction="row"
                                        alignItems="center"
                                        gap={1}
                                    >
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
                                    <Typography variant="body1">
                                        {wrappedData.flawlessSessions.percentage.toFixed(
                                            1,
                                        )}
                                        % of sessions with no losses and no
                                        final deaths
                                    </Typography>
                                </Stack>
                            </CardContent>
                        </Card>
                    </Fade>

                    {/* Session Coverage Info */}
                    <Fade in timeout={1900}>
                        <Card variant="outlined">
                            <CardContent>
                                <Stack gap={2}>
                                    <Stack
                                        direction="row"
                                        alignItems="center"
                                        gap={1}
                                    >
                                        <Info color="primary" />
                                        <Typography variant="h6">
                                            Session Coverage
                                        </Typography>
                                    </Stack>
                                    <Grid container spacing={2}>
                                        <Grid size={{ xs: 12, sm: 6 }}>
                                            <Stack alignItems="center">
                                                <Typography
                                                    variant="h4"
                                                    color={
                                                        lowCoverage
                                                            ? "warning.main"
                                                            : "success.main"
                                                    }
                                                >
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
                                                    of games played captured in
                                                    sessions
                                                </Typography>
                                            </Stack>
                                        </Grid>
                                        <Grid size={{ xs: 12, sm: 6 }}>
                                            <Stack alignItems="center">
                                                <Typography
                                                    variant="h4"
                                                    color="info.main"
                                                >
                                                    {formatHours(
                                                        wrappedData
                                                            .sessionCoverage
                                                            .adjustedTotalHours,
                                                    )}
                                                </Typography>
                                                <Typography
                                                    variant="caption"
                                                    color="textSecondary"
                                                    textAlign="center"
                                                >
                                                    adjusted total playtime
                                                    (accounting for gaps)
                                                </Typography>
                                            </Stack>
                                        </Grid>
                                    </Grid>
                                </Stack>
                            </CardContent>
                        </Card>
                    </Fade>

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
