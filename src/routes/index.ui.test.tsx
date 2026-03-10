import { describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderAppRoute } from "#test/render.tsx";

describe("Home page", () => {
    beforeEach(() => {
        renderAppRoute("/");
    });

    it("renders player search input", async () => {
        await waitFor(() => {
            expect(screen.getByRole("combobox")).toBeInTheDocument();
        });
    });

    it("contains meta description about Prism Overlay", async () => {
        await waitFor(() => {
            expect(
                document.querySelector('meta[content*="Prism Overlay"]'),
            ).toBeInTheDocument();
        });
    });

    it("contains canonical link", async () => {
        await waitFor(() => {
            expect(
                document.querySelector('link[href="https://prismoverlay.com"]'),
            ).toBeInTheDocument();
        });
    });
});
