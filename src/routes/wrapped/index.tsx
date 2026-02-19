import { UserSearch } from "#components/UserSearch.tsx";
import { Stack } from "@mui/material";
import { createFileRoute } from "@tanstack/react-router";
import { usePlayerVisits } from "#contexts/PlayerVisits/hooks.ts";
import { captureException } from "@sentry/react";
import { getWrappedYear } from "#helpers/wrapped.ts";

export const Route = createFileRoute("/wrapped/")({
    component: RouteComponent,
    head: () => ({
        meta: [
            {
                title: "Wrapped - Prism Overlay",
            },
            {
                name: "description",
                content:
                    "View a summary of a player's Bed Wars stats for the past year, showcasing their achievements, milestones, and highlights.",
            },
            {
                property: "og:type",
                content: "website",
            },
            {
                property: "og:url",
                content: "https://prismoverlay.com/wrapped",
            },
            {
                property: "og:title",
                content: "Wrapped - Prism Overlay",
            },
            {
                property: "og:description",
                content:
                    "View a summary of a player's Bed Wars stats for the past year, showcasing their achievements, milestones, and highlights.",
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
                content: "https://prismoverlay.com/wrapped",
            },
            {
                property: "twitter:title",
                content: "Wrapped - Prism Overlay",
            },
            {
                property: "twitter:description",
                content:
                    "View a summary of a player's Bed Wars stats for the past year, showcasing their achievements, milestones, and highlights.",
            },
            {
                property: "twitter:image",
                content: "https://prismoverlay.com/who.png",
            },
        ],
        links: [
            {
                rel: "canonical",
                href: "https://prismoverlay.com/wrapped",
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
                        from: "/wrapped/",
                        to: "/wrapped/$uuid",
                        params: { uuid },
                        search: {
                            year: getWrappedYear(),
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
