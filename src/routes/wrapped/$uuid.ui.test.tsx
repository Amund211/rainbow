import { describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderAppRoute } from "#test/render.tsx";
import { TEST_UUID, makeWrappedResponse } from "#mocks/data.ts";
import { server } from "#mocks/server.ts";
import { http, HttpResponse } from "msw";

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const API_BASE: string = import.meta.env.VITE_FLASHLIGHT_URL;

// The wrapped page renders content both in the main view and inside
// ExportImageMount, so many elements appear twice. Use getAllByText
// where duplicates are expected.

describe("Wrapped detail page", () => {
    beforeEach(() => {
        renderAppRoute(`/wrapped/${TEST_UUID}`);
    });

    it("renders wrapped header with year title", async () => {
        const { rendered } = renderAppRoute(`/wrapped/${TEST_UUID}`);

        await waitFor(() => {
            expect(screen.getByText("2025 Wrapped")).toBeInTheDocument();
        });

        rendered.unmount();
    });

    it("renders session overview section", async () => {
        const { rendered } = renderAppRoute(`/wrapped/${TEST_UUID}`);

        await waitFor(() => {
            // Duplicated in export image, so use getAllByText
            expect(
                screen.getAllByText("Session Overview").length,
            ).toBeGreaterThanOrEqual(1);
        });

        rendered.unmount();
    });

    it("renders total sessions stat", async () => {
        const { rendered } = renderAppRoute(`/wrapped/${TEST_UUID}`);

        await waitFor(() => {
            expect(
                screen.getAllByText("Total Sessions").length,
            ).toBeGreaterThanOrEqual(1);
        });

        rendered.unmount();
    });

    it("renders flawless sessions section", async () => {
        const { rendered } = renderAppRoute(`/wrapped/${TEST_UUID}`);

        await waitFor(() => {
            expect(
                screen.getAllByText("Flawless Sessions").length,
            ).toBeGreaterThanOrEqual(1);
        });

        rendered.unmount();
    });

    it("renders export summary button when data loads", async () => {
        const { rendered } = renderAppRoute(`/wrapped/${TEST_UUID}`);

        await waitFor(() => {
            expect(
                screen.getByRole("button", { name: /Export Summary/ }),
            ).toBeInTheDocument();
        });

        rendered.unmount();
    });

    it("renders player search input", async () => {
        const { rendered } = renderAppRoute(`/wrapped/${TEST_UUID}`);

        await waitFor(() => {
            expect(
                screen.getByPlaceholderText("Search players"),
            ).toBeInTheDocument();
        });

        rendered.unmount();
    });

    it.each([
        "Games Played",
        "Wins",
        "Final Kills",
        "Beds Broken",
        "FKDR",
        "Stars Gained",
    ])("renders %s in year stats", async (label) => {
        await waitFor(() => {
            expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(1);
        });
    });

    it.each([
        "Highest FKDR",
        "Most Kills",
        "Most Final Kills",
        "Most Wins",
        "Longest Session",
        "Most Wins/Hour",
        "Most Finals/Hour",
    ])("renders %s in best sessions", async (label) => {
        await waitFor(() => {
            expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(1);
        });
    });

    it("renders Best Sessions heading", async () => {
        const { rendered } = renderAppRoute(`/wrapped/${TEST_UUID}`);

        await waitFor(() => {
            expect(
                screen.getAllByText(/Best Sessions/).length,
            ).toBeGreaterThanOrEqual(1);
        });

        rendered.unmount();
    });

    it.each(["Highest Ended Winstreaks", "Highest Ended Final Kill Streaks"])(
        "renders %s in streaks",
        async (label) => {
            const { rendered } = renderAppRoute(`/wrapped/${TEST_UUID}`);

            await waitFor(() => {
                expect(
                    screen.getAllByText(label).length,
                ).toBeGreaterThanOrEqual(1);
            });

            rendered.unmount();
        },
    );

    it("renders Streaks heading", async () => {
        const { rendered } = renderAppRoute(`/wrapped/${TEST_UUID}`);

        await waitFor(() => {
            expect(
                screen.getAllByText(/Streaks/).length,
            ).toBeGreaterThanOrEqual(1);
        });

        rendered.unmount();
    });

    it("renders winstreak values from mock data", async () => {
        const { rendered } = renderAppRoute(`/wrapped/${TEST_UUID}`);

        await waitFor(() => {
            // Overall winstreak highest is 30
            expect(screen.getAllByText("30").length).toBeGreaterThanOrEqual(1);
        });

        rendered.unmount();
    });

    it.each([
        "Average Session Stats",
        "Games/Session",
        "Wins/Session",
        "Finals/Session",
        "Avg Length",
    ])("renders %s in average stats", async (label) => {
        const { rendered } = renderAppRoute(`/wrapped/${TEST_UUID}`);

        await waitFor(() => {
            expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(1);
        });

        rendered.unmount();
    });

    it.each([
        ["Session Coverage", "Session Coverage"],
        ["games played percentage (80%)", /80\s*%/],
        ["adjusted total hours (250h)", "250h"],
        ["Play Time Patterns", /Play Time Patterns/],
        ["flawless count 25", "25"],
        [
            "25% with no losses and no final deaths",
            /25\s*% of sessions with no losses and no final deaths/,
        ],
    ] as const)("renders %s", async (_label, matcher) => {
        const { rendered } = renderAppRoute(`/wrapped/${TEST_UUID}`);

        await waitFor(() => {
            expect(screen.getAllByText(matcher).length).toBeGreaterThanOrEqual(
                1,
            );
        });

        rendered.unmount();
    });
});

