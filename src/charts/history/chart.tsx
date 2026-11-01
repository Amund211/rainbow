import { Box, Stack, Typography, useTheme } from "@mui/material";
import { areaY, defineChart, dot, lineY, rect } from "@tanstack/charts";
import { createChartCursor, cursorHost } from "@tanstack/charts/cursor";
import { decorative } from "@tanstack/charts/mark/decorative";
import { Chart } from "@tanstack/charts/react";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import { useQueries, useQuery } from "@tanstack/react-query";
import React from "react";

import { chartStyles, monotoneCurve } from "#charts/style.ts";
import { useSynchronizeCharts } from "#contexts/ChartSynchronizer/hooks.ts";
import { useNow } from "#hooks/useNow.ts";
import { getHistoryQueryOptions } from "#queries/history.ts";
import { useUUIDToUsername } from "#queries/username.ts";
import { formatStatValue } from "#stats/format.ts";
import type { GamemodeKey, StatKey, VariantKey } from "#stats/keys.ts";
import { getFullStatLabel, getGamemodeLabel, getVariantLabel } from "#stats/labels.ts";

import { generateChartData } from "./data.ts";
import type { ChartData } from "./data.ts";
import { makeDataKey } from "./dataKeys.ts";
import type { DataKey } from "./dataKeys.ts";

// Shared by every history chart so hovering one highlights the same time in the others.
const historyCursor = createChartCursor<number, number>();
const historyCursorBinding = {
    use: cursorHost,
    controller: historyCursor,
    mode: "focus",
    match: "x",
} as const;

// Spans the full plot height regardless of the data's y domain.
const FRAME_SCALE = {
    channel: "y",
    scale: scaleLinear().domain([0, 1]),
    axis: false,
} as const;

const futureMarker = (
    now: number,
    end: number,
    paint: Readonly<{ fill: string; stroke: string }>,
) =>
    decorative(
        rect(now < end ? [{ x1: now, x2: end }] : [], {
            x1: "x1",
            x2: "x2",
            y1: () => 0,
            y2: () => 1,
            yScale: "frame",
            fill: paint.fill,
            fillOpacity: 0.12,
            stroke: paint.stroke,
            inset: 0,
        }),
    );

// Mirrors Recharts' connectNulls: drop gaps instead of breaking the path.
const rowsWithValue = (chartData: ChartData, dataKey: DataKey): ChartData =>
    chartData.filter((row) => row[dataKey] !== null && row[dataKey] !== undefined);

// Dash patterns cycled through once the colour palette wraps, so overlapping
// series stay distinguishable.
const DASHES = ["0", "5 5", "10 5", "5 10", "5 2", "10 10"];

interface LineStyle {
    readonly stroke: string;
    readonly strokeDasharray: string;
}

type LineStyleFn = (gamemode: GamemodeKey, index: number) => LineStyle;

interface HistoryChartProps {
    start: Date;
    end: Date;
    uuids: readonly string[];
    gamemodes: readonly GamemodeKey[];
    stats: readonly StatKey[];
    variants: readonly VariantKey[];
    limit: number;
}

type TimeDenomination = "year" | "month" | "day" | "hour";

const getSmallestTimeDenomination = (
    startDate: Date,
    endDate: Date,
): TimeDenomination => {
    const differentYear = startDate.getFullYear() !== endDate.getFullYear();
    const differentMonth = startDate.getMonth() !== endDate.getMonth() || differentYear;
    const differentDay = startDate.getDate() !== endDate.getDate() || differentMonth;

    if (differentYear) {
        return "year";
    }
    if (differentMonth) {
        return "month";
    }
    if (differentDay) {
        return "day";
    }
    return "hour";
};

// string overrides all of these string unions, but we keep them here to be explicit about our intentions
// oxlint-disable-next-line @typescript-eslint/no-redundant-type-constituents
interface KeyConfig<T extends StatKey | GamemodeKey | VariantKey | string> {
    readonly value: T;
    readonly shown: boolean;
}

