import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderAppRoute } from "#test/render.tsx";

describe("About page", () => {
    it("renders Discord section with invite link", async () => {
        const { rendered } = renderAppRoute("/about");

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

        rendered.unmount();
    });

    it("renders Disclaimer section", async () => {
        const { rendered } = renderAppRoute("/about");

        await waitFor(() => {
            expect(
                screen.getByRole("heading", { name: "Disclaimer" }),
            ).toBeInTheDocument();
        });
        expect(
            screen.getByText(/not associated with or endorsed by Mojang/),
        ).toBeInTheDocument();

        rendered.unmount();
    });

    it("renders Privacy section", async () => {
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
        const { rendered } = renderAppRoute("/about");

        await waitFor(() => {
            expect(
                screen.getByRole("heading", { name: "Hypixel API Policy" }),
            ).toBeInTheDocument();
        });
        expect(screen.getByText("Hypixel API policy")).toBeInTheDocument();

        rendered.unmount();
    });
});
