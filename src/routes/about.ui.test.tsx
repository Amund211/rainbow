import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderRoute } from "#test/render.tsx";
import { Route } from "./about.tsx";

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const AboutPage = Route.options.component!;

describe("About page", () => {
    it("renders Discord section with invite link", async () => {
        renderRoute(AboutPage, { route: "/about" });
        await waitFor(() => {
            expect(
                screen.getByRole("heading", { name: "Discord" }),
            ).toBeInTheDocument();
        });
        const link = screen.getByText("Join our Discord server");
        expect(link).toBeInTheDocument();
        expect(link.closest("a")).toHaveAttribute(
            "href",
            "https://discord.gg/k4FGUnEHYg",
        );
    });

    it("renders Disclaimer section", async () => {
        renderRoute(AboutPage, { route: "/about" });
        await waitFor(() => {
            expect(
                screen.getByRole("heading", { name: "Disclaimer" }),
            ).toBeInTheDocument();
        });
        expect(
            screen.getByText(/not associated with or endorsed by Mojang/),
        ).toBeInTheDocument();
    });

    it("renders Privacy section", async () => {
        renderRoute(AboutPage, { route: "/about" });
        await waitFor(() => {
            expect(
                screen.getByRole("heading", { name: "Privacy" }),
            ).toBeInTheDocument();
        });
        expect(
            screen.getByText(/does not collect any personal data/),
        ).toBeInTheDocument();
    });

    it("renders Hypixel API Policy section", async () => {
        renderRoute(AboutPage, { route: "/about" });
        await waitFor(() => {
            expect(
                screen.getByRole("heading", { name: "Hypixel API Policy" }),
            ).toBeInTheDocument();
        });
        expect(screen.getByText("Hypixel API policy")).toBeInTheDocument();
    });
});
