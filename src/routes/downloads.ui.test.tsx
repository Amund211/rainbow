import { describe, it, expect } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { renderRoute } from "#test/render.tsx";
import { Route } from "./downloads.tsx";

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const DownloadsPage = Route.options.component!;

describe("Downloads page", () => {
    it("renders the archive table with download versions", async () => {
        renderRoute(DownloadsPage, { route: "/downloads" });
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
    });

    it("shows download links pointing to GitHub releases", async () => {
        renderRoute(DownloadsPage, { route: "/downloads" });
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
    });

    it("shows OS labels in the archive", async () => {
        renderRoute(DownloadsPage, { route: "/downloads" });
        await waitFor(() => {
            expect(
                screen.getByRole("table", { name: "Archive" }),
            ).toBeInTheDocument();
        });
        expect(screen.getAllByText("Windows").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Mac OS").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Linux").length).toBeGreaterThan(0);
    });

    it("renders trademark attribution footnotes", async () => {
        renderRoute(DownloadsPage, { route: "/downloads" });
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
    });
});
