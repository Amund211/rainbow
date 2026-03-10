import { describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderRoute, getRouteComponent } from "#test/render.tsx";
import { Route } from "./index.tsx";

const WrappedSearchPage = getRouteComponent(Route);

describe("Wrapped search page", () => {
    beforeEach(() => {
        renderRoute(WrappedSearchPage, { route: "/wrapped" });
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
