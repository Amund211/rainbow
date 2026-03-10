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
        await waitFor(() => {
            expect(screen.getByText("2025 Wrapped")).toBeInTheDocument();
        });
    });

    it("renders session overview section", async () => {
        await waitFor(() => {
            // Duplicated in export image, so use getAllByText
            expect(
                screen.getAllByText("Session Overview").length,
            ).toBeGreaterThanOrEqual(1);
        });
    });

    it("renders total sessions stat", async () => {
        await waitFor(() => {
            expect(
                screen.getAllByText("Total Sessions").length,
            ).toBeGreaterThanOrEqual(1);
        });
    });

    it("renders flawless sessions section", async () => {
        await waitFor(() => {
            expect(
                screen.getAllByText("Flawless Sessions").length,
            ).toBeGreaterThanOrEqual(1);
        });
    });

    it("renders export summary button when data loads", async () => {
        await waitFor(() => {
            expect(
                screen.getByRole("button", { name: /Export Summary/ }),
            ).toBeInTheDocument();
        });
    });

    it("renders player search input", async () => {
        await waitFor(() => {
            expect(
                screen.getByPlaceholderText("Search players"),
            ).toBeInTheDocument();
        });
    });

    describe("YearStatsCards section", () => {
        it("renders Games Played text", async () => {
            await waitFor(() => {
                expect(
                    screen.getAllByText("Games Played").length,
                ).toBeGreaterThanOrEqual(1);
            });
        });

        it("renders Wins text", async () => {
            await waitFor(() => {
                expect(
                    screen.getAllByText("Wins").length,
                ).toBeGreaterThanOrEqual(1);
            });
        });

        it("renders Final Kills text", async () => {
            await waitFor(() => {
                expect(
                    screen.getAllByText("Final Kills").length,
                ).toBeGreaterThanOrEqual(1);
            });
        });

        it("renders Beds Broken text", async () => {
            await waitFor(() => {
                expect(
                    screen.getAllByText("Beds Broken").length,
                ).toBeGreaterThanOrEqual(1);
            });
        });

        it("renders FKDR text", async () => {
            await waitFor(() => {
                expect(
                    screen.getAllByText("FKDR").length,
                ).toBeGreaterThanOrEqual(1);
            });
        });

        it("renders Stars Gained text", async () => {
            await waitFor(() => {
                expect(
                    screen.getAllByText("Stars Gained").length,
                ).toBeGreaterThanOrEqual(1);
            });
        });
    });

    describe("BestSessions section", () => {
        it("renders Best Sessions heading", async () => {
            await waitFor(() => {
                expect(
                    screen.getAllByText(/Best Sessions/).length,
                ).toBeGreaterThanOrEqual(1);
            });
        });

        it("renders Highest FKDR", async () => {
            await waitFor(() => {
                expect(
                    screen.getAllByText("Highest FKDR").length,
                ).toBeGreaterThanOrEqual(1);
            });
        });

        it("renders Most Kills", async () => {
            await waitFor(() => {
                expect(
                    screen.getAllByText("Most Kills").length,
                ).toBeGreaterThanOrEqual(1);
            });
        });

        it("renders Most Final Kills", async () => {
            await waitFor(() => {
                expect(
                    screen.getAllByText("Most Final Kills").length,
                ).toBeGreaterThanOrEqual(1);
            });
        });

        it("renders Most Wins", async () => {
            await waitFor(() => {
                expect(
                    screen.getAllByText("Most Wins").length,
                ).toBeGreaterThanOrEqual(1);
            });
        });

        it("renders Longest Session", async () => {
            await waitFor(() => {
                expect(
                    screen.getAllByText("Longest Session").length,
                ).toBeGreaterThanOrEqual(1);
            });
        });

        it("renders Most Wins/Hour", async () => {
            await waitFor(() => {
                expect(
                    screen.getAllByText("Most Wins/Hour").length,
                ).toBeGreaterThanOrEqual(1);
            });
        });

        it("renders Most Finals/Hour", async () => {
            await waitFor(() => {
                expect(
                    screen.getAllByText("Most Finals/Hour").length,
                ).toBeGreaterThanOrEqual(1);
            });
        });
    });

    describe("Streaks section", () => {
        it("renders Streaks heading", async () => {
            await waitFor(() => {
                expect(
                    screen.getAllByText(/Streaks/).length,
                ).toBeGreaterThanOrEqual(1);
            });
        });

        it("renders Highest Ended Winstreaks text", async () => {
            await waitFor(() => {
                expect(
                    screen.getAllByText("Highest Ended Winstreaks").length,
                ).toBeGreaterThanOrEqual(1);
            });
        });

        it("renders Highest Ended Final Kill Streaks text", async () => {
            await waitFor(() => {
                expect(
                    screen.getAllByText("Highest Ended Final Kill Streaks")
                        .length,
                ).toBeGreaterThanOrEqual(1);
            });
        });

        it("renders winstreak values from mock data", async () => {
            await waitFor(() => {
                // Overall winstreak highest is 30
                expect(screen.getAllByText("30").length).toBeGreaterThanOrEqual(
                    1,
                );
            });
        });
    });

    describe("AverageSessionStats section", () => {
        it("renders Average Session Stats text", async () => {
            await waitFor(() => {
                expect(
                    screen.getAllByText("Average Session Stats").length,
                ).toBeGreaterThanOrEqual(1);
            });
        });

        it("renders Games/Session label", async () => {
            await waitFor(() => {
                expect(
                    screen.getAllByText("Games/Session").length,
                ).toBeGreaterThanOrEqual(1);
            });
        });

        it("renders Wins/Session label", async () => {
            await waitFor(() => {
                expect(
                    screen.getAllByText("Wins/Session").length,
                ).toBeGreaterThanOrEqual(1);
            });
        });

        it("renders Finals/Session label", async () => {
            await waitFor(() => {
                expect(
                    screen.getAllByText("Finals/Session").length,
                ).toBeGreaterThanOrEqual(1);
            });
        });

        it("renders Avg Length label", async () => {
            await waitFor(() => {
                expect(
                    screen.getAllByText("Avg Length").length,
                ).toBeGreaterThanOrEqual(1);
            });
        });
    });

    describe("SessionCoverage section", () => {
        it("renders Session Coverage text", async () => {
            await waitFor(() => {
                expect(
                    screen.getAllByText("Session Coverage").length,
                ).toBeGreaterThanOrEqual(1);
            });
        });

        it("renders games played percentage (80%)", async () => {
            await waitFor(() => {
                expect(
                    screen.getAllByText(/80\s*%/).length,
                ).toBeGreaterThanOrEqual(1);
            });
        });

        it("renders adjusted total hours (250h)", async () => {
            await waitFor(() => {
                expect(
                    screen.getAllByText("250h").length,
                ).toBeGreaterThanOrEqual(1);
            });
        });
    });

    describe("FavoritePlayTimes section", () => {
        it("renders Play Time Patterns text", async () => {
            await waitFor(() => {
                expect(
                    screen.getAllByText(/Play Time Patterns/).length,
                ).toBeGreaterThanOrEqual(1);
            });
        });
    });

    describe("FlawlessSessions values", () => {
        it("renders the flawless count 25", async () => {
            await waitFor(() => {
                expect(screen.getAllByText("25").length).toBeGreaterThanOrEqual(
                    1,
                );
            });
        });

        it("renders 25% with no losses and no final deaths text", async () => {
            await waitFor(() => {
                expect(
                    screen.getAllByText(
                        /25\s*% of sessions with no losses and no final deaths/,
                    ).length,
                ).toBeGreaterThanOrEqual(1);
            });
        });
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

        renderAppRoute(`/wrapped/${TEST_UUID}`);

        await waitFor(() => {
            expect(
                screen.getByText("Loading your year in review..."),
            ).toBeInTheDocument();
        });
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

        renderAppRoute(`/wrapped/${TEST_UUID}`);

        await waitFor(() => {
            expect(
                screen.getByText(/Failed loading your year in review/),
            ).toBeInTheDocument();
        });
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

        renderAppRoute(`/wrapped/${TEST_UUID}`);

        await waitFor(() => {
            expect(
                screen.getByText(/didn't record any sessions/),
            ).toBeInTheDocument();
        });
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

        renderAppRoute(`/wrapped/${TEST_UUID}`);

        await waitFor(() => {
            expect(
                screen.getByText(/didn't record any stats/),
            ).toBeInTheDocument();
        });
    });
});