const contextAwareStatDisplayName = (
    uuid: KeyConfig<string>,
    stat: KeyConfig<StatKey>,
    gamemode: KeyConfig<GamemodeKey>,
    variant: KeyConfig<VariantKey>,
    alwaysIncludePossessive = false,
): string => {
    if (!uuid.shown && !stat.shown && !gamemode.shown && !variant.shown) {
        return getFullStatLabel(stat.value, true);
    }

    const gamemodeShown =
        gamemode.shown &&
        gamemode.value !== "overall" &&
        (!stat.shown || (stat.value !== "stars" && stat.value !== "experience"));

    let displayName = "";
    if (uuid.shown) {
        if (
            !stat.shown &&
            !gamemodeShown &&
            !variant.shown &&
            !alwaysIncludePossessive
        ) {
            return uuid.value;
        }
        displayName += `${uuid.value}'s `;
    }

    if (variant.shown) {
        displayName += `${getVariantLabel(variant.value, displayName === "")} `;
    }

    if (gamemodeShown) {
        displayName += `${getGamemodeLabel(gamemode.value, displayName === "")} `;
    }

    if (stat.shown) {
        displayName += `${getFullStatLabel(stat.value, displayName === "")} `;
    }

    return displayName.slice(0, -1);
};

const renderTimeShort = (
    time: number,
    smallestTimeDenomination: TimeDenomination,
): string => {
    const date = new Date(time);
    switch (smallestTimeDenomination) {
        case "year": {
            return date.toLocaleString(undefined, {
                dateStyle: "medium",
            });
        }
        case "month": {
            return date.toLocaleString(undefined, {
                month: "short",
                day: "numeric",
            });
        }
        case "day": {
            return date.toLocaleString(undefined, {
                month: "short",
                day: "numeric",
            });
        }
        case "hour": {
            return date.toLocaleString(undefined, {
                hour: "numeric",
                minute: "numeric",
                second: "numeric",
            });
        }
    }
};

const renderTimeFull = (time: number): string => {
    const date = new Date(time);
    return date.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
    });
};

interface HistoryChartTitleProps {
    uuids: readonly string[];
    gamemodes: readonly GamemodeKey[];
    stats: readonly StatKey[];
    variants: readonly VariantKey[];
}

export const HistoryChartTitle: React.FC<HistoryChartTitleProps> = ({
    uuids,
    gamemodes,
    stats,
    variants,
}) => {
    const uuidToUsername = useUUIDToUsername(uuids);
    return (
        <Typography variant="h6">
            {contextAwareStatDisplayName(
                {
                    // TODO: Display error state if missing uuid
                    value: uuidToUsername[uuids[0]] ?? "",
                    shown: uuids.length === 1,
                },
                {
                    value: stats[0],
                    shown: stats.length === 1,
                },
                {
                    value: gamemodes[0],
                    shown: gamemodes.length === 1,
                },
                {
                    value: variants[0],
                    shown: variants.length === 1,
                },
                true,
            )}
            {stats.length > 1 ? " Stats" : ""}
        </Typography>
    );
};
export const HistoryChart: React.FC<HistoryChartProps> = ({
    start,
    end,
    uuids,
    gamemodes,
    stats,
    variants,
    limit,
}) => {
    const theme = useTheme();
    const historyQueries = useQueries({
        queries: uuids.map((uuid) =>
            getHistoryQueryOptions({ uuid, start, end, limit }),
        ),
    });

    const histories = historyQueries
        .filter((query) => query.status === "success")
        .map((query) => query.data);

    const chartData = generateChartData(histories);

    const uuidToUsername = useUUIDToUsername(uuids);

    if (uuids.length === 0) {
        return <div>Select at least one user</div>;
    }

    if (stats.length === 0) {
        return <div>Select at least one statistic</div>;
    }

    if (gamemodes.length === 0) {
        return <div>Select at least one gamemode or overall</div>;
    }

    if (variants.length === 0) {
        return <div>Select at least one session or overall</div>;
    }

    if (chartData.length === 0) {
        return <div>No data</div>;
    }

    // Comparing gamemodes (a single player/stat/variant) colours each line by
    // the gamemode's identity colour. Every other combination cycles the brand
    // rainbow, with dash patterns disambiguating once it wraps — this keeps
    // distinct lines distinct even when several share a hue.
    const colorByGamemode =
        uuids.length === 1 && stats.length === 1 && variants.length === 1;
    const { rainbow } = theme.palette;

    const lineStyle: LineStyleFn = (gamemode, index) => {
        if (colorByGamemode) {
            return { stroke: theme.palette.gamemode[gamemode], strokeDasharray: "0" };
        }
        return {
            stroke: rainbow[index % rainbow.length],
            strokeDasharray: DASHES[Math.floor(index / rainbow.length) % DASHES.length],
        };
    };

    // oxlint-disable-next-line eslint/no-use-before-define
    const series = buildSeries({
        uuids,
        gamemodes,
        stats,
        variants,
        uuidToUsername,
        lineStyle,
    });

    return (
        // oxlint-disable-next-line eslint/no-use-before-define
        <HistoryLineChart
            chartData={chartData}
            series={series}
            start={start}
            end={end}
        />
    );
};

