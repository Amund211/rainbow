import { render, type RenderOptions } from "@testing-library/react";
import { createMemoryHistory, createRouter } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { routeTree } from "../routeTree.gen.ts";
import App from "#App.tsx";

function createQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: 0 },
        },
    });
}

/**
 * Render the real app route tree navigated to a specific URL.
 * Use this for components that depend on Route.useSearch/useParams/useLoaderDeps.
 */
// Render the real app at a given route
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
        <App router={router} queryClient={queryClient} />,
        options,
    );
    return { rendered: result, queryClient, router };
}
