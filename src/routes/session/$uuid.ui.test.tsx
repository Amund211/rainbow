import { describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { renderAppRoute } from "#test/render.tsx";
import { expectVariantToggle } from "#test/assertions.ts";
import { TEST_UUID } from "#mocks/data.ts";
import { server } from "#mocks/server.ts";

describe("Session detail page", () => {
    beforeEach(() => {
        renderAppRoute(`/session/${TEST_UUID}`);
    });

    it("renders player username in heading", async () => {
        await waitFor(() => {
            expect(
                screen.getByText("TestPlayer's session stats"),
            ).toBeInTheDocument();
        });
    });

    it("renders gamemode and stat selectors", async () => {
        await waitFor(() => {
            expect(screen.getByLabelText("Gamemode")).toBeInTheDocument();
        });
        expect(screen.getByLabelText("Stat")).toBeInTheDocument();
    });

    it("renders variant toggle with All time / Session / Both", async () => {
        await waitFor(() => {
            expect(
                screen.getByRole("group", {
                    name: "Stat chart variant selection",
                }),
            ).toBeInTheDocument();
        });
        expectVariantToggle();
    });

    it("renders session table", async () => {
        await waitFor(() => {
            expect(screen.getByRole("table")).toBeInTheDocument();
        });
    });

    it("renders stat progression cards", async () => {
        await waitFor(() => {
            // Progression card titles include interval type prefix
            expect(screen.getByText(/^Daily /)).toBeInTheDocument();
        });
        expect(screen.getByText(/^Weekly /)).toBeInTheDocument();
        expect(screen.getByText(/^Monthly /)).toBeInTheDocument();
    });

    it("renders player search input for switching players", async () => {
        await waitFor(() => {
            expect(
                screen.getByPlaceholderText("Search players"),
            ).toBeInTheDocument();
        });
    });

    it("shows session table mode toggle (total/rate)", async () => {
        await waitFor(() => {
            expect(
                screen.getByRole("group", {
                    name: "Session table mode",
                }),
            ).toBeInTheDocument();
        });
    });

    it("renders history charts", async () => {
        await waitFor(() => {
            expect(
                document.querySelector(".recharts-responsive-container"),
            ).toBeInTheDocument();
        });
    });

    describe("session table content", () => {
        it("contains Start column header", async () => {
            await waitFor(() => {
                expect(screen.getByRole("table")).toBeInTheDocument();
            });
            const table = screen.getByRole("table");
            expect(within(table).getByText("Start")).toBeInTheDocument();
        });

        it("contains Duration column header", async () => {
            await waitFor(() => {
                expect(screen.getByRole("table")).toBeInTheDocument();
            });
            const table = screen.getByRole("table");
            expect(within(table).getByText("Duration")).toBeInTheDocument();
        });

        it("contains Games column header", async () => {
            await waitFor(() => {
                expect(screen.getByRole("table")).toBeInTheDocument();
            });
            const table = screen.getByRole("table");
            expect(within(table).getByText("Games")).toBeInTheDocument();
        });

        it("contains Wins column header", async () => {
            await waitFor(() => {
                expect(screen.getByRole("table")).toBeInTheDocument();
            });
            const table = screen.getByRole("table");
            expect(within(table).getByText("Wins")).toBeInTheDocument();
        });

        it("renders 2 session rows from mock data", async () => {
            await waitFor(() => {
                expect(screen.getByRole("table")).toBeInTheDocument();
            });
            const table = screen.getByRole("table");
            const rows = within(table).getAllByRole("row");
            // 1 header row + 2 data rows = 3 total
            expect(rows).toHaveLength(3);
        });
    });

    describe("session table mode toggle", () => {
        it("contains Total button text", async () => {
            await waitFor(() => {
                expect(
                    screen.getByRole("group", {
                        name: "Session table mode",
                    }),
                ).toBeInTheDocument();
            });
            const toggleGroup = screen.getByRole("group", {
                name: "Session table mode",
            });
            expect(within(toggleGroup).getByText("Total")).toBeInTheDocument();
        });

        it("contains Rate (/hour) button text", async () => {
            await waitFor(() => {
                expect(
                    screen.getByRole("group", {
                        name: "Session table mode",
                    }),
                ).toBeInTheDocument();
            });
            const toggleGroup = screen.getByRole("group", {
                name: "Session table mode",
            });
            expect(
                within(toggleGroup).getByText("Rate (/hour)"),
            ).toBeInTheDocument();
        });
    });

    describe("Sessions heading", () => {
        it("renders Sessions text in the session table section", async () => {
            await waitFor(() => {
                expect(screen.getByText("Sessions")).toBeInTheDocument();
            });
        });
    });

    describe("chart rendering", () => {
        it("renders multiple chart containers (progression + main chart)", async () => {
            await waitFor(() => {
                const containers = document.querySelectorAll(
                    ".recharts-responsive-container",
                );
                expect(containers.length).toBeGreaterThanOrEqual(4);
            });
        });
    });

    describe("page title", () => {
        it("includes the player name in the page heading", async () => {
            await waitFor(() => {
                expect(
                    screen.getByText("TestPlayer's session stats"),
                ).toBeInTheDocument();
            });
            // Verify it is rendered as a heading element
            const heading = screen
                .getByText("TestPlayer's session stats")
                .closest("h6");
            expect(heading).toBeInTheDocument();
        });
    });
});

describe("Session detail page - empty sessions", () => {
    it("shows 'No sessions found' when sessions endpoint returns empty array", async () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const API_BASE: string = import.meta.env.VITE_FLASHLIGHT_URL;

        server.use(
            http.post(`${API_BASE}/v1/sessions`, () => {
                return HttpResponse.json([]);
            }),
        );

        renderAppRoute(`/session/${TEST_UUID}`);

        await waitFor(() => {
            expect(screen.getByText("No sessions found")).toBeInTheDocument();
        });
    });
});
