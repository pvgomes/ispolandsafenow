import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import PolandMap, { type MapRegion } from "../../src/components/PolandMap";
import type { RegionPath } from "../../src/domain/parse-map-svg";

const paths: RegionPath[] = [
  { code: "PL-02", slug: "dolnoslaskie", name: "Dolnośląskie", d: "M0,0 L1,1 L1,0 Z" },
  { code: "PL-14", slug: "mazowieckie", name: "Mazowieckie", d: "M2,2 L3,3 L3,2 Z" },
  { code: "PL-26", slug: "swietokrzyskie", name: "Świętokrzyskie", d: "M4,4 L5,5 L5,4 Z" },
];

const regions: MapRegion[] = [
  {
    code: "PL-02",
    slug: "dolnoslaskie",
    namePl: "Dolnośląskie",
    nameEn: "Dolnoslaskie",
    currentStatus: "GREEN",
    lastClassifiedAt: "2026-01-01T00:00:00.000Z",
    statusExpiresAt: "2026-01-02T00:00:00.000Z",
  },
  {
    code: "PL-14",
    slug: "mazowieckie",
    namePl: "Mazowieckie",
    nameEn: "Mazowieckie",
    currentStatus: "RED",
    lastClassifiedAt: "2026-01-01T00:00:00.000Z",
    statusExpiresAt: "2026-01-02T00:00:00.000Z",
  },
  {
    code: "PL-26",
    slug: "swietokrzyskie",
    namePl: "Świętokrzyskie",
    nameEn: "Swietokrzyskie",
    currentStatus: "UNKNOWN",
    lastClassifiedAt: null,
    statusExpiresAt: null,
  },
];

describe("PolandMap", () => {
  it("renders exactly as many interactive regions as it is given", () => {
    render(<PolandMap viewBox="0 0 10 10" paths={paths} regions={regions} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(3);
  });

  it("labels each region with its status text", () => {
    render(<PolandMap viewBox="0 0 10 10" paths={paths} regions={regions} />);
    expect(screen.getByRole("button", { name: /Mazowieckie: Red/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Dolnośląskie: Green/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Świętokrzyskie: Unknown/i })).toBeInTheDocument();
  });

  it("shows placeholder text in the details panel before any selection", () => {
    render(<PolandMap viewBox="0 0 10 10" paths={paths} regions={regions} />);
    const panel = screen.getByTestId("region-details-panel");
    expect(within(panel).getByText(/Select a voivodeship/i)).toBeInTheDocument();
  });

  it("opens the details panel with the right status on mouse click", async () => {
    const user = userEvent.setup();
    render(<PolandMap viewBox="0 0 10 10" paths={paths} regions={regions} />);
    await user.click(screen.getByTestId("region-mazowieckie"));
    const panel = screen.getByTestId("region-details-panel");
    expect(within(panel).getByRole("heading", { name: "Mazowieckie" })).toBeInTheDocument();
    expect(within(panel).getByTestId("region-status-badge")).toHaveTextContent("Red");
  });

  it("is keyboard-operable: Tab focuses a region, Enter selects it", () => {
    render(<PolandMap viewBox="0 0 10 10" paths={paths} regions={regions} />);
    const region = screen.getByTestId("region-dolnoslaskie");
    region.focus();
    expect(region).toHaveFocus();
    fireEvent.keyDown(region, { key: "Enter" });
    const panel = screen.getByTestId("region-details-panel");
    expect(within(panel).getByText("Dolnośląskie")).toBeInTheDocument();
    expect(region).toHaveAttribute("aria-pressed", "true");
  });

  it("also selects on Space, matching standard button keyboard behavior", () => {
    render(<PolandMap viewBox="0 0 10 10" paths={paths} regions={regions} />);
    const region = screen.getByTestId("region-swietokrzyskie");
    fireEvent.keyDown(region, { key: " " });
    const panel = screen.getByTestId("region-details-panel");
    expect(within(panel).getByTestId("region-status-badge")).toHaveTextContent("Unknown");
  });

  it("renders an unknown region without ever presenting it as green", () => {
    render(<PolandMap viewBox="0 0 10 10" paths={paths} regions={regions} />);
    const unknownPath = screen.getByTestId("region-swietokrzyskie");
    expect(unknownPath).toHaveAttribute("data-status", "UNKNOWN");
    expect(unknownPath.getAttribute("class")).not.toMatch(/fill-status-green/);
  });

  it("falls back to UNKNOWN styling for a mapped region with no status data at all", () => {
    render(<PolandMap viewBox="0 0 10 10" paths={paths} regions={[]} />);
    const path = screen.getByTestId("region-mazowieckie");
    expect(path).toHaveAttribute("data-status", "UNKNOWN");
  });

  it("is a fluid, non-fixed-width SVG suitable for narrow (320px) viewports", () => {
    render(<PolandMap viewBox="0 0 10 10" paths={paths} regions={regions} />);
    const svg = screen.getByTestId("poland-map");
    expect(svg).not.toHaveAttribute("width");
    expect(svg).not.toHaveAttribute("height");
    expect(svg.getAttribute("class")).toMatch(/w-full/);
  });
});
