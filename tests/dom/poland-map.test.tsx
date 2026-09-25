import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import PolandMap, { type MapCity, type MapRegion } from "../../src/components/PolandMap";
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
    currentStatus: "CALM",
    lastClassifiedAt: "2026-01-01T00:00:00.000Z",
    statusReason: "No incident specific to this region was reported. Based on Poland-wide reporting from the last 48 hours; nothing named Dolnośląskie directly.",
  },
  {
    code: "PL-14",
    slug: "mazowieckie",
    namePl: "Mazowieckie",
    nameEn: "Mazowieckie",
    currentStatus: "ELEVATED",
    lastClassifiedAt: "2026-01-01T00:00:00.000Z",
    statusReason: "Drone, missile or airspace activity was reported in or near this region. Based on 3 recent headlines mentioning Mazowieckie.",
  },
  {
    code: "PL-26",
    slug: "swietokrzyskie",
    namePl: "Świętokrzyskie",
    nameEn: "Swietokrzyskie",
    currentStatus: "UNKNOWN",
    lastClassifiedAt: null,
    statusReason: null,
  },
];

const cities: MapCity[] = [
  { name: "Wrocław", regionSlug: "dolnoslaskie", lat: 51.11, lon: 17.03, isCapital: true, mapVisibility: "always", x: 1, y: 1 },
  { name: "Warsaw", regionSlug: "mazowieckie", lat: 52.23, lon: 21.01, isCapital: true, aliases: ["Warszawa"], mapVisibility: "always", x: 2, y: 2 },
  { name: "Radom", regionSlug: "mazowieckie", lat: 51.4, lon: 21.15, isCapital: false, mapVisibility: "never", x: 2, y: 3 },
  { name: "Kielce", regionSlug: "swietokrzyskie", lat: 50.87, lon: 20.63, isCapital: true, mapVisibility: "always", x: 4, y: 4 },
];

