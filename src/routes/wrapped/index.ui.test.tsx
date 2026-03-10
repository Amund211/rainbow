import { describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderAppRoute } from "#test/render.tsx";

describe("Wrapped search page", () => {
    beforeEach(() => {
        renderAppRoute("/wrapped");
    });

    it("renders player search input", async () => {
        await waitFor(() => {
            expect(screen.getByRole("combobox")).toBeInTheDocument();
        });
    });

    it("contains meta description about wrapped stats", async () => {
        await waitFor(() => {
            expect(
                document.querySelector('meta[content*="summary"]'),
            ).toBeInTheDocument();
        });
    });
});
