import { describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderRoute, getRouteComponent } from "#test/render.tsx";
import { Route } from "./index.tsx";

const SessionSearchPage = getRouteComponent(Route);

describe("Session search page", () => {
    beforeEach(() => {
        renderRoute(SessionSearchPage, { route: "/session" });
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
