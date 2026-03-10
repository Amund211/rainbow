import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderRoute } from "#test/render.tsx";
import { Route } from "./settings.tsx";

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const SettingsPage = Route.options.component!;

describe("Settings page", () => {
    it("renders Default player heading", async () => {
        renderRoute(SettingsPage, { route: "/settings" });
        await waitFor(() => {
            expect(
                screen.getByRole("heading", { name: "Default player" }),
            ).toBeInTheDocument();
        });
    });

    it("renders info tooltip about default player", async () => {
        renderRoute(SettingsPage, { route: "/settings" });
        await waitFor(() => {
            expect(screen.getByTestId("InfoOutlinedIcon")).toBeInTheDocument();
        });
    });

    it("renders the user multi-select input", async () => {
        renderRoute(SettingsPage, { route: "/settings" });
        await waitFor(() => {
            expect(
                screen.getByPlaceholderText("Set default player"),
            ).toBeInTheDocument();
        });
    });
});
