import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderRoute } from "#test/render.tsx";
import { Route } from "./index.tsx";

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const WrappedSearchPage = Route.options.component!;

describe("Wrapped search page", () => {
    it("renders player search input", async () => {
        renderRoute(WrappedSearchPage, { route: "/wrapped" });
        await waitFor(() => {
            expect(screen.getByRole("combobox")).toBeInTheDocument();
        });
    });

    it("contains meta description about wrapped stats", async () => {
        renderRoute(WrappedSearchPage, { route: "/wrapped" });
        await waitFor(() => {
            expect(
                document.querySelector('meta[content*="summary"]'),
            ).toBeInTheDocument();
        });
    });
});
