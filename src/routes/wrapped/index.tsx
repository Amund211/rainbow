import { UserSearch } from "#components/UserSearch.tsx";
import { Stack } from "@mui/material";
import { createFileRoute } from "@tanstack/react-router";
import { usePlayerVisits } from "#contexts/PlayerVisits/hooks.ts";
import { captureException } from "@sentry/react";

export const Route = createFileRoute("/wrapped/")({
    component: RouteComponent,
});

function RouteComponent() {
    const navigate = Route.useNavigate();
    const { visitPlayer } = usePlayerVisits();

    return (
        <Stack spacing={1}>
            <meta
                name="description"
                content="Search for player's year in review stats, showcasing their achievements, milestones, and highlights from the year."
            />
            <link rel="canonical" href="https://prismoverlay.com/wrapped" />
            <UserSearch
                onSubmit={(uuid) => {
                    visitPlayer(uuid);
                    navigate({
                        from: "/wrapped",
                        to: "/wrapped/$uuid",
                        params: { uuid },
                        search: {
                            year: new Date().getFullYear(),
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
