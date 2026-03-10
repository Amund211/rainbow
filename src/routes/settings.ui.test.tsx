import { describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderAppRoute } from "#test/render.tsx";

describe("Settings page", () => {
    beforeEach(() => {
        renderAppRoute("/settings");
    });

    it("renders Default player heading", async () => {
        await waitFor(() => {
            expect(
                screen.getByRole("heading", { name: "Default player" }),
            ).toBeInTheDocument();
        });
    });

    it("renders info tooltip about default player", async () => {
        await waitFor(() => {
            expect(screen.getByTestId("InfoOutlinedIcon")).toBeInTheDocument();
        });
    });

    it("renders the user multi-select input", async () => {
        await waitFor(() => {
            expect(
                screen.getByPlaceholderText("Set default player"),
            ).toBeInTheDocument();
        });
    });
});
