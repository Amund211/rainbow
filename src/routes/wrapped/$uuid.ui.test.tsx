import { describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderAppRoute } from "#test/render.tsx";
import { TEST_UUID } from "#mocks/data.ts";

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
});
