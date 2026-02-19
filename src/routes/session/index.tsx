import { UserSearch } from "#components/UserSearch.tsx";
import { Stack } from "@mui/material";
import { createFileRoute } from "@tanstack/react-router";
import { usePlayerVisits } from "#contexts/PlayerVisits/hooks.ts";
import { captureException } from "@sentry/react";

export const Route = createFileRoute("/session/")({
    component: RouteComponent,
    head: () => ({
        meta: [
            {
                title: "Session Stats - Prism Overlay",
            },
            {
                name: "description",
                content:
                    "Search for player's session stats, including daily, weekly, and monthly stats, as well as a progression towards stat milestones, and individual session breakdowns.",
            },
            {
                property: "og:type",
                content: "website",
            },
            {
                property: "og:url",
                content: "https://prismoverlay.com/session",
            },
            {
                property: "og:title",
                content: "Session Stats - Prism Overlay",
            },
            {
                property: "og:description",
                content:
                    "Search for player's session stats, including daily, weekly, and monthly stats, as well as a progression towards stat milestones, and individual session breakdowns.",
            },
            {
                property: "og:image",
                content: "https://prismoverlay.com/who.png",
            },
            {
                property: "og:site_name",
                content: "Prism Overlay",
            },
            {
                property: "twitter:card",
                content: "summary",
            },
            {
                property: "twitter:url",
                content: "https://prismoverlay.com/session",
            },
            {
                property: "twitter:title",
                content: "Session Stats - Prism Overlay",
            },
            {
                property: "twitter:description",
                content:
                    "Search for player's session stats, including daily, weekly, and monthly stats, as well as a progression towards stat milestones, and individual session breakdowns.",
            },
            {
                property: "twitter:image",
                content: "https://prismoverlay.com/who.png",
            },
        ],
        links: [
            {
                rel: "canonical",
                href: "https://prismoverlay.com/session",
            },
        ],
    }),
});

function RouteComponent() {
    const navigate = Route.useNavigate();
    const { visitPlayer } = usePlayerVisits();

    return (
        <Stack spacing={1}>
            <UserSearch
                onSubmit={(uuid) => {
                    visitPlayer(uuid);
                    navigate({
                        from: "/session/",
                        to: "/session/$uuid",
                        params: { uuid },
                        search: {
                            gamemode: "overall",
                            stat: "fkdr",
                            timeIntervalDefinition: { type: "contained" },
                            variantSelection: "both",
                            sessionTableMode: "total",
                            showExtrapolatedSessions: false,
                        },
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
        </Stack>
    );
}
