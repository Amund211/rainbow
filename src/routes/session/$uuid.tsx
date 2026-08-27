import { Info, InfoOutlined, QueryStats, Search, Warning } from "@mui/icons-material";
import {
    Box,
    Card,
    CardContent,
    FormControlLabel,
    Grid,
    IconButton,
    MenuItem,
    Select,
    Skeleton,
    Stack,
    Switch,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
    Typography,
} from "@mui/material";
import type { SvgIconOwnProps, TypographyOwnProps } from "@mui/material";
import { captureException } from "@sentry/react";
import { useQuery } from "@tanstack/react-query";
import {
    createFileRoute,
    createLink,
    Navigate,
    useNavigate,
} from "@tanstack/react-router";
import React from "react";

import { HistoryChart, SimpleHistoryChart } from "#charts/history/chart.tsx";
import { PlayerHead } from "#components/player.tsx";
import { TimeIntervalPicker } from "#components/TimeIntervalPicker.tsx";
import { TrendIcon } from "#components/TrendIcon.tsx";
import { UserSearch } from "#components/UserSearch.tsx";
import { ChartSynchronizerProvider } from "#contexts/ChartSynchronizer/provider.tsx";
import { usePlayerVisits } from "#contexts/PlayerVisits/hooks.ts";
import { formatDuration } from "#helpers/duration.ts";
import { addExtrapolatedSessions } from "#helpers/session.ts";
import { normalizeUUID } from "#helpers/uuid.ts";
import { useAssume } from "#hooks/useAssumption.ts";
import { timeIntervalsFromDefinition } from "#intervals.ts";
import type { TimeInterval, TimeIntervalDefinition } from "#intervals.ts";
import { historyRequest } from "#queries/history.ts";
import type { HistoryRequest } from "#queries/history.ts";
import { prefetchPlan } from "#queries/plan.ts";
import { sessionsRequest } from "#queries/sessions.ts";
import type { Sessions, SessionsRequest } from "#queries/sessions.ts";
import { usernameRequest, useUUIDToUsername } from "#queries/username.ts";
import { sessionSearchSchema } from "#schemas/sessionSearch.ts";
import {
    formatStatValue,
    getTrendDirection,
    getTrendSentiment,
} from "#stats/format.ts";
import type { TrendSentiment } from "#stats/format.ts";
import { computeStat } from "#stats/index.ts";
import { ALL_GAMEMODE_KEYS, ALL_STAT_KEYS } from "#stats/keys.ts";
import type { GamemodeKey, StatKey } from "#stats/keys.ts";
import {
    getFullStatLabel,
    getGamemodeLabel,
    getShortStatLabel,
    getVariantLabel,
} from "#stats/labels.ts";
import {
    computeStatProgression,
    ERR_NO_DATA,
    ERR_TRACKING_STARTED,
} from "#stats/progression.ts";
import type { StatProgression } from "#stats/progression.ts";
import { MS_PER_DAY, MS_PER_HOUR } from "#time.ts";

interface SessionLoaderDeps {
    readonly timeIntervalDefinition: TimeIntervalDefinition;
    readonly trackingStart: Date;
}

/**
 * Every query this page reads.
 *
 * The loader prefetches all of it, and the components below fetch only what
 * they are handed from here — so a query cannot be added to the page without
 * being prefetched too. Add queries here, never in a component.
 */
export const makeSessionQueryPlan = (
    rawUUID: string,
    { timeIntervalDefinition, trackingStart }: SessionLoaderDeps,
) => {
    const uuid = normalizeUUID(rawUUID);
    // The page redirects away when the uuid won't normalize, so nothing fetches.
    const enabled = uuid !== null;

    const { day, week, month } = timeIntervalsFromDefinition({
        // If missing -> today's date
        date: new Date(),
        ...timeIntervalDefinition,
    });

    const history = ({ start, end }: TimeInterval, limit: number) =>
        historyRequest({ uuid: uuid ?? "", start, end, limit, enabled });

    return {
        // Two limits per interval: the stat cards only need the endpoints,
        // while the sparklines need the curve between them.
        dayStat: history(day, 2),
        dayChart: history(day, 100),
        weekStat: history(week, 2),
        weekChart: history(week, 100),
        monthStat: history(month, 2),
        monthChart: history(month, 100),
        tracking: history({ start: trackingStart, end: day.end }, 2),
        sessions: sessionsRequest({
            uuid: uuid ?? "",
            start: month.start,
            end: month.end,
            enabled,
        }),
        username: usernameRequest({ uuid: uuid ?? "", enabled }),
    };
};

export const Route = createFileRoute("/session/$uuid")({
    loaderDeps: ({ search: { timeIntervalDefinition, trackingStart } }) => ({
        timeIntervalDefinition,
        trackingStart,
    }),
    context: ({ params: { uuid }, deps }) => ({
        queries: makeSessionQueryPlan(uuid, deps),
    }),
    loader: ({ context: { queryClient, queries } }) => {
        prefetchPlan(queryClient, queries);
    },
    validateSearch: sessionSearchSchema,
    // oxlint-disable-next-line eslint/no-use-before-define
    component: RouteComponent,
});

const RouterLinkIconButton = createLink(IconButton);
const RouterLinkToggleButton = createLink(ToggleButton);

interface SessionsProps {
    monthHistory: HistoryRequest;
    monthSessions: SessionsRequest;
    gamemode: GamemodeKey;
    stat: StatKey;
    tableMode: "total" | "rate";
    showExtrapolatedSessions: boolean;
}

// Maps a stat's trend sentiment to the MUI colour used for its value/icon.
const SENTIMENT_COLOR: Record<TrendSentiment, SvgIconOwnProps["color"]> = {
    good: "success",
    bad: "error",
    neutral: undefined,
};

const isLinearStat = (stat: StatKey) => {
    return !["fkdr", "kdr", "bblr", "wlr", "index", "winrate"].includes(stat);
};

