import type { Theme } from "@mui/material/styles";
import type { ChartTheme } from "@tanstack/charts";
import { d3Curve } from "@tanstack/charts/d3/shape";
import { curveMonotoneX } from "d3-shape";
import type React from "react";

export const monotoneCurve = d3Curve(curveMonotoneX);

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- MUI Theme is mutable
export const chartStyles = (theme: Theme) => {
    const { palette } = theme;
    return {
        theme: {
            foreground: palette.text.secondary,
            muted: palette.text.secondary,
            grid: palette.divider,
            background: palette.background.paper,
        } satisfies Partial<ChartTheme>,
        grid: { stroke: palette.divider, strokeOpacity: 1, strokeDasharray: "2 4" },
        axisLine: { stroke: palette.divider, strokeOpacity: 1 },
        // The tooltip is native DOM styled through CSS custom properties on the host.
        host: {
            fontSize: 12,
            "--ts-chart-tooltip-background": palette.background.paper,
            "--ts-chart-tooltip-border": `1px solid ${palette.divider}`,
            "--ts-chart-tooltip-border-radius": "8px",
            "--ts-chart-tooltip-color": palette.text.primary,
            "--ts-chart-tooltip-font": `14px ${theme.typography.fontFamily ?? "sans-serif"}`,
        } as React.CSSProperties,
        futureMarker: { fill: palette.textMuted, stroke: palette.divider },
    } as const;
};