interface HistoryLineChartProps {
    chartData: ChartData;
    series: readonly Series[];
    start: Date;
    end: Date;
}

const HistoryLineChart: React.FC<HistoryLineChartProps> = ({
    chartData,
    series,
    start,
    end,
}) => {
    const styles = chartStyles(useTheme());
    const currentDate = useNow("minute");

    const startTime = start.getTime();
    const endTime = end.getTime();
    const smallestTimeDenomination = getSmallestTimeDenomination(start, end);
    const seriesByKey = new Map<string, Series>(series.map((s) => [s.dataKey, s]));

    // Keep Recharts' default [0, auto] domain: always include zero.
    let yMax = 0;
    for (const row of chartData) {
        for (const s of series) {
            yMax = Math.max(yMax, row[s.dataKey] ?? 0);
        }
    }

    const definition = defineChart({
        marks: [
            futureMarker(currentDate.getTime(), endTime, styles.futureMarker),
            ...series.map((s) =>
                decorative(
                    lineY(rowsWithValue(chartData, s.dataKey), {
                        x: "queriedAt",
                        y: (row) => row[s.dataKey],
                        stroke: s.style.stroke,
                        strokeDasharray: s.style.strokeDasharray,
                        strokeWidth: 1.5,
                        curve: monotoneCurve,
                    }),
                ),
            ),
            // The dots own focus, so they show where data exists and grow on hover.
            ...series.map((s) =>
                dot(rowsWithValue(chartData, s.dataKey), {
                    id: s.dataKey,
                    // Without a z group, group-x focus only returns one mark's point.
                    z: () => s.dataKey,
                    x: "queriedAt",
                    y: (row) => row[s.dataKey],
                    r: 2.5,
                    fill: s.style.stroke,
                    states: [
                        {
                            when: { focus: "group" },
                            style: {
                                r: 5,
                                stroke: styles.theme.background,
                                strokeWidth: 2,
                            },
                        },
                    ],
                }),
            ),
        ],
        scales: {
            x: {
                scale: scaleLinear().domain([startTime, endTime]),
                axis: {
                    line: styles.axisLine,
                    ticks: {
                        values: Array.from(
                            { length: 10 },
                            (_, i) => startTime + ((endTime - startTime) / 9) * i,
                        ),
                        format: (time) =>
                            renderTimeShort(time, smallestTimeDenomination),
                    },
                },
            },
            y: {
                scale: scaleLinear().domain([0, yMax === 0 ? 1 : yMax]),
                nice: true,
                grid: styles.grid,
                axis: { line: styles.axisLine },
            },
            frame: FRAME_SCALE,
        },
        theme: styles.theme,
        clip: true,
        focus: "group-x",
        maxFocusDistance: Number.POSITIVE_INFINITY,
        // The focused dots' own state replaces the default ring.
        focusRing: false,
        cursor: historyCursorBinding,
        tooltip: {
            use: tooltip,
            // Follow the cursor vertically so the tooltip doesn't jump between distant lines.
            anchor: { x: "value", y: "pointer" },
            placement: ["right", "left"],
            offset: 12,
            content: (points) => ({
                title: points[0] === undefined ? "" : renderTimeFull(points[0].xValue),
                rows: points.flatMap((point) => {
                    const s = seriesByKey.get(point.markId);
                    if (s === undefined) {
                        return [];
                    }
                    return [
                        {
                            label: s.name,
                            value: formatStatValue(s.stat, point.yValue, {
                                precision: "detailed",
                            }),
                            color: s.style.stroke,
                        },
                    ];
                }),
            }),
        },
    });

    return (
        <Stack sx={{ flex: 1, minHeight: 300, minWidth: 100, gap: 1 }}>
            <Box sx={{ flex: 1, minHeight: 0 }}>
                <Chart
                    definition={definition}
                    ariaLabel="Stat history"
                    style={{ ...styles.host, height: "100%" }}
                />
            </Box>
            <Stack
                direction="row"
                sx={{
                    flexWrap: "wrap",
                    justifyContent: "center",
                    columnGap: 2,
                    rowGap: 0.5,
                }}
            >
                {series.map((s) => (
                    <Stack
                        key={s.dataKey}
                        direction="row"
                        sx={{ alignItems: "center", gap: 0.75 }}
                    >
                        <svg width={18} height={4} aria-hidden>
                            <line
                                x1={0}
                                y1={2}
                                x2={18}
                                y2={2}
                                stroke={s.style.stroke}
                                strokeWidth={2}
                                strokeDasharray={s.style.strokeDasharray}
                            />
                        </svg>
                        <Typography variant="caption" color="textSecondary">
                            {s.name}
                        </Typography>
                    </Stack>
                ))}
            </Stack>
        </Stack>
    );
};

