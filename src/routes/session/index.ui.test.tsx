import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderAppRoute } from "#test/render.tsx";

describe("Session search page", () => {
    it("renders player search input", async () => {
        const { rendered } = renderAppRoute("/session");

        await waitFor(() => {
            expect(screen.getByRole("combobox")).toBeInTheDocument();
        });

        rendered.unmount();
    });

    it("contains meta description about session stats", async () => {
        const { rendered } = renderAppRoute("/session");

        await waitFor(() => {
            expect(
                document.querySelector('meta[content*="session stats"]'),
            ).toBeInTheDocument();
        });

        rendered.unmount();
    });
});
