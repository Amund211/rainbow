import { queryClient } from "#queryClient.ts";
import { getUsernameQueryOptions } from "#queries/username.ts";
import { getHistoryQueryOptions, type History } from "#queries/history.ts";
import { getSessionsQueryOptions, type Sessions } from "#queries/sessions.ts";
import { useUUIDToUsername } from "#queries/username.ts";
import { computeStat } from "#stats/index.ts";
import { type GamemodeKey, type StatKey } from "#stats/keys.ts";
import { getFullStatLabel } from "#stats/labels.ts";
import {
    Avatar,
    Box,
    Card,
    CardContent,
    Fade,
    Grid,
    Grow,
    Stack,
    Typography,
    Zoom,
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
} from "@mui/icons-material";

export const Route = createFileRoute("/wrapped/$uuid")({
    loaderDeps: ({ search: { year } }) => {
        const startOfYear = new Date(year, 0, 1);
        const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);
        return {
            year,
            startOfYear,
            endOfYear,
        };
    },
    loader: ({
        params: { uuid: rawUUID },
        deps: { startOfYear, endOfYear },
    }) => {
        const uuid = normalizeUUID(rawUUID);
        if (!uuid) return;

        Promise.all([
            queryClient.fetchQuery(
                getHistoryQueryOptions({
                    uuid,
                    start: startOfYear,
                    end: endOfYear,
                    limit: 1000,
                }),
            ),
            queryClient.fetchQuery(
                getSessionsQueryOptions({
                    uuid,
                    start: startOfYear,
                    end: endOfYear,
                }),
            ),
            queryClient.fetchQuery(getUsernameQueryOptions(uuid)),
        ]).catch((error: unknown) => {
            captureException(error, {
                extra: {
                    uuid,
                    startOfYear,
                    endOfYear,
                    message:
                        "Failed to fetch history + sessions + username data for wrapped",
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

interface YearStats {
    totalGames: number;
    totalWins: number;
    totalFinalKills: number;
    totalBedsBroken: number;
    fkdr: number;
    winRate: number;
    stars: number;
    starsGained: number;
}

const calculateYearStats = (history: History): YearStats | null => {
    if (history.length === 0) return null;

    const firstData = history[0];
    const lastData = history[history.length - 1];

    const totalGames = computeStat(
        lastData,
        "overall",
        "gamesPlayed",
        "session",
        [firstData, lastData],
    );
    const totalWins = computeStat(lastData, "overall", "wins", "session", [
        firstData,
        lastData,
    ]);
    const totalFinalKills = computeStat(
        lastData,
        "overall",
        "finalKills",
        "session",
        [firstData, lastData],
    );
    const totalBedsBroken = computeStat(
        lastData,
        "overall",
        "bedsBroken",
        "session",
        [firstData, lastData],
    );
    const fkdr = computeStat(lastData, "overall", "fkdr", "overall", [
        firstData,
        lastData,
    ]);

    const winRate =
        totalGames && totalWins ? (totalWins / totalGames) * 100 : 0;

    const starsStart = computeStat(firstData, "overall", "stars", "overall", [
        firstData,
        lastData,
    ]);
    const starsEnd = computeStat(lastData, "overall", "stars", "overall", [
        firstData,
        lastData,
    ]);
    const starsGained = starsEnd && starsStart ? starsEnd - starsStart : 0;

    return {
        totalGames: totalGames ?? 0,
        totalWins: totalWins ?? 0,
        totalFinalKills: totalFinalKills ?? 0,
        totalBedsBroken: totalBedsBroken ?? 0,
        fkdr: fkdr ?? 0,
        winRate,
        stars: starsEnd ?? 0,
        starsGained,
    };
};

const findBestSession = (
    sessions: Sessions,
    gamemode: GamemodeKey,
): {
    session: Sessions[number] | null;
    stat: StatKey;
    value: number;
} => {
    let bestSession: Sessions[number] | null = null;
    let bestStat: StatKey = "finalKills";
    let bestValue = 0;

    const statsToCheck: StatKey[] = [
        "finalKills",
        "wins",
        "bedsBroken",
        "fkdr",
    ];

    for (const session of sessions) {
        if (session.extrapolated) continue;

        for (const stat of statsToCheck) {
            const value = computeStat(session.end, gamemode, stat, "session", [
                session.start,
                session.end,
            ]);

            if (value !== null && value > bestValue) {
                bestValue = value;
                bestSession = session;
                bestStat = stat;
            }
        }
    }

    return { session: bestSession, stat: bestStat, value: bestValue };
};

const findLongestSession = (sessions: Sessions): Sessions[number] | null => {
    let longestSession: Sessions[number] | null = null;
    let longestDuration = 0;

    for (const session of sessions) {
        if (session.extrapolated) continue;

        const duration =
            session.end.queriedAt.getTime() - session.start.queriedAt.getTime();

        if (duration > longestDuration) {
            longestDuration = duration;
            longestSession = session;
        }
    }

    return longestSession;
};

const renderDuration = (end: Date, start: Date) => {
    const duration = end.getTime() - start.getTime();
    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
        return `${hours.toString()}h ${minutes.toString()}m`;
    }
    return `${minutes.toString()}m`;
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

function RouteComponent() {
    const { uuid: rawUUID } = Route.useParams();
    const uuid = normalizeUUID(rawUUID);
    const { year, startOfYear, endOfYear } = Route.useLoaderDeps();

    const navigate = Route.useNavigate();
    const uuidToUsername = useUUIDToUsername(uuid ? [uuid] : []);
    const username = uuid ? uuidToUsername[uuid] : undefined;
    const { visitPlayer } = usePlayerVisits();

    const { data: history } = useQuery(
        getHistoryQueryOptions({
            uuid: uuid ?? "",
            start: startOfYear,
            end: endOfYear,
            limit: 1000,
        }),
    );

    const { data: sessions } = useQuery(
        getSessionsQueryOptions({
            uuid: uuid ?? "",
            start: startOfYear,
            end: endOfYear,
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

    const yearStats = history && sessions ? calculateYearStats(history) : null;
    const bestSession = sessions ? findBestSession(sessions, "overall") : null;
    const longestSession = sessions ? findLongestSession(sessions) : null;

    const totalSessions = sessions?.filter((s) => !s.extrapolated).length ?? 0;

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

            {!yearStats || !history || !sessions ? (
                <Fade in timeout={1000}>
                    <Card variant="outlined">
                        <CardContent>
                            <Typography variant="h6" textAlign="center">
                                Loading your year in review...
                            </Typography>
                        </CardContent>
                    </Card>
                </Fade>
            ) : yearStats.totalGames === 0 ? (
                <Fade in timeout={1000}>
                    <Card variant="outlined">
                        <CardContent>
                            <Typography variant="h6" textAlign="center">
                                No games played in {year.toString()}
                            </Typography>
                            <Typography
                                variant="body2"
                                color="textSecondary"
                                textAlign="center"
                            >
                                This player didn&apos;t record any stats with
                                the Prism Overlay in {year.toString()}
                            </Typography>
                        </CardContent>
                    </Card>
                </Fade>
            ) : (
                <>
                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                            <StatCard
                                title="Games Played"
                                value={yearStats.totalGames.toLocaleString()}
                                subtitle={`across ${totalSessions.toString()} sessions`}
                                icon={<EmojiEvents sx={{ fontSize: 48 }} />}
                                color="#FF6B6B"
                                delay={100}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                            <StatCard
                                title="Wins"
                                value={yearStats.totalWins.toLocaleString()}
                                subtitle={`${yearStats.winRate.toFixed(1)}% win rate`}
                                icon={<Star sx={{ fontSize: 48 }} />}
                                color="#4ECDC4"
                                delay={200}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                            <StatCard
                                title="Final Kills"
                                value={yearStats.totalFinalKills.toLocaleString()}
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
                                value={yearStats.totalBedsBroken.toLocaleString()}
                                subtitle="beds destroyed"
                                icon={<Celebration sx={{ fontSize: 48 }} />}
                                color="#95E1D3"
                                delay={400}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                            <StatCard
                                title="FKDR"
                                value={yearStats.fkdr.toFixed(2)}
                                subtitle="final K/D ratio"
                                icon={<TrendingUp sx={{ fontSize: 48 }} />}
                                color="#A8E6CF"
                                delay={500}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                            <StatCard
                                title="Stars Gained"
                                value={`+${yearStats.starsGained.toFixed(1)}`}
                                subtitle={`now at ${yearStats.stars.toFixed(1)} ⭐`}
                                icon={<Star sx={{ fontSize: 48 }} />}
                                color="#FFB6D9"
                                delay={600}
                            />
                        </Grid>
                    </Grid>

                    {bestSession?.session && (
                        <Grow in timeout={1500}>
                            <Card
                                variant="outlined"
                                sx={{
                                    background:
                                        "linear-gradient(135deg, #667eea22 0%, #764ba211 100%)",
                                    border: "2px solid #667eea",
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
                                            <EmojiEvents
                                                sx={{
                                                    fontSize: 32,
                                                    color: "#FFD700",
                                                }}
                                            />
                                            <Typography
                                                variant="h5"
                                                fontWeight="bold"
                                            >
                                                Best Session
                                            </Typography>
                                        </Stack>
                                        <Typography
                                            variant="h6"
                                            textAlign="center"
                                            color="textSecondary"
                                        >
                                            {bestSession.session.start.queriedAt.toLocaleDateString(
                                                undefined,
                                                {
                                                    month: "long",
                                                    day: "numeric",
                                                    year: "numeric",
                                                },
                                            )}
                                        </Typography>
                                        <Typography
                                            variant="h4"
                                            textAlign="center"
                                            fontWeight="bold"
                                        >
                                            {bestSession.value.toLocaleString()}{" "}
                                            {getFullStatLabel(bestSession.stat)}
                                        </Typography>
                                        <Typography
                                            variant="body2"
                                            textAlign="center"
                                            color="textSecondary"
                                        >
                                            in{" "}
                                            {renderDuration(
                                                bestSession.session.end
                                                    .queriedAt,
                                                bestSession.session.start
                                                    .queriedAt,
                                            )}
                                        </Typography>
                                    </Stack>
                                </CardContent>
                            </Card>
                        </Grow>
                    )}

                    {longestSession && (
                        <Grow in timeout={1800}>
                            <Card
                                variant="outlined"
                                sx={{
                                    background:
                                        "linear-gradient(135deg, #f093fb22 0%, #f5576c11 100%)",
                                    border: "2px solid #f093fb",
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
                                            <Timer
                                                sx={{
                                                    fontSize: 32,
                                                    color: "#f093fb",
                                                }}
                                            />
                                            <Typography
                                                variant="h5"
                                                fontWeight="bold"
                                            >
                                                Longest Session
                                            </Typography>
                                        </Stack>
                                        <Typography
                                            variant="h6"
                                            textAlign="center"
                                            color="textSecondary"
                                        >
                                            {longestSession.start.queriedAt.toLocaleDateString(
                                                undefined,
                                                {
                                                    month: "long",
                                                    day: "numeric",
                                                    year: "numeric",
                                                },
                                            )}
                                        </Typography>
                                        <Typography
                                            variant="h4"
                                            textAlign="center"
                                            fontWeight="bold"
                                        >
                                            {renderDuration(
                                                longestSession.end.queriedAt,
                                                longestSession.start.queriedAt,
                                            )}
                                        </Typography>
                                        <Typography
                                            variant="body2"
                                            textAlign="center"
                                            color="textSecondary"
                                        >
                                            of dedicated gameplay
                                        </Typography>
                                    </Stack>
                                </CardContent>
                            </Card>
                        </Grow>
                    )}

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
