// Loading placeholders: one "Loading" for screen readers per region, shapes hidden from them, still with reduced motion.
import fs from "fs";
import path from "path";
import { render, screen, within } from "@testing-library/react";
import PageTitle from "../components/ui/PageTitle";
import { MedicationsSkeleton, AppointmentsSkeleton, DocumentsSkeleton, VitalsSkeleton, HealthSkeleton, ProvidersSkeleton, HealthTilesSkeleton, SkeletonRegion } from "../components/ui/Skeleton";

const SKELETONS = { MedicationsSkeleton, AppointmentsSkeleton, DocumentsSkeleton, VitalsSkeleton, HealthSkeleton, ProvidersSkeleton };

describe("Loading placeholders", () => {
  test.each(Object.entries(SKELETONS))("%s: aria-busy region, one status, shapes hidden", (name, Skeleton) => {
    const { container } = render(<Skeleton label="Loading things..." />);
    const region = container.firstChild;
    expect(region).toHaveAttribute("aria-busy", "true");
    const statuses = screen.getAllByRole("status");
    expect(statuses).toHaveLength(1);
    expect(statuses[0]).toHaveTextContent("Loading things...");
    expect(region.querySelector(".skeleton__shapes")).toHaveAttribute("aria-hidden", "true");
    expect(region.querySelectorAll(".skeleton__bone").length).toBeGreaterThan(3);
    // No buttons, links or fields for a keyboard or screen reader to land on while loading.
    expect(region.querySelectorAll("a, button, input, select, [tabindex]")).toHaveLength(0);
  });

  test("the page skeletons reuse the real list classes, so the layout matches", () => {
    expect(render(<MedicationsSkeleton />).container.querySelectorAll("ul.medication-list > li.medication")).toHaveLength(3);
    expect(render(<AppointmentsSkeleton />).container.querySelectorAll("ul.appointment-list > li.appointment")).toHaveLength(2);
    expect(render(<DocumentsSkeleton />).container.querySelectorAll("ul.medical-documents__list > li")).toHaveLength(3);
    expect(render(<ProvidersSkeleton />).container.querySelectorAll("ul.provider-list > li.provider-card")).toHaveLength(4);
    expect(render(<VitalsSkeleton />).container.querySelector(".vitals-charts")).not.toBeNull();
    expect(render(<HealthSkeleton />).container.querySelector(".card-grid")).not.toBeNull();
    expect(render(<HealthTilesSkeleton />).container.querySelectorAll("ul.tile-grid > li.tile-grid__item > .tile")).toHaveLength(7);
  });

  test("the default label is Loading...", () => {
    render(<SkeletonRegion><span /></SkeletonRegion>);
    expect(within(screen.getByRole("status")).getByText("Loading...")).toBeInTheDocument();
  });

  test("the shimmer stops with reduced motion, and placeholders never print", () => {
    const css = fs.readFileSync(path.join(__dirname, "../styles/components.css"), "utf8").replace(/\r\n/g, "\n");
    expect(css).toMatch(/\.skeleton__bone \{[^}]*animation: skeleton-shimmer/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\n  \.skeleton__bone \{ animation: none;/);
    expect(css).toMatch(/@media print \{ \.skeleton \{ display: none; \} \}/);
  });

  test("a page title holds its action row while loading, hidden from screen readers", () => {
    const { container, rerender } = render(<PageTitle loadingActions={2}>My medications</PageTitle>);
    const placeholders = container.querySelectorAll(".page-title__placeholder");
    expect(placeholders).toHaveLength(2);
    placeholders.forEach((placeholder) => expect(placeholder).toHaveAttribute("aria-hidden", "true"));
    expect(screen.queryByRole("button")).toBeNull();
    // Once loaded the real action replaces them.
    rerender(<PageTitle loadingActions={0} action={<button type="button">Add medication</button>}>My medications</PageTitle>);
    expect(container.querySelectorAll(".page-title__placeholder")).toHaveLength(0);
    // An action already shown takes one of the places.
    rerender(<PageTitle loadingActions={2} more={<span>More</span>}>My appointments</PageTitle>);
    expect(container.querySelectorAll(".page-title__placeholder")).toHaveLength(1);
  });
});