interface SimpleHistoryChartProps {
    start: Date;
    end: Date;
    uuid: string;
    gamemode: GamemodeKey;
    stat: StatKey;
    variant: VariantKey;
    limit: number;
}

export const SimpleHistoryChart: React.FC<SimpleHistoryChartProps> = ({
    start,
    end,
    uuid,
    gamemode,
    stat,
    variant,
    limit,
}) => {
    const { data: history } = useQuery(
        getHistoryQueryOptions({ uuid, start, end, limit }),
    );

    const theme = useTheme();
    const styles = chartStyles(theme);

    const chartData = React.useMemo(() => {
        if (!history) {
            return [];
        }
        return generateChartData([history]);
    }, [history]);

    const uuidToUsername = useUUIDToUsername([uuid]);

    const currentDate = useNow("minute");

    const dataKey = makeDataKey({
        uuid,
        gamemode,
        stat,
        variant,
    });

    const { yMax } = useSynchronizeCharts(chartData, dataKey);

    // Tint the sparkline with the gamemode's identity colour. "overall" resolves
    // to the brand primary via the theme, so the aggregate series matches the
    // explore chart and the rest of the UI — one source of truth.
    const seriesColor = theme.palette.gamemode[gamemode];
    // NOTE: Assume the id format is CSS-selector-safe
    const gradientId = `spark-${React.useId()}`;
    const name = contextAwareStatDisplayName(
        {
            // TODO: Display error state if missing uuid
            value: uuidToUsername[uuid] ?? "",
            shown: false,
        },
        { value: stat, shown: true },
        { value: gamemode, shown: true },
        { value: variant, shown: true },
    );

    const definition = defineChart({
        marks: [
            decorative(
                areaY(rowsWithValue(chartData, dataKey), {
                    x: "queriedAt",
                    y1: 0,
                    y2: (row) => row[dataKey],
                    fill: `url(#${gradientId})`,
                    fillOpacity: 1,
                    curve: monotoneCurve,
                }),
            ),
            // Separate line: an area stroke would also trace the sides and baseline.
            lineY(rowsWithValue(chartData, dataKey), {
                x: "queriedAt",
                y: (row) => row[dataKey],
                stroke: seriesColor,
                strokeWidth: 1,
                curve: monotoneCurve,
            }),
            futureMarker(currentDate.getTime(), end.getTime(), styles.futureMarker),
            // Chart outline
            decorative(
                rect([{ x1: start.getTime(), x2: end.getTime() }], {
                    x1: "x1",
                    x2: "x2",
                    y1: () => 0,
                    y2: () => 1,
                    yScale: "frame",
                    fillOpacity: 0,
                    stroke: theme.palette.divider,
                    inset: 0,
                }),
            ),
        ],
        scales: {
            x: { scale: scaleLinear().domain([start.getTime(), end.getTime()]) },
            y: {
                scale:
                    yMax === undefined ? scaleLinear : scaleLinear().domain([0, yMax]),
            },
            frame: FRAME_SCALE,
        },
        guides: false,
        margin: 1,
        gradients: [
            {
                id: gradientId,
                x1: 0,
                y1: 0,
                x2: 0,
                y2: 1,
                stops: [
                    { offset: 0, color: seriesColor, opacity: 0.32 },
                    { offset: 1, color: seriesColor, opacity: 0 },
                ],
            },
        ],
        theme: styles.theme,
        clip: true,
        focus: "nearest-x",
        maxFocusDistance: Number.POSITIVE_INFINITY,
        cursor: historyCursorBinding,
        tooltip: {
            use: tooltip,
            // TODO: Nicer tooltip
            format: (point) =>
                formatStatValue(stat, point.yValue, { precision: "detailed" }),
        },
    });

    return (
        <Chart
            definition={definition}
            height={50}
            ariaLabel={name}
            style={{ ...styles.host, minWidth: 100 }}
        />
    );
};