describe("Wrapped detail page - loading state", () => {
    it("shows loading message while data is pending", async () => {
        server.use(
            http.get(`${API_BASE}/v1/wrapped/:uuid/:year`, () => {
                // Never resolve - simulates a perpetually pending request
                return new Promise(() => {
                    // intentionally never resolves
                });
            }),
        );

        const { rendered } = renderAppRoute(`/wrapped/${TEST_UUID}`);

        await waitFor(() => {
            expect(
                screen.getByText("Loading your year in review..."),
            ).toBeInTheDocument();
        });

        rendered.unmount();
    });
});

describe("Wrapped detail page - error state", () => {
    it("shows error message when request fails", async () => {
        server.use(
            http.get(`${API_BASE}/v1/wrapped/:uuid/:year`, () => {
                return HttpResponse.json(
                    { success: false, error: "Internal Server Error" },
                    { status: 500 },
                );
            }),
        );

        const { rendered } = renderAppRoute(`/wrapped/${TEST_UUID}`);

        await waitFor(() => {
            expect(
                screen.getByText(/Failed loading your year in review/),
            ).toBeInTheDocument();
        });

        rendered.unmount();
    });
});

describe("Wrapped detail page - no sessions state", () => {
    it("renders NoSessionsAlert when totalSessions is 0", async () => {
        server.use(
            http.get(`${API_BASE}/v1/wrapped/:uuid/:year`, () => {
                return HttpResponse.json(
                    makeWrappedResponse({
                        totalSessions: 0,
                        sessionStats: null,
                    }),
                );
            }),
        );

        const { rendered } = renderAppRoute(`/wrapped/${TEST_UUID}`);

        await waitFor(() => {
            expect(
                screen.getByText(/didn't record any sessions/),
            ).toBeInTheDocument();
        });

        rendered.unmount();
    });
});

describe("Wrapped detail page - no year stats state", () => {
    it("renders alert when yearStats is null", async () => {
        server.use(
            http.get(`${API_BASE}/v1/wrapped/:uuid/:year`, () => {
                return HttpResponse.json(
                    makeWrappedResponse({ yearStats: null }),
                );
            }),
        );

        const { rendered } = renderAppRoute(`/wrapped/${TEST_UUID}`);

        await waitFor(() => {
            expect(
                screen.getByText(/didn't record any stats/),
            ).toBeInTheDocument();
        });

        rendered.unmount();
    });
});
