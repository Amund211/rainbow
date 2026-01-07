import { UserMultiSelect } from "#components/UserSearch.tsx";
import { useCurrentUser } from "#contexts/CurrentUser/hooks.ts";
import { InfoOutlined } from "@mui/icons-material";
import { Stack, Tooltip, Typography } from "@mui/material";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/settings")({
    component: RouteComponent,
    head: () => ({
        meta: [
            {
                title: "Settings - Prism Overlay",
            },
            {
                name: "description",
                content:
                    "Change your settings for the Prism Overlay stats website. Set a default player to view your stats.",
            },
            {
                property: "og:type",
                content: "website",
            },
            {
                property: "og:url",
                content: "https://prismoverlay.com/settings",
            },
            {
                property: "og:title",
                content: "Settings - Prism Overlay",
            },
            {
                property: "og:description",
                content:
                    "Change your settings for the Prism Overlay stats website. Set a default player to view your stats.",
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
                content: "https://prismoverlay.com/settings",
            },
            {
                property: "twitter:title",
                content: "Settings - Prism Overlay",
            },
            {
                property: "twitter:description",
                content:
                    "Change your settings for the Prism Overlay stats website. Set a default player to view your stats.",
            },
            {
                property: "twitter:image",
                content: "https://prismoverlay.com/who.png",
            },
        ],
        links: [
            {
                rel: "canonical",
                href: "https://prismoverlay.com/settings",
            },
        ],
    }),
});

function RouteComponent() {
    const { currentUser, setCurrentUser } = useCurrentUser();
    return (
        <Stack gap={1}>
            <Stack
                component="label"
                direction="row"
                gap={2}
                alignItems="center"
            >
                <Typography variant="h6">Default player</Typography>
                <Tooltip title="Your default player for the Prism Overlay website. Typically your own main account. You can still view the stats of other players.">
                    <InfoOutlined />
                </Tooltip>
            </Stack>
            <UserMultiSelect
                placeholder="Set default player"
                uuids={currentUser ? [currentUser] : []}
                onSubmit={(uuids) => {
                    const newDefault = uuids[uuids.length - 1] ?? null;

                    setCurrentUser(newDefault);
                }}
            />
        </Stack>
    );
}
