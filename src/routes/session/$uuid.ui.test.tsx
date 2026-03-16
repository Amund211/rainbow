import { describe, it, expect } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { renderAppRoute } from "#test/render.tsx";
import { expectVariantToggle } from "#test/assertions.ts";
import { TEST_UUID } from "#mocks/data.ts";
import { server } from "#mocks/server.ts";

describe("Session detail page", () => {
    it("renders player username in heading", async () => {
        const { rendered } = renderAppRoute(`/session/${TEST_UUID}`);

        await waitFor(() => {
            expect(
                screen.getByText("TestPlayer's session stats"),
            ).toBeInTheDocument();
        });

        rendered.unmount();
    });

    it("renders gamemode and stat selectors", async () => {
        const { rendered } = renderAppRoute(`/session/${TEST_UUID}`);

        await waitFor(() => {
            expect(screen.getByLabelText("Gamemode")).toBeInTheDocument();
        });
        expect(screen.getByLabelText("Stat")).toBeInTheDocument();

        rendered.unmount();
    });

    it("renders variant toggle with All time / Session / Both", async () => {
        const { rendered } = renderAppRoute(`/session/${TEST_UUID}`);

        await waitFor(() => {
            expect(
                screen.getByRole("group", {
                    name: "Stat chart variant selection",
                }),
            ).toBeInTheDocument();
        });
        expectVariantToggle();

        rendered.unmount();
    });

    it("renders session table", async () => {
        const { rendered } = renderAppRoute(`/session/${TEST_UUID}`);

        await waitFor(() => {
            expect(screen.getByRole("table")).toBeInTheDocument();
        });

        rendered.unmount();
    });

    it("renders stat progression cards", async () => {
        const { rendered } = renderAppRoute(`/session/${TEST_UUID}`);

        await waitFor(() => {
            // Progression card titles include interval type prefix
            expect(screen.getByText(/^Daily /)).toBeInTheDocument();
        });
        expect(screen.getByText(/^Weekly /)).toBeInTheDocument();
        expect(screen.getByText(/^Monthly /)).toBeInTheDocument();

        rendered.unmount();
    });

    it("renders player search input for switching players", async () => {
        const { rendered } = renderAppRoute(`/session/${TEST_UUID}`);

        await waitFor(() => {
            expect(
                screen.getByPlaceholderText("Search players"),
            ).toBeInTheDocument();
        });

        rendered.unmount();
    });

    it("shows session table mode toggle (total/rate)", async () => {
        const { rendered } = renderAppRoute(`/session/${TEST_UUID}`);

        await waitFor(() => {
            expect(
                screen.getByRole("group", {
                    name: "Session table mode",
                }),
            ).toBeInTheDocument();
        });

        rendered.unmount();
    });

    // recharts doesn't expose semantic roles in jsdom, so we query by class name
    it("renders history charts", async () => {
        const { rendered } = renderAppRoute(`/session/${TEST_UUID}`);

        await waitFor(() => {
            expect(
                document.querySelector(".recharts-responsive-container"),
            ).toBeInTheDocument();
        });

        rendered.unmount();
    });

    describe("session table content", () => {
        it.each(["Start", "Duration", "Games", "Wins"])(
            "contains %s column header",
            async (header) => {
                const { rendered } = renderAppRoute(`/session/${TEST_UUID}`);

                await waitFor(() => {
                    expect(screen.getByRole("table")).toBeInTheDocument();
                });
                expect(
                    within(screen.getByRole("table")).getByText(header),
                ).toBeInTheDocument();

                rendered.unmount();
            },
        );

        it("renders 2 session rows from mock data", async () => {
            const { rendered } = renderAppRoute(`/session/${TEST_UUID}`);

            await waitFor(() => {
                expect(screen.getByRole("table")).toBeInTheDocument();
            });
            const table = screen.getByRole("table");
            const rows = within(table).getAllByRole("row");
            // 1 header row + 2 data rows = 3 total
            expect(rows).toHaveLength(3);

            rendered.unmount();
        });
    });

    describe("session table mode toggle", () => {
        it("contains Total and Rate (/hour) buttons", async () => {
            const { rendered } = renderAppRoute(`/session/${TEST_UUID}`);

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
            expect(
                within(toggleGroup).getByText("Rate (/hour)"),
            ).toBeInTheDocument();

            rendered.unmount();
        });
    });

    describe("Sessions heading", () => {
        it("renders Sessions text in the session table section", async () => {
            const { rendered } = renderAppRoute(`/session/${TEST_UUID}`);

            await waitFor(() => {
                expect(screen.getByText("Sessions")).toBeInTheDocument();
            });

            rendered.unmount();
        });
    });

    describe("chart rendering", () => {
        // recharts doesn't expose semantic roles in jsdom, so we query by class name
        it("renders multiple chart containers (progression + main chart)", async () => {
            const { rendered } = renderAppRoute(`/session/${TEST_UUID}`);

            await waitFor(() => {
                const containers = document.querySelectorAll(
                    ".recharts-responsive-container",
                );
                expect(containers.length).toBeGreaterThanOrEqual(4);
            });

            rendered.unmount();
        });
    });

    describe("page title", () => {
        it("includes the player name in the page heading", async () => {
            const { rendered } = renderAppRoute(`/session/${TEST_UUID}`);

            await waitFor(() => {
                expect(
                    screen.getByRole("heading", {
                        name: "TestPlayer's session stats",
                    }),
                ).toBeInTheDocument();
            });

            rendered.unmount();
        });
    });
});

describe("Session detail page - empty sessions", () => {
    it("shows 'No sessions found' when sessions endpoint returns empty array", async () => {
        const { rendered } = renderAppRoute(`/session/${TEST_UUID}`);

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

        rendered.unmount();
    });
});