const getRelatedStats = (stat: StatKey): StatKey[] => {
    switch (stat) {
        case "fkdr": {
            return ["finalKills", "finalDeaths"];
        }
        case "kdr": {
            return ["kills", "deaths"];
        }
        case "bblr": {
            return ["bedsBroken", "bedsLost"];
        }
        case "wlr": {
            return ["wins", "losses"];
        }
        case "winrate": {
            return ["wins", "gamesPlayed"];
        }
        case "index": {
            return ["finalKills", "finalDeaths", "stars"];
        }
        default: {
            return [];
        }
    }
};

const Sessions: React.FC<SessionsProps> = ({
    monthHistory,
    monthSessions,
    gamemode,
    stat,
    tableMode,
    showExtrapolatedSessions,
}) => {
    const navigate = useNavigate();
    const assume = useAssume();

    const { uuid, start, end } = monthHistory;

    const { data: history } = useQuery(monthHistory.options);

    const { data: flashlightSessions } = useQuery(monthSessions.options);

    const renderHeader = (showExtrapolatedToggle?: React.ReactNode) => (
        <Stack
            direction="row"
            sx={{
                gap: 1,
                alignItems: "center",
                justifyContent: "space-between",
            }}
        >
            <Stack
                direction="row"
                sx={{
                    gap: 1,
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                <Typography variant="subtitle2">Sessions</Typography>
                <Tooltip title="Sessions are automatically recorded when using the Prism Overlay. Users who have disabled 'Online Game Stats' in the settings, or are not using the Prism Overlay may have weird or missing sessions.">
                    <InfoOutlined fontSize="small" />
                </Tooltip>
            </Stack>
            <Stack
                direction="row"
                sx={{
                    gap: 3,
                    alignItems: "center",
                }}
            >
                {showExtrapolatedToggle}
                <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={tableMode}
                    aria-label="Session table mode"
                >
                    <RouterLinkToggleButton
                        value="total"
                        from="/session/$uuid"
                        to="/session/$uuid"
                        search={(oldSearch) => ({
                            ...oldSearch,
                            sessionTableMode: "total",
                        })}
                    >
                        Total
                    </RouterLinkToggleButton>
                    <RouterLinkToggleButton
                        value="rate"
                        from="/session/$uuid"
                        to="/session/$uuid"
                        search={(oldSearch) => ({
                            ...oldSearch,
                            sessionTableMode: "rate",
                        })}
                    >
                        Rate (/hour)
                    </RouterLinkToggleButton>
                </ToggleButtonGroup>
            </Stack>
        </Stack>
    );

    if (flashlightSessions === undefined) {
        return (
            <Card
                variant="outlined"
                sx={{ height: "100%", flexGrow: 1, overflow: "scroll" }}
            >
                <CardContent>
                    {renderHeader()}
                    <Skeleton variant="rounded" height={120} sx={{ mt: 2 }} />
                </CardContent>
            </Card>
        );
    }

    const allSessions = addExtrapolatedSessions(flashlightSessions, history);
    const sessions = showExtrapolatedSessions
        ? allSessions
        : allSessions.filter((session) => !session.extrapolated);

    if (sessions.length === 0) {
        return (
            <Card
                variant="outlined"
                sx={{ height: "100%", flexGrow: 1, overflow: "scroll" }}
            >
                <CardContent>
                    {renderHeader()}
                    <Stack
                        direction="row"
                        sx={{
                            gap: 0.5,
                            alignItems: "center",
                        }}
                    >
                        <Tooltip title="The player has no recorded sessions with the Prism overlay in the given time interval. They have either not played, or played without using the Prism Overlay.">
                            <Info color="error" fontSize="small" />
                        </Tooltip>
                        <Typography variant="body2">No sessions found</Typography>
                    </Stack>
                </CardContent>
            </Card>
        );
    }

    const labelSuffix = tableMode === "rate" ? "/hour" : "";

    const statAlreadyIncluded = (statKey: StatKey) =>
        ["gamesPlayed", "wins"].includes(statKey);

    const hasExtrapolatedSessions = allSessions.some((session) => session.extrapolated);
    const willShowExtrapolatedSessions =
        hasExtrapolatedSessions && showExtrapolatedSessions;
    const hasNonConsecutiveSessions = sessions.some((session) => !session.consecutive);

    return (
        <Card
            variant="outlined"
            sx={{ height: "100%", flexGrow: 1, overflow: "scroll" }}
        >
            <CardContent>
                <Stack
                    sx={{
                        gap: 1,
                    }}
                >
                    {renderHeader(
                        hasExtrapolatedSessions ? (
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={showExtrapolatedSessions}
                                        onChange={(_, checked) => {
                                            void (async () => {
                                                try {
                                                    await navigate({
                                                        from: "/session/$uuid",
                                                        to: "/session/$uuid",
                                                        search: (oldSearch) => ({
                                                            ...oldSearch,
                                                            showExtrapolatedSessions:
                                                                checked,
                                                        }),
                                                    });
                                                } catch (error: unknown) {
                                                    captureException(error, {
                                                        tags: {
                                                            param: "showExtrapolatedSessions",
                                                        },
                                                        extra: {
                                                            message:
                                                                "Failed to update search params",
                                                            showExtrapolatedSessions:
                                                                checked,
                                                        },
                                                    });
                                                }
                                            })();
                                        }}
                                    />
                                }
                                label={
                                    <Stack
                                        direction="row"
                                        sx={{
                                            gap: 1,
                                            alignItems: "center",
                                        }}
                                    >
                                        <Typography
                                            variant="body2"
                                            color="textSecondary"
                                        >
                                            Add missing data
                                        </Typography>
                                        <Tooltip title="Show the player's stats between sessions recorded by the Prism Overlay. This data may include stats from multiple sessions, and the duration may be incorrect.">
                                            <InfoOutlined fontSize="small" />
                                        </Tooltip>
                                    </Stack>
                                }
                                labelPlacement="start"
                            />
                        ) : undefined,
                    )}
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    {(willShowExtrapolatedSessions ||
                                        hasNonConsecutiveSessions) && (
                                        // Cell for extrapolated/non-consecutive info icons
                                        <TableCell
                                            style={{
                                                width: 20,
                                            }}
                                        />
                                    )}
                                    {/* Cell for the detail-page magnifying-glass icon */}
                                    <TableCell padding="none" style={{ width: 1 }} />
                                    <TableCell>
                                        <Typography variant="subtitle2">
                                            Start
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="right">
                                        <Typography variant="subtitle2">
                                            Duration
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="right">
                                        <Typography variant="subtitle2">
                                            {`${getShortStatLabel(
                                                "gamesPlayed",
                                                true,
                                            )}${labelSuffix}`}
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="right">
                                        <Typography variant="subtitle2">
                                            {`${getShortStatLabel("wins", true)}${labelSuffix}`}
                                        </Typography>
                                    </TableCell>
                                    {!statAlreadyIncluded(stat) && (
                                        <TableCell align="right">
                                            <Typography variant="subtitle2">
                                                {`${getShortStatLabel(stat, true)}${isLinearStat(stat) ? labelSuffix : ""}`}
                                            </Typography>
                                        </TableCell>
                                    )}
                                    {getRelatedStats(stat)
                                        .filter(
                                            (relatedStat) =>
                                                !statAlreadyIncluded(relatedStat),
                                        )
                                        .map((relatedStat) => (
                                            <TableCell align="right" key={relatedStat}>
                                                <Typography variant="subtitle2">
                                                    {`${getShortStatLabel(relatedStat, true)}${isLinearStat(relatedStat) ? labelSuffix : ""}`}
                                                </Typography>
                                            </TableCell>
                                        ))}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {sessions
                                    .map((session) => {
                                        const durationHours =
                                            (session.end.queriedAt.getTime() -
                                                session.start.queriedAt.getTime()) /
                                            MS_PER_HOUR;

                                        if (durationHours <= 0) {
                                            assume(
                                                false,
                                                "Session duration is non-positive",
                                                () => ({
                                                    durationHours,
                                                    sessionStart:
                                                        session.start.queriedAt,
                                                    sessionEnd: session.end.queriedAt,
                                                    uuid,
                                                    start,
                                                    end,
                                                    gamemode,
                                                    stat,
                                                }),
                                            );
                                            return null;
                                        }

                                        const renderStat = (statKey: StatKey) => {
                                            const value = computeStat(
                                                session.end,
                                                gamemode,
                                                statKey,
                                                "session",
                                                [session.start, session.end],
                                            );
                                            if (value === null) {
                                                return "N/A";
                                            }

                                            if (
                                                tableMode === "rate" &&
                                                isLinearStat(statKey)
                                            ) {
                                                const formattedNumber = (
                                                    value / durationHours
                                                ).toLocaleString(undefined, {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                });
                                                if (session.extrapolated) {
                                                    return `> ${formattedNumber}`;
                                                }
                                                return formattedNumber;
                                            }

                                            return formatStatValue(statKey, value, {
                                                precision: "detailed",
                                            });
                                        };

                                        const textColor: TypographyOwnProps["color"] =
                                            session.extrapolated
                                                ? "textSecondary"
                                                : undefined;

                                        return (
                                            <TableRow
                                                key={session.start.queriedAt.toString()}
                                            >
                                                {(willShowExtrapolatedSessions ||
                                                    hasNonConsecutiveSessions) && (
                                                    // Cell for extrapolated/non-consecutive info icons
                                                    <TableCell
                                                        style={{
                                                            width: 20,
                                                        }}
                                                        align="center"
                                                    >
                                                        {session.extrapolated && (
                                                            <Tooltip title="The Prism Overlay has not recorded the player's stats during this time. This may be due to the player not using the Prism Overlay; therefore the duration may be incorrect, and the data may include stats from multiple sessions.">
                                                                <InfoOutlined fontSize="small" />
                                                            </Tooltip>
                                                        )}
                                                        {!session.consecutive &&
                                                            !session.extrapolated && (
                                                                <Tooltip title='The Prism Overlay has not recorded the result of every game during this time. This may be due to the player not using the Prism Overlay or having disabled "Online Game Stats" in their Hypixel settings; therefore the duration may be incorrect, and the session may include stats from multiple sessions.'>
                                                                    <Warning
                                                                        color="warning"
                                                                        fontSize="small"
                                                                    />
                                                                </Tooltip>
                                                            )}
                                                    </TableCell>
                                                )}
                                                <TableCell
                                                    padding="none"
                                                    style={{ width: 1 }}
                                                    align="center"
                                                >
                                                    {!session.extrapolated && (
                                                        <Tooltip title="Open session detail">
                                                            <RouterLinkIconButton
                                                                size="small"
                                                                color="primary"
                                                                sx={{ p: 0.25 }}
                                                                from="/session/$uuid"
                                                                to="/session/$uuid/detail"
                                                                params={{ uuid }}
                                                                search={{
                                                                    date: session.start
                                                                        .queriedAt,
                                                                }}
                                                            >
                                                                <Search fontSize="small" />
                                                            </RouterLinkIconButton>
                                                        </Tooltip>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Typography
                                                        variant="body1"
                                                        color={textColor}
                                                    >
                                                        {session.start.queriedAt.toLocaleString(
                                                            undefined,
                                                            {
                                                                day: "2-digit",
                                                                month: "short",
                                                                year: "numeric",
                                                                hour: "2-digit",
                                                                minute: "2-digit",
                                                            },
                                                        )}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell align="right">
                                                    <Typography
                                                        variant="body1"
                                                        color={textColor}
                                                    >
                                                        {session.extrapolated
                                                            ? "< "
                                                            : undefined}
                                                        {formatDuration(
                                                            session.end.queriedAt.getTime() -
                                                                session.start.queriedAt.getTime(),
                                                        )}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell align="right">
                                                    <Typography
                                                        variant="body1"
                                                        color={textColor}
                                                    >
                                                        {renderStat("gamesPlayed")}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell align="right">
                                                    <Typography
                                                        variant="body1"
                                                        color={textColor}
                                                    >
                                                        {renderStat("wins")}
                                                    </Typography>
                                                </TableCell>
                                                {!statAlreadyIncluded(stat) && (
                                                    <TableCell align="right">
                                                        <Typography
                                                            variant="body1"
                                                            color={textColor}
                                                        >
                                                            {renderStat(stat)}
                                                        </Typography>
                                                    </TableCell>
                                                )}
                                                {getRelatedStats(stat)
                                                    .filter(
                                                        (relatedStat) =>
                                                            !statAlreadyIncluded(
                                                                relatedStat,
                                                            ),
                                                    )
                                                    .map((relatedStat) => (
                                                        <TableCell
                                                            align="right"
                                                            key={relatedStat}
                                                        >
                                                            <Typography
                                                                variant="body1"
                                                                color={textColor}
                                                            >
                                                                {renderStat(
                                                                    relatedStat,
                                                                )}
                                                            </Typography>
                                                        </TableCell>
                                                    ))}
                                            </TableRow>
                                        );
                                    })
                                    .toReversed()}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Stack>
            </CardContent>
        </Card>
    );
};

interface SessionStatCardProps {
    // Endpoints of the interval for the headline value, and the curve between
    // them for the sparkline. Both describe the same window.
    statHistory: HistoryRequest;
    chartHistory: HistoryRequest;
    intervalType: "day" | "week" | "month";
    stat: StatKey;
    gamemode: GamemodeKey;
}

const SessionStatCard: React.FC<SessionStatCardProps> = ({
    statHistory,
    chartHistory,
    intervalType,
    stat,
    gamemode,
}) => {
    const { data: queryData } = useQuery(statHistory.options);

    // The window this card describes. Both requests were built from it.
    const timeInterval: TimeInterval = statHistory;

    const intervalTypeName = {
        day: "Daily",
        week: "Weekly",
        month: "Monthly",
    }[intervalType];

    const cardTitle = (
        <Stack
            direction="row"
            sx={{
                gap: 0.5,
                alignItems: "center",
                justifyContent: "space-between",
            }}
        >
            <Typography variant="subtitle2">
                {`${intervalTypeName} ${getGamemodeLabel(gamemode)} ${getFullStatLabel(stat)}`}
            </Typography>
            <Tooltip
                title={`Time interval: ${timeInterval.start.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} → ${timeInterval.end.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`}
            >
                <InfoOutlined fontSize="small" />
            </Tooltip>
        </Stack>
    );

    if (queryData === undefined) {
        return (
            <Card variant="outlined" sx={{ height: "100%", flexGrow: 1 }}>
                <CardContent
                    sx={{
                        height: "100%",
                        padding: 2,
                        "&:last-child": { pb: 2 },
                    }}
                >
                    <Stack
                        sx={{
                            gap: 1,
                            justifyContent: "space-between",
                            height: "100%",
                        }}
                    >
                        {cardTitle}
                        <Stack>
                            <Stack
                                direction="row"
                                sx={{
                                    gap: 1,
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                }}
                            >
                                <Typography variant="body1">
                                    <Skeleton variant="text" width={50} />
                                </Typography>
                                <Tooltip title={<Skeleton variant="text" />}>
                                    <Stack
                                        direction="row"
                                        sx={{
                                            gap: 0.5,
                                            alignItems: "center",
                                        }}
                                    >
                                        <Typography variant="caption" color={undefined}>
                                            <Skeleton variant="text" width={30} />
                                        </Typography>
                                        <TrendIcon
                                            direction="flat"
                                            color={undefined}
                                            fontSize="small"
                                        />
                                    </Stack>
                                </Tooltip>
                            </Stack>
                            <SimpleHistoryChart
                                request={chartHistory}
                                gamemode={gamemode}
                                stat={stat}
                                variant="session"
                            />
                        </Stack>
                    </Stack>
                </CardContent>
            </Card>
        );
    }

    if (queryData.length === 0) {
        return (
            <Card variant="outlined" sx={{ height: "100%", flexGrow: 1 }}>
                <CardContent
                    sx={{
                        height: "100%",
                        padding: 2,
                        "&:last-child": { pb: 2 },
                    }}
                >
                    <Stack
                        sx={{
                            gap: 1,
                            justifyContent: "space-between",
                            height: "100%",
                        }}
                    >
                        {cardTitle}
                        <Stack>
                            <Stack
                                direction="row"
                                sx={{
                                    gap: 0.5,
                                    alignItems: "center",
                                }}
                            >
                                <Tooltip title="The player has not recorded any stats with the Prism Overlay in the given time interval. They have either not played, or played without using the Prism Overlay.">
                                    <Info color="error" fontSize="small" />
                                </Tooltip>
                                <Typography variant="body1">No data found</Typography>
                            </Stack>
                            <SimpleHistoryChart
                                request={chartHistory}
                                gamemode={gamemode}
                                stat={stat}
                                variant="session"
                            />
                        </Stack>
                    </Stack>
                </CardContent>
            </Card>
        );
    }

    let data = queryData;
    if (data.length === 1) {
        // Hack to show data in the same way as when there are two data points
        data = [data[0], data[0]];
    }

    if (data.length > 2) {
        throw new Error("Expected at most 2 data points");
    }

    const [start, end] = data;

    const startValue = computeStat(start, gamemode, stat, "overall", data);
    const endValue = computeStat(end, gamemode, stat, "overall", data);
    const sessionValue = computeStat(end, gamemode, stat, "session", data);

    // Only different than sessionValue for complex stats (e.g. fkdr)
    const diff =
        endValue !== null && startValue !== null ? endValue - startValue : null;

    if (
        startValue === null ||
        endValue === null ||
        diff === null ||
        sessionValue === null
    ) {
        return `Hypixel API disabled for ${getFullStatLabel(stat)}.`;
    }

    const trendDirection = getTrendDirection(startValue, endValue);
    const trendColor = SENTIMENT_COLOR[getTrendSentiment(stat, trendDirection)];

    return (
        <Card variant="outlined" sx={{ height: "100%", flexGrow: 1 }}>
            <CardContent sx={{ height: "100%", padding: 2, "&:last-child": { pb: 2 } }}>
                <Stack
                    sx={{
                        gap: 1,
                        justifyContent: "space-between",
                        height: "100%",
                    }}
                >
                    {cardTitle}
                    <Stack>
                        <Stack
                            direction="row"
                            sx={{
                                gap: 1,
                                alignItems: "center",
                                justifyContent: "space-between",
                            }}
                        >
                            <Typography variant="body1">
                                {formatStatValue(stat, sessionValue, {
                                    precision: "detailed",
                                })}
                            </Typography>
                            <Tooltip
                                title={`${formatStatValue(stat, startValue, {
                                    precision: "detailed",
                                })} → ${formatStatValue(stat, endValue, {
                                    precision: "detailed",
                                })}`}
                            >
                                <Stack
                                    direction="row"
                                    sx={{
                                        gap: 0.5,
                                        alignItems: "center",
                                    }}
                                >
                                    <Typography variant="caption" color={trendColor}>
                                        {formatStatValue(stat, diff, {
                                            signDisplay: "always",
                                        })}
                                    </Typography>
                                    <TrendIcon
                                        direction={trendDirection}
                                        color={trendColor}
                                        fontSize="small"
                                    />
                                </Stack>
                            </Tooltip>
                        </Stack>
                        <SimpleHistoryChart
                            request={chartHistory}
                            gamemode={gamemode}
                            stat={stat}
                            variant="session"
                        />
                    </Stack>
                </Stack>
            </CardContent>
        </Card>
    );
};

interface ProgressionValueAndMilestoneProps {
    progression: StatProgression;
}

const ProgressionValueAndMilestone: React.FC<ProgressionValueAndMilestoneProps> = ({
    progression,
}) => {
    const renderValues = (
        endValue: number,
        nextMilestoneValue: number,
        renderValue: (value: number) => React.ReactNode,
        stat: StatKey,
    ) => {
        const direction = getTrendDirection(endValue, nextMilestoneValue);
        const color = SENTIMENT_COLOR[getTrendSentiment(stat, direction)];

        return (
            <Stack
                direction="row"
                sx={{
                    gap: 0.5,
                    alignItems: "center",
                }}
            >
                {renderValue(endValue)}
                <TrendIcon direction={direction} color={color} fontSize="medium" />
                {renderValue(nextMilestoneValue)}
            </Stack>
        );
    };
    return renderValues(
        progression.endValue,
        progression.nextMilestoneValue,
        (value) => (
            <Typography variant="body1">
                {formatStatValue(progression.stat, value)}
            </Typography>
        ),
        progression.stat,
    );
};

interface ProgressionCaptionProps {
    progression: StatProgression;
}

const ProgressionCaption: React.FC<ProgressionCaptionProps> = ({ progression }) => {
    switch (progression.stat) {
        case "stars": {
            return (
                <Typography variant="caption">
                    {`${progression.progressPerDay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${getShortStatLabel(progression.stat)}/day`}
                </Typography>
            );
        }
        // TODO: Join all quotient cases by returning the dividend and divisor stat names
        case "fkdr": {
            return (
                <Typography variant="caption">
                    {`${progression.progressPerDay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/day (${progression.sessionQuotient.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} long-time ${getShortStatLabel("fkdr")}, ${progression.dividendPerDay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${getShortStatLabel("finalKills")}/day, ${progression.divisorPerDay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${getShortStatLabel("finalDeaths")}/day)`}
                </Typography>
            );
        }
        case "kdr": {
            return (
                <Typography variant="caption">
                    {`${progression.progressPerDay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/day (${progression.sessionQuotient.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} long-time ${getShortStatLabel("kdr")}, ${progression.dividendPerDay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${getShortStatLabel("kills")}/day, ${progression.divisorPerDay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${getShortStatLabel("deaths")}/day)`}
                </Typography>
            );
        }
        case "bblr": {
            return (
                <Typography variant="caption">
                    {`${progression.progressPerDay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/day (${progression.sessionQuotient.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} long-time ${getShortStatLabel("bblr")}, ${progression.dividendPerDay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${getShortStatLabel("bedsBroken")}/day, ${progression.divisorPerDay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${getShortStatLabel("bedsLost")}/day)`}
                </Typography>
            );
        }
        case "wlr": {
            return (
                <Typography variant="caption">
                    {`${progression.progressPerDay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/day (${progression.sessionQuotient.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} long-time ${getShortStatLabel("wlr")}, ${progression.dividendPerDay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${getShortStatLabel("wins")}/day, ${progression.divisorPerDay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${getShortStatLabel("losses")}/day)`}
                </Typography>
            );
        }
        case "winrate": {
            // progressPerDay and sessionQuotient are fractions -> render as %.
            // dividendPerDay (wins/day) and divisorPerDay (games/day) are
            // fractional rates, not winrates -> keep the plain 2dp number format.
            return (
                <Typography variant="caption">
                    {`${formatStatValue("winrate", progression.progressPerDay)}/day (${formatStatValue("winrate", progression.sessionQuotient)} long-time ${getShortStatLabel("winrate")}, ${progression.dividendPerDay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${getShortStatLabel("wins")}/day, ${progression.divisorPerDay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${getShortStatLabel("gamesPlayed")}/day)`}
                </Typography>
            );
        }
        case "index": {
            return (
                <Typography variant="caption">
                    {`${progression.progressPerDay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${getShortStatLabel("index")}/day (${progression.sessionFkdr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} long-time ${getShortStatLabel("fkdr")}, ${progression.starsPerDay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${getShortStatLabel("stars")}/day, ${progression.finalKillsPerDay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${getShortStatLabel("finalKills")}/day, ${progression.finalDeathsPerDay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${getShortStatLabel("finalDeaths")}/day)`}
                </Typography>
            );
        }
        case "experience":
        case "winstreak":
        case "gamesPlayed":
        case "wins":
        case "losses":
        case "bedsBroken":
        case "bedsLost":
        case "finalKills":
        case "finalDeaths":
        case "kills":
        case "deaths": {
            return (
                <Typography variant="caption">
                    {`${progression.progressPerDay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${getShortStatLabel(progression.stat)}/day`}
                </Typography>
            );
        }
        default: {
            progression satisfies never;
        }
    }
};

interface StatProgressionCardProps {
    tracking: HistoryRequest;
    stat: StatKey;
    gamemode: GamemodeKey;
}

const formatDays = (days: number): string => {
    if (days < 1) {
        const hours = Math.round(days * 24);
        if (hours < 1) {
            return "<1 hour";
        }
        const plural = hours !== 1 ? "s" : "";
        return `${Math.round(days * 24).toString()} hour${plural}`;
    }
    if (days < 30) {
        const plural = days !== 1 ? "s" : "";
        return `${Math.round(days).toString()} day${plural}`;
    }
    if (days < 365) {
        const months = Math.round(days / 30);
        const plural = months !== 1 ? "s" : "";
        return `${months.toString()} month${plural}`;
    }

    const years = Math.round(days / 365);
    const plural = years !== 1 ? "s" : "";
    return `${years.toString()} year${plural}`;
};

const StatProgressionCard: React.FC<StatProgressionCardProps> = ({
    tracking,
    stat,
    gamemode,
}) => {
    // History data to calculate stat progression speed
    const { data: trackingHistory } = useQuery(tracking.options);

    if (stat === "winstreak") {
        return null;
    }

    const noDataComponent = (
        <Card variant="outlined" sx={{ height: "100%" }}>
            <CardContent>
                <Typography variant="subtitle2">
                    {`${getGamemodeLabel(gamemode, true)} ${getFullStatLabel(stat)} milestone progress`}
                </Typography>

                <Typography variant="body1">
                    <Skeleton variant="text" width={120} />
                </Typography>

                <Stack
                    direction="row"
                    sx={{
                        gap: 1,
                        alignItems: "center",
                        justifyContent: "space-between",
                    }}
                >
                    <Typography variant="body1">
                        <Skeleton variant="text" width={200} />
                    </Typography>

                    <Typography variant="caption">
                        <Skeleton variant="text" width={240} />
                    </Typography>
                </Stack>
            </CardContent>
        </Card>
    );

    if (trackingHistory === undefined || trackingHistory.length === 0) {
        return noDataComponent;
    }

    const currentDate = tracking.end;
    const now = new Date();

    const currentDateIsToday =
        now.getFullYear() === currentDate.getFullYear() &&
        now.getMonth() === currentDate.getMonth() &&
        now.getDate() === currentDate.getDate();
    const referenceDate = currentDateIsToday ? now : currentDate;

    const progression = computeStatProgression(
        trackingHistory,
        tracking.end,
        stat,
        gamemode,
    );

    if (progression.error) {
        switch (progression.reason) {
            case ERR_TRACKING_STARTED: {
                return (
                    <Card variant="outlined" sx={{ height: "100%" }}>
                        <CardContent>
                            <Typography variant="subtitle2">
                                {`${getGamemodeLabel(gamemode, true)} ${getFullStatLabel(stat)} milestone progress`}
                            </Typography>
                            <Stack
                                direction="row"
                                sx={{
                                    pt: 1,
                                    gap: 1,
                                    alignItems: "center",
                                }}
                            >
                                <Tooltip title="The player's stats have been recorded by the Prism Overlay. Come back later to see their updated stat progression.">
                                    <Info color="info" fontSize="small" />
                                </Tooltip>
                                <Typography variant="body2">
                                    Tracking started!
                                </Typography>
                            </Stack>
                        </CardContent>
                    </Card>
                );
            }
            case ERR_NO_DATA: {
                return noDataComponent;
            }
        }

        return (
            <Card variant="outlined" sx={{ height: "100%" }}>
                <CardContent>
                    <Typography variant="subtitle2">
                        {`${getGamemodeLabel(gamemode, true)} ${getFullStatLabel(stat)} milestone progress`}
                    </Typography>
                    <Stack
                        direction="row"
                        sx={{
                            pt: 1,
                            gap: 1,
                            alignItems: "center",
                        }}
                    >
                        <Info color="error" fontSize="small" />
                        <Typography variant="body2">{progression.reason}</Typography>
                    </Stack>
                </CardContent>
            </Card>
        );
    }

    const projectedMilestoneDate = new Date(
        referenceDate.getTime() + progression.daysUntilMilestone * MS_PER_DAY,
    );

    const daysUntilMilestoneFromNow =
        (projectedMilestoneDate.getTime() - now.getTime()) / MS_PER_DAY;

    return (
        <Card variant="outlined" sx={{ height: "100%" }}>
            <CardContent>
                <Typography variant="subtitle2">
                    {`${getGamemodeLabel(gamemode, true)} ${getFullStatLabel(stat)} milestone progress`}
                </Typography>

                <ProgressionValueAndMilestone progression={progression} />
                <Stack
                    direction="row"
                    sx={{
                        gap: 1,
                        alignItems: "center",
                        justifyContent: "space-between",
                    }}
                >
                    <Typography variant="body1">
                        {Number.isFinite(progression.daysUntilMilestone)
                            ? `Expected to reach: ${projectedMilestoneDate.toLocaleDateString(
                                  undefined,
                                  {
                                      dateStyle: "medium",
                                  },
                              )} (${daysUntilMilestoneFromNow >= 0 ? "in " : ""}${formatDays(Math.abs(daysUntilMilestoneFromNow))}${daysUntilMilestoneFromNow < 0 ? " ago" : ""})`
                            : `Expected to reach: Never (long-time ${getShortStatLabel(stat === "index" ? "fkdr" : stat)} too ${progression.trendingUpward ? "low" : "high"})`}
                    </Typography>

                    <Stack
                        direction="row"
                        sx={{
                            gap: 0.5,
                            alignItems: "center",
                            justifyContent: "space-between",
                        }}
                    >
                        <ProgressionCaption progression={progression} />
                        <Tooltip
                            title={`Based on stats from ${progression.trackingDataTimeInterval.start.toLocaleString(undefined, { dateStyle: "medium" })} to ${progression.trackingDataTimeInterval.end.toLocaleString(undefined, { dateStyle: "medium" })}`}
                        >
                            <InfoOutlined fontSize="small" />
                        </Tooltip>
                    </Stack>
                </Stack>
            </CardContent>
        </Card>
    );
};

function RouteComponent() {
    const { uuid: rawUUID } = Route.useParams();
    const uuid = normalizeUUID(rawUUID);

    const {
        gamemode,
        stat,
        variantSelection,
        sessionTableMode,
        showExtrapolatedSessions,
    } = Route.useSearch();

    const { timeIntervalDefinition } = Route.useLoaderDeps();
    const { queries } = Route.useRouteContext();
    const navigate = Route.useNavigate();
    const uuidToUsername = useUUIDToUsername(uuid !== null ? [uuid] : []);
    const username = uuid !== null ? uuidToUsername[uuid] : undefined;
    const { visitPlayer } = usePlayerVisits();

    // Register visits for player on page load
    const initialUUIDRef = React.useRef(uuid);
    const initialVisitPlayerRef = React.useRef(visitPlayer);
    React.useEffect(() => {
        if (initialUUIDRef.current === null) return;
        initialVisitPlayerRef.current(initialUUIDRef.current);
    }, []);

    if (uuid === null) {
        return <Navigate to="/session" replace />;
    }

    if (uuid !== rawUUID) {
        // Redirect to the normalized UUID
        return (
            <Navigate
                from="/session/$uuid"
                to="/session/$uuid"
                replace
                params={{ uuid }}
                search={(oldSearch) => ({
                    ...oldSearch,
                    uuid,
                })}
            />
        );
    }

    const variants =
        variantSelection === "both"
            ? (["session", "overall"] as const)
            : ([variantSelection] as const);

    const cardSize = {
        xs: 6,
        sm: 4,
    };

    // Stats where we want to show the session value AND the all-time value
    // These are stats where the session and all-time values are usually close
    const statsWhereSessionIsCloseToAllTime: StatKey[] = [
        "fkdr",
        "kdr",
        "bblr",
        "wlr",
        "winrate",
    ];

    return (
        <Stack spacing={1}>
            <meta
                name="description"
                content={`View ${username ?? "a player"}'s session stats, including daily, weekly, and monthly stats, as well as a progression towards stat milestones, and individual session breakdowns.`}
            />
            <link rel="canonical" href={`https://prismoverlay.com/session/${uuid}`} />
            <UserSearch
                onSubmit={(newUUID) => {
                    visitPlayer(newUUID);
                    void (async () => {
                        try {
                            await navigate({
                                params: { uuid: newUUID },
                                search: (oldSearch) => oldSearch,
                            });
                        } catch (error: unknown) {
                            captureException(error, {
                                tags: {
                                    param: "uuid",
                                },
                                extra: {
                                    message: "Failed to update search params",
                                    uuid: newUUID,
                                },
                            });
                        }
                    })();
                }}
            />
            <Stack
                direction="row"
                sx={{
                    gap: 1,
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                <Stack
                    direction="row"
                    sx={{
                        alignItems: "center",
                        gap: 1,
                    }}
                >
                    <PlayerHead uuid={uuid} username={username} variant="face" />
                    {username === undefined ? (
                        <Stack
                            direction="row"
                            sx={{
                                alignItems: "center",
                            }}
                        >
                            <Skeleton variant="rounded" width={60} />
                            <Typography variant="h6">&apos;s session stats</Typography>
                        </Stack>
                    ) : (
                        <Typography variant="h6">{`${username}'s session stats`}</Typography>
                    )}
                </Stack>
                <TimeIntervalPicker
                    intervalDefinition={timeIntervalDefinition}
                    onIntervalChange={(newInterval) => {
                        void (async () => {
                            try {
                                await navigate({
                                    search: (oldSearch) => ({
                                        ...oldSearch,
                                        timeIntervalDefinition: newInterval,
                                    }),
                                });
                            } catch (error: unknown) {
                                captureException(error, {
                                    tags: {
                                        param: "timeIntervalDefinition",
                                    },
                                    extra: {
                                        message: "Failed to update search params",
                                        timeIntervalDefinition: newInterval,
                                    },
                                });
                            }
                        })();
                    }}
                />
            </Stack>
            <Stack
                direction="row"
                sx={{
                    gap: 1,
                }}
            >
                <Select
                    value={gamemode}
                    label="Gamemode"
                    aria-label="Gamemode"
                    fullWidth
                    onChange={(event) => {
                        const newGamemode = event.target.value;
                        void (async () => {
                            try {
                                await navigate({
                                    search: (oldSearch) => ({
                                        ...oldSearch,
                                        gamemode: newGamemode,
                                    }),
                                });
                            } catch (error: unknown) {
                                captureException(error, {
                                    tags: {
                                        param: "gamemode",
                                    },
                                    extra: {
                                        message: "Failed to update search params",
                                        gamemode: newGamemode,
                                    },
                                });
                            }
                        })();
                    }}
                >
                    {ALL_GAMEMODE_KEYS.map((gamemodeKey) => (
                        <MenuItem key={gamemodeKey} value={gamemodeKey}>
                            {getGamemodeLabel(gamemodeKey, true)}
                        </MenuItem>
                    ))}
                </Select>
                <Select
                    value={stat}
                    label="Stat"
                    aria-label="Stat"
                    fullWidth
                    onChange={(event) => {
                        const newStat = event.target.value;
                        void (async () => {
                            try {
                                await navigate({
                                    search: (oldSearch) => ({
                                        ...oldSearch,
                                        stat: newStat,
                                        variantSelection:
                                            statsWhereSessionIsCloseToAllTime.includes(
                                                newStat,
                                            )
                                                ? "both"
                                                : "session",
                                    }),
                                });
                            } catch (error: unknown) {
                                captureException(error, {
                                    tags: {
                                        param: "stat",
                                    },
                                    extra: {
                                        message: "Failed to update search params",
                                        stat: newStat,
                                    },
                                });
                            }
                        })();
                    }}
                >
                    {ALL_STAT_KEYS.map((statKey) => (
                        <MenuItem key={statKey} value={statKey}>
                            {getFullStatLabel(statKey, true)}
                        </MenuItem>
                    ))}
                </Select>
            </Stack>
            <ChartSynchronizerProvider
                // Identity of the sparklines being synchronized: the queries
                // they read (player and window) plus what they plot.
                queryKey={JSON.stringify([
                    queries.dayChart.options.queryKey,
                    queries.weekChart.options.queryKey,
                    queries.monthChart.options.queryKey,
                    gamemode,
                    stat,
                ])}
            >
                <Grid container spacing={1}>
                    <Grid size={cardSize}>
                        <SessionStatCard
                            statHistory={queries.dayStat}
                            chartHistory={queries.dayChart}
                            intervalType="day"
                            gamemode={gamemode}
                            stat={stat}
                        />
                    </Grid>
                    <Grid size={cardSize}>
                        <SessionStatCard
                            statHistory={queries.weekStat}
                            chartHistory={queries.weekChart}
                            intervalType="week"
                            gamemode={gamemode}
                            stat={stat}
                        />
                    </Grid>
                    <Grid size={cardSize}>
                        <SessionStatCard
                            statHistory={queries.monthStat}
                            chartHistory={queries.monthChart}
                            intervalType="month"
                            gamemode={gamemode}
                            stat={stat}
                        />
                    </Grid>
                </Grid>
            </ChartSynchronizerProvider>
            <StatProgressionCard
                tracking={queries.tracking}
                gamemode={gamemode}
                stat={stat}
            />
            <Box>
                <Sessions
                    monthHistory={queries.monthStat}
                    monthSessions={queries.sessions}
                    gamemode={gamemode}
                    stat={stat}
                    tableMode={sessionTableMode}
                    showExtrapolatedSessions={showExtrapolatedSessions}
                />
            </Box>
            <Box>
                <Card variant="outlined">
                    <CardContent>
                        <Stack
                            direction="row"
                            sx={{
                                gap: 1,
                                alignItems: "center",
                                justifyContent: "space-between",
                            }}
                        >
                            <Stack
                                direction="row"
                                sx={{
                                    gap: 1,
                                    alignItems: "center",
                                }}
                            >
                                {username === undefined ? (
                                    <Stack
                                        direction="row"
                                        sx={{
                                            alignItems: "center",
                                        }}
                                    >
                                        <Skeleton variant="rounded" width={100} />
                                        <Typography variant="subtitle2">
                                            {`'s ${getFullStatLabel(stat)}`}
                                        </Typography>
                                    </Stack>
                                ) : (
                                    <Typography variant="subtitle2">{`${username}'s ${getFullStatLabel(stat)}`}</Typography>
                                )}
                                <Tooltip title="Show in history explorer">
                                    <RouterLinkIconButton
                                        size="small"
                                        color="primary"
                                        to="/history/explore"
                                        search={{
                                            uuids: [uuid],
                                            gamemodes: [gamemode],
                                            stats: [stat],
                                            variantSelection,
                                            start: queries.monthChart.start,
                                            end: queries.monthChart.end,
                                            limit: queries.monthChart.limit,
                                        }}
                                    >
                                        <QueryStats />
                                    </RouterLinkIconButton>
                                </Tooltip>
                            </Stack>
                            <ToggleButtonGroup
                                exclusive
                                size="small"
                                value={variantSelection}
                                aria-label="Stat chart variant selection"
                            >
                                <RouterLinkToggleButton
                                    value="overall"
                                    from="/session/$uuid"
                                    to="/session/$uuid"
                                    search={(oldSearch) => ({
                                        ...oldSearch,
                                        variantSelection: "overall",
                                    })}
                                    sx={{ textAlign: "center" }}
                                >
                                    {getVariantLabel("overall", true)}
                                </RouterLinkToggleButton>
                                <RouterLinkToggleButton
                                    value="session"
                                    from="/session/$uuid"
                                    to="/session/$uuid"
                                    search={(oldSearch) => ({
                                        ...oldSearch,
                                        variantSelection: "session",
                                    })}
                                    sx={{ textAlign: "center" }}
                                >
                                    {getVariantLabel("session", true)}
                                </RouterLinkToggleButton>
                                <RouterLinkToggleButton
                                    value="both"
                                    from="/session/$uuid"
                                    to="/session/$uuid"
                                    search={(oldSearch) => ({
                                        ...oldSearch,
                                        variantSelection: "both",
                                    })}
                                    sx={{ textAlign: "center" }}
                                >
                                    Both
                                </RouterLinkToggleButton>
                            </ToggleButtonGroup>
                        </Stack>
                        <Stack
                            sx={{
                                padding: 1,
                                height: { xs: 300, sm: 400, md: 500, xl: 600 },
                            }}
                        >
                            <HistoryChart
                                requests={[queries.monthChart]}
                                gamemodes={[gamemode]}
                                stats={[stat]}
                                variants={variants}
                            />
                        </Stack>
                    </CardContent>
                </Card>
            </Box>
        </Stack>
    );
}
