import { render, type RenderOptions } from "@testing-library/react";
import {
    createMemoryHistory,
    createRootRoute,
    createRoute,
    createRouter,
    RouterProvider,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTheme, ThemeProvider } from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { CurrentUserProvider } from "#contexts/CurrentUser/provider.tsx";
import { PlayerVisitsProvider } from "#contexts/PlayerVisits/provider.tsx";
import { KnownAliasesProvider } from "#contexts/KnownAliases/provider.tsx";
import { routeTree } from "../routeTree.gen.ts";
import type { FC } from "react";

export function getRouteComponent(route: {
    options: { component?: FC };
}): FC {
    if (!route.options.component) throw new Error("Route has no component");
    return route.options.component;
}

const theme = createTheme({
    colorSchemes: { dark: true },
});

function createQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: 0 },
        },
    });
}

function Providers({
    queryClient,
    router,
}: {
    queryClient: QueryClient;
    router: ReturnType<typeof createRouter>;
}) {
    return (
        <QueryClientProvider client={queryClient}>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
                <ThemeProvider theme={theme} noSsr>
                    <CurrentUserProvider>
                        <PlayerVisitsProvider>
                            <KnownAliasesProvider>
                                {/* @ts-expect-error -- test router type mismatch */}
                                <RouterProvider router={router} />
                            </KnownAliasesProvider>
                        </PlayerVisitsProvider>
                    </CurrentUserProvider>
                </ThemeProvider>
            </LocalizationProvider>
        </QueryClientProvider>
    );
}

interface RenderRouteOptions extends Omit<RenderOptions, "wrapper"> {
    route?: string;
    initialEntries?: string[];
}

/**
 * Render a component inside a minimal TanStack Router + all app providers.
 * Best for components that don't use Route.useSearch/useParams/useLoaderDeps.
 */
export function renderRoute(Component: FC, options: RenderRouteOptions = {}) {
    const { route = "/", initialEntries, ...renderOptions } = options;

    const queryClient = createQueryClient();
    const rootRoute = createRootRoute();
    const testRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: route,
        component: Component,
    });
    rootRoute.addChildren([testRoute]);

    const router = createRouter({
        routeTree: rootRoute,
        history: createMemoryHistory({
            initialEntries: initialEntries ?? [route],
        }),
        defaultPendingMinMs: 0,
    });

    const result = render(
        <Providers queryClient={queryClient} router={router} />,
        renderOptions,
    );
    return { ...result, queryClient, router };
}

/**
 * Render the real app route tree navigated to a specific URL.
 * Use this for components that depend on Route.useSearch/useParams/useLoaderDeps.
 */
export function renderAppRoute(
    initialEntry: string,
    options: Omit<RenderOptions, "wrapper"> = {},
) {
    const queryClient = createQueryClient();

    const router = createRouter({
        routeTree,
        history: createMemoryHistory({ initialEntries: [initialEntry] }),
        defaultPendingMinMs: 0,
        context: undefined,
    });

    const result = render(
        <Providers queryClient={queryClient} router={router} />,
        options,
    );
    return { ...result, queryClient, router };
}