interface LinesProps {
    readonly uuids: readonly string[];
    readonly gamemodes: readonly GamemodeKey[];
    readonly stats: readonly StatKey[];
    readonly variants: readonly VariantKey[];
    readonly uuidToUsername: Readonly<Record<string, string | undefined>>;
    readonly lineStyle: LineStyleFn;
}

interface Series {
    readonly dataKey: DataKey;
    readonly name: string;
    // Carried per series so the tooltip never reverse-parses the dataKey
    // (uuids and the "4v4" gamemode make splitting fragile).
    readonly stat: StatKey;
    readonly style: LineStyle;
}

const buildSeries = ({
    uuids,
    gamemodes,
    stats,
    variants,
    uuidToUsername,
    lineStyle,
}: LinesProps): Series[] => {
    let index = 0;
    return uuids.flatMap((uuid) =>
        stats.flatMap((stat) =>
            variants.flatMap((variant) => {
                // Only create one line for stars, not one for each gamemode
                const lineGamemodes: readonly GamemodeKey[] =
                    stat === "stars" || stat === "experience" ? ["overall"] : gamemodes;
                return lineGamemodes.map((gamemode) => ({
                    dataKey: makeDataKey({ uuid, gamemode, stat, variant }),
                    name: contextAwareStatDisplayName(
                        {
                            // TODO: Display error state if missing uuid
                            value: uuidToUsername[uuid] ?? "",
                            shown: uuids.length > 1,
                        },
                        { value: stat, shown: stats.length > 1 },
                        { value: gamemode, shown: gamemodes.length > 1 },
                        { value: variant, shown: variants.length > 1 },
                    ),
                    stat,
                    style: lineStyle(gamemode, index++),
                }));
            }),
        ),
    );
};
