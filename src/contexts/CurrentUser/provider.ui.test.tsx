import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { CurrentUserProvider } from "./provider.tsx";
import { CurrentUserContext } from "./context.ts";
import React from "react";

const UUID_A = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const UUID_B = "11111111-2222-3333-4444-555555555555";

function TestConsumer() {
    const ctx = React.useContext(CurrentUserContext);
    if (!ctx) return <div>no context</div>;
    return (
        <div>
            <div data-testid="current">{ctx.currentUser ?? "none"}</div>
            <button onClick={() => ctx.setCurrentUser(UUID_A)}>Set A</button>
            <button onClick={() => ctx.setCurrentUser(UUID_B)}>Set B</button>
            <button onClick={() => ctx.setCurrentUser(null)}>Clear</button>
        </div>
    );
}

describe("CurrentUserProvider", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("provides context to children", () => {
        render(
            <CurrentUserProvider>
                <TestConsumer />
            </CurrentUserProvider>,
        );
        expect(screen.getByTestId("current")).toBeInTheDocument();
    });

    it("starts with null when localStorage is empty", () => {
        render(
            <CurrentUserProvider>
                <TestConsumer />
            </CurrentUserProvider>,
        );
        expect(screen.getByTestId("current").textContent).toBe("none");
    });

    it("sets current user", async () => {
        render(
            <CurrentUserProvider>
                <TestConsumer />
            </CurrentUserProvider>,
        );
        await act(async () => {
            screen.getByText("Set A").click();
        });
        expect(screen.getByTestId("current").textContent).toBe(UUID_A);
    });

    it("persists to localStorage", async () => {
        render(
            <CurrentUserProvider>
                <TestConsumer />
            </CurrentUserProvider>,
        );
        await act(async () => {
            screen.getByText("Set A").click();
        });
        expect(localStorage.getItem("currentUser")).toBe(UUID_A);
    });

    it("clears current user", async () => {
        render(
            <CurrentUserProvider>
                <TestConsumer />
            </CurrentUserProvider>,
        );
        await act(async () => {
            screen.getByText("Set A").click();
        });
        expect(screen.getByTestId("current").textContent).toBe(UUID_A);

        await act(async () => {
            screen.getByText("Clear").click();
        });
        expect(screen.getByTestId("current").textContent).toBe("none");
        expect(localStorage.getItem("currentUser")).toBeNull();
    });

    it("loads from localStorage on mount", () => {
        localStorage.setItem("currentUser", UUID_B);
        render(
            <CurrentUserProvider>
                <TestConsumer />
            </CurrentUserProvider>,
        );
        expect(screen.getByTestId("current").textContent).toBe(UUID_B);
    });

    it("switches between users", async () => {
        render(
            <CurrentUserProvider>
                <TestConsumer />
            </CurrentUserProvider>,
        );
        await act(async () => {
            screen.getByText("Set A").click();
        });
        expect(screen.getByTestId("current").textContent).toBe(UUID_A);

        await act(async () => {
            screen.getByText("Set B").click();
        });
        expect(screen.getByTestId("current").textContent).toBe(UUID_B);
        expect(localStorage.getItem("currentUser")).toBe(UUID_B);
    });
});
