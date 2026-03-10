import { expect } from "vitest";
import { screen } from "@testing-library/react";

export function expectVariantToggle() {
    expect(
        screen.getByRole("group", { name: "Stat chart variant selection" }),
    ).toBeInTheDocument();
    expect(screen.getByText("All time")).toBeInTheDocument();
    expect(screen.getByText("Session")).toBeInTheDocument();
    expect(screen.getByText("Both")).toBeInTheDocument();
}
