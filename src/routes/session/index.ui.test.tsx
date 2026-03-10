import { describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderAppRoute } from "#test/render.tsx";

describe("Session search page", () => {
    beforeEach(() => {
        renderAppRoute("/session");
    });

    it("renders player search input", async () => {
        await waitFor(() => {
            expect(screen.getByRole("combobox")).toBeInTheDocument();
        });
    });

    it("contains meta description about session stats", async () => {
        await waitFor(() => {
            expect(
                document.querySelector('meta[content*="session stats"]'),
            ).toBeInTheDocument();
        });
    });
});
