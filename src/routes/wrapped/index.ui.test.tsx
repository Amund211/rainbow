import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderAppRoute } from "#test/render.tsx";

describe("Wrapped search page", () => {
    it("renders player search input", async () => {
        const { rendered } = renderAppRoute("/wrapped");

        await waitFor(() => {
            expect(screen.getByRole("combobox")).toBeInTheDocument();
        });

        rendered.unmount();
    });

    it("contains meta description about wrapped stats", async () => {
        const { rendered } = renderAppRoute("/wrapped");

        await waitFor(() => {
            expect(
                document.querySelector('meta[content*="summary"]'),
            ).toBeInTheDocument();
        });

        rendered.unmount();
    });
});
