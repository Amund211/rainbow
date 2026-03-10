import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderRoute } from "#test/render.tsx";
import { Route } from "./index.tsx";

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const HomePage = Route.options.component!;

describe("Home page", () => {
    it("renders player search input", async () => {
        renderRoute(HomePage, { route: "/" });
        await waitFor(() => {
            expect(screen.getByRole("combobox")).toBeInTheDocument();
        });
    });

    it("contains meta description about Prism Overlay", async () => {
        renderRoute(HomePage, { route: "/" });
        await waitFor(() => {
            expect(
                document.querySelector('meta[content*="Prism Overlay"]'),
            ).toBeInTheDocument();
        });
    });

    it("contains canonical link", async () => {
        renderRoute(HomePage, { route: "/" });
        await waitFor(() => {
            expect(
                document.querySelector('link[href="https://prismoverlay.com"]'),
            ).toBeInTheDocument();
        });
    });
});
