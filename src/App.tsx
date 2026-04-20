import { createTheme, CssBaseline, ThemeProvider } from "@mui/material";
import { RouterProvider } from "@tanstack/react-router";
import { maxAge } from "#queryClient.ts";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import type { Persister } from "@tanstack/react-query-persist-client";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { CurrentUserProvider } from "#contexts/CurrentUser/provider.tsx";
import { PlayerVisitsProvider } from "#contexts/PlayerVisits/provider.tsx";
import { KnownAliasesProvider } from "#contexts/KnownAliases/provider.tsx";
import type { AppRouter } from "#createRouter.ts";
import type { QueryClient } from "@tanstack/react-query";
import React from "react";

const theme = createTheme({
    colorSchemes: {
        dark: true,
    },
});

interface AppProps {
    readonly router: AppRouter;
    readonly queryClient: QueryClient;
    readonly persister: Persister;
}

export const App: React.FC<AppProps> = ({ router, queryClient, persister }) => {
    return (
        <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{
                persister,
                maxAge,
                buster: "1", // API version
            }}
        >
            <LocalizationProvider dateAdapter={AdapterDayjs}>
                <ThemeProvider theme={theme} noSsr>
                    <CurrentUserProvider>
                        <PlayerVisitsProvider>
                            <KnownAliasesProvider>
                                <CssBaseline />
                                <RouterProvider router={router} />
                            </KnownAliasesProvider>
                        </PlayerVisitsProvider>
                    </CurrentUserProvider>
                </ThemeProvider>
            </LocalizationProvider>
        </PersistQueryClientProvider>
    );
};
