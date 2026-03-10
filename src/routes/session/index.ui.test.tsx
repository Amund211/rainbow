import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderRoute } from "#test/render.tsx";
import { Route } from "./index.tsx";

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const SessionSearchPage = Route.options.component!;

describe("Session search page", () => {
    it("renders player search input", async () => {
        renderRoute(SessionSearchPage, { route: "/session" });
        await waitFor(() => {
            expect(screen.getByRole("combobox")).toBeInTheDocument();
        });
    });

    it("contains meta description about session stats", async () => {
        renderRoute(SessionSearchPage, { route: "/session" });
        await waitFor(() => {
            expect(
                document.querySelector('meta[content*="session stats"]'),
            ).toBeInTheDocument();
        });
    });
});
