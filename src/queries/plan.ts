import type { QueryClient, QueryKey } from "@tanstack/react-query";

interface PrefetchableQueryOptions {
    readonly queryKey: QueryKey;
    // Set by requests whose parameters aren't usable yet — e.g. a uuid that
    // failed to normalize. `useQuery` honours it, but `prefetchQuery` does not,
    // so the request has to skip prefetching itself.
    //
    // Typed loosely because react-query also accepts a resolver function here;
    // a literal `false` is the only statically-known "don't fetch", which is
    // all a plan needs to express.
    readonly enabled?: unknown;
}

export interface QueryRequest {
    readonly prefetch: (queryClient: QueryClient) => void;
}

/**
 * Every query a route's component tree reads, built from the route's params and
 * loader deps.
 *
 * The loader prefetches the whole plan and hands each request to the component
 * that reads it, so a query cannot be added to the tree without also being
 * prefetched — the failure mode described in
 * https://tkdodo.eu/blog/reliable-query-prefetching-with-tanstack-router
 */
export type QueryPlan = Readonly<
    Record<string, QueryRequest | readonly QueryRequest[]>
>;

/**
 * Bind the parameters a component renders from to the query options built from
 * them.
 *
 * Components get the request, not the parameters, so the window they draw and
 * the window they fetch are the same object — they cannot drift apart.
 */
export const makeQueryRequest = <
    TParams extends object,
    TOptions extends PrefetchableQueryOptions,
>(
    params: TParams,
    options: TOptions,
) => ({
    ...params,
    options,
    prefetch: (queryClient: QueryClient) => {
        if (options.enabled === false) return;
        void queryClient.prefetchQuery(options);
    },
});

/**
 * Warm the cache for every query the route is about to render.
 *
 * Fire-and-forget on purpose: components render skeletons while these land, so
 * navigation is never blocked on the network.
 */
export const prefetchPlan = (queryClient: QueryClient, plan: QueryPlan): void => {
    // TODO: Rate limiting
    for (const request of Object.values(plan).flat()) {
        request.prefetch(queryClient);
    }
};
