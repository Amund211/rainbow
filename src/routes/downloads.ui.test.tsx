import { describe, it, expect } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { renderAppRoute } from "#test/render.tsx";

describe("Downloads page", () => {
    it("renders the archive table with download versions", async () => {
        const { rendered } = renderAppRoute("/downloads");

        await waitFor(() => {
            expect(
                screen.getByRole("heading", { name: "Archive" }),
            ).toBeInTheDocument();
        });
        const table = screen.getByRole("table", { name: "Archive" });
        expect(table).toBeInTheDocument();
        // Check column headers
        expect(within(table).getByText("Version")).toBeInTheDocument();
        expect(within(table).getByText("Operating System")).toBeInTheDocument();
        expect(within(table).getByText("Released At")).toBeInTheDocument();

        rendered.unmount();
    });

    it("shows download links pointing to GitHub releases", async () => {
        const { rendered } = renderAppRoute("/downloads");

        await waitFor(() => {
            expect(
                screen.getByRole("table", { name: "Archive" }),
            ).toBeInTheDocument();
        });
        const links = screen.getAllByText(/Prism overlay v/);
        expect(links.length).toBeGreaterThan(0);
        // First link should point to a GitHub release
        expect(links[0].closest("a")).toHaveAttribute(
            "href",
            expect.stringContaining("github.com/Amund211/prism/releases"),
        );

        rendered.unmount();
    });

    it("shows OS labels in the archive", async () => {
        const { rendered } = renderAppRoute("/downloads");

        await waitFor(() => {
            expect(
                screen.getByRole("table", { name: "Archive" }),
            ).toBeInTheDocument();
        });
        expect(screen.getAllByText("Windows").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Mac OS").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Linux").length).toBeGreaterThan(0);

        rendered.unmount();
    });

    it("renders trademark attribution footnotes", async () => {
        const { rendered } = renderAppRoute("/downloads");

        await waitFor(() => {
            expect(
                screen.getByText(/Windows and the Windows logo/),
            ).toBeInTheDocument();
        });
        expect(
            screen.getByText(/macOS and the Apple logo/),
        ).toBeInTheDocument();
        expect(
            screen.getByText(/Linux is the registered trademark/),
        ).toBeInTheDocument();

        rendered.unmount();
    });
});
