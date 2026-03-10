import { describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderRoute, getRouteComponent } from "#test/render.tsx";
import { Route } from "./settings.tsx";

const SettingsPage = getRouteComponent(Route);

describe("Settings page", () => {
    beforeEach(() => {
        renderRoute(SettingsPage, { route: "/settings" });
    });

    it("renders Default player heading", async () => {
        await waitFor(() => {
            expect(
                screen.getByRole("heading", { name: "Default player" }),
            ).toBeInTheDocument();
        });
    });

    it("renders info tooltip about default player", async () => {
        await waitFor(() => {
            expect(screen.getByTestId("InfoOutlinedIcon")).toBeInTheDocument();
        });
    });

    it("renders the user multi-select input", async () => {
        await waitFor(() => {
            expect(
                screen.getByPlaceholderText("Set default player"),
            ).toBeInTheDocument();
        });
    });
});
