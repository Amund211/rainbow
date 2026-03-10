import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderAppRoute } from "#test/render.tsx";
import { TEST_UUID } from "#mocks/data.ts";

// The wrapped page renders content both in the main view and inside
// ExportImageMount, so many elements appear twice. Use getAllByText
// where duplicates are expected.

describe("Wrapped detail page", () => {
    it("renders wrapped header with year title", async () => {
        renderAppRoute(`/wrapped/${TEST_UUID}`);
        await waitFor(
            () => {
                expect(screen.getByText("2025 Wrapped")).toBeInTheDocument();
            },
            { timeout: 5000 },
        );
    });

    it("renders session overview section", async () => {
        renderAppRoute(`/wrapped/${TEST_UUID}`);
        await waitFor(
            () => {
                // Duplicated in export image, so use getAllByText
                expect(
                    screen.getAllByText("Session Overview").length,
                ).toBeGreaterThanOrEqual(1);
            },
            { timeout: 5000 },
        );
    });

    it("renders total sessions stat", async () => {
        renderAppRoute(`/wrapped/${TEST_UUID}`);
        await waitFor(
            () => {
                expect(
                    screen.getAllByText("Total Sessions").length,
                ).toBeGreaterThanOrEqual(1);
            },
            { timeout: 5000 },
        );
    });

    it("renders flawless sessions section", async () => {
        renderAppRoute(`/wrapped/${TEST_UUID}`);
        await waitFor(
            () => {
                expect(
                    screen.getAllByText("Flawless Sessions").length,
                ).toBeGreaterThanOrEqual(1);
            },
            { timeout: 5000 },
        );
    });

    it("renders export summary button when data loads", async () => {
        renderAppRoute(`/wrapped/${TEST_UUID}`);
        await waitFor(
            () => {
                expect(
                    screen.getByRole("button", { name: /Export Summary/ }),
                ).toBeInTheDocument();
            },
            { timeout: 5000 },
        );
    });

    it("renders player search input", async () => {
        renderAppRoute(`/wrapped/${TEST_UUID}`);
        await waitFor(() => {
            expect(
                screen.getByPlaceholderText("Search players"),
            ).toBeInTheDocument();
        });
    });
});