describe("PolandMap", () => {
  it("renders exactly as many interactive regions as it is given", () => {
    render(<PolandMap viewBox="0 0 10 10" paths={paths} regions={regions} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(3);
  });

  it("labels each region with its status text", () => {
    render(<PolandMap viewBox="0 0 10 10" paths={paths} regions={regions} />);
    expect(screen.getByRole("button", { name: /Mazowieckie: Elevated/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Dolnośląskie: Calm/i })).toBeInTheDocument();
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
    expect(within(panel).getByTestId("region-status-badge")).toHaveTextContent("Elevated");
  });

  it("explains why the region has its colour, not just the generic level description", async () => {
    const user = userEvent.setup();
    render(<PolandMap viewBox="0 0 10 10" paths={paths} regions={regions} />);
    await user.click(screen.getByTestId("region-mazowieckie"));
    const panel = screen.getByTestId("region-details-panel");
    expect(within(panel).getByTestId("region-status-reason")).toHaveTextContent(/airspace activity was reported/i);
    expect(within(panel).getByTestId("region-status-reason")).toHaveTextContent(/3 recent headlines mentioning Mazowieckie/i);
  });

  it("falls back to the level description when no reason has been recorded yet", () => {
    render(<PolandMap viewBox="0 0 10 10" paths={paths} regions={regions} />);
    fireEvent.keyDown(screen.getByTestId("region-swietokrzyskie"), { key: "Enter" });
    const panel = screen.getByTestId("region-details-panel");
    expect(within(panel).getByTestId("region-status-reason")).toBeInTheDocument();
  });

  it("no longer shows classification or expiry timestamps", async () => {
    const user = userEvent.setup();
    render(<PolandMap viewBox="0 0 10 10" paths={paths} regions={regions} />);
    await user.click(screen.getByTestId("region-mazowieckie"));
    const panel = screen.getByTestId("region-details-panel");
    expect(within(panel).queryByText(/Last classified/i)).not.toBeInTheDocument();
    expect(within(panel).queryByText(/expires/i)).not.toBeInTheDocument();
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
    expect(unknownPath.getAttribute("class")).not.toMatch(/fill-status-calm/);
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

  describe("city labels and search", () => {
    it("draws a marker for every map-visible city and none for text-only cities", () => {
      render(<PolandMap viewBox="0 0 10 10" paths={paths} regions={regions} cities={cities} />);
      const markers = screen.getByTestId("city-markers");
      expect(within(markers).getByText("Warsaw")).toBeInTheDocument();
      expect(within(markers).getByText("Wrocław")).toBeInTheDocument();
      expect(within(markers).queryByText("Radom")).not.toBeInTheDocument();
    });

    it("keeps city markers out of the accessibility tree and off the click path", () => {
      render(<PolandMap viewBox="0 0 10 10" paths={paths} regions={regions} cities={cities} />);
      const markers = screen.getByTestId("city-markers");
      expect(markers).toHaveAttribute("aria-hidden", "true");
      expect(markers.getAttribute("class")).toMatch(/pointer-events-none/);
      // Still exactly one button per region: the labels add no extra controls.
      expect(screen.getAllByRole("button")).toHaveLength(3);
    });

    it("mentions main cities in the region's accessible name", () => {
      render(<PolandMap viewBox="0 0 10 10" paths={paths} regions={regions} cities={cities} />);
      expect(screen.getByRole("button", { name: /Mazowieckie: Elevated.*Main cities: Warsaw \(capital\), Radom/i })).toBeInTheDocument();
    });

    it("lists main cities in the details panel, capital first", async () => {
      const user = userEvent.setup();
      render(<PolandMap viewBox="0 0 10 10" paths={paths} regions={regions} cities={cities} />);
      await user.click(screen.getByTestId("region-mazowieckie"));
      expect(screen.getByTestId("region-cities")).toHaveTextContent("Main cities: Warsaw (capital), Radom");
    });

    it("omits the cities line when a region has no city data", async () => {
      const user = userEvent.setup();
      render(<PolandMap viewBox="0 0 10 10" paths={paths} regions={regions} cities={[]} />);
      await user.click(screen.getByTestId("region-mazowieckie"));
      expect(screen.queryByTestId("region-cities")).not.toBeInTheDocument();
    });

    it("selects a region by searching for one of its cities, ignoring diacritics", async () => {
      const user = userEvent.setup();
      render(<PolandMap viewBox="0 0 10 10" paths={paths} regions={regions} cities={cities} />);
      await user.type(screen.getByLabelText(/Find your city/i), "wroc");
      const results = screen.getByTestId("city-search-results");
      await user.click(within(results).getByRole("button", { name: /Wrocław/ }));
      const panel = screen.getByTestId("region-details-panel");
      expect(within(panel).getByRole("heading", { name: "Dolnośląskie" })).toBeInTheDocument();
      expect(screen.getByTestId("region-dolnoslaskie")).toHaveAttribute("aria-pressed", "true");
      expect(screen.queryByTestId("city-search-results")).not.toBeInTheDocument();
    });

    it("finds cities by alias and selects the first match on Enter", async () => {
      const user = userEvent.setup();
      render(<PolandMap viewBox="0 0 10 10" paths={paths} regions={regions} cities={cities} />);
      await user.type(screen.getByLabelText(/Find your city/i), "warszawa{Enter}");
      const panel = screen.getByTestId("region-details-panel");
      expect(within(panel).getByRole("heading", { name: "Mazowieckie" })).toBeInTheDocument();
    });

    it("also matches voivodeship names", async () => {
      const user = userEvent.setup();
      render(<PolandMap viewBox="0 0 10 10" paths={paths} regions={regions} cities={cities} />);
      await user.type(screen.getByLabelText(/Find your city/i), "swieto");
      expect(within(screen.getByTestId("city-search-results")).getByText("Świętokrzyskie")).toBeInTheDocument();
    });

    it("tells the user when nothing matches", async () => {
      const user = userEvent.setup();
      render(<PolandMap viewBox="0 0 10 10" paths={paths} regions={regions} cities={cities} />);
      await user.type(screen.getByLabelText(/Find your city/i), "berlin");
      expect(screen.getByTestId("city-search-results")).toHaveTextContent(/No city or voivodeship matches/);
    });
  });
});
