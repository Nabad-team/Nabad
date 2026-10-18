// Automated tests for the page frame: the browser tab title, the link preview tags and the site footer.
import { render, screen, within } from "@testing-library/react";
import PageLayout, { pageTitle } from "../components/ui/PageLayout";

// next/head only fills <head> inside a running Next.js app; here it renders its tags in place.
jest.mock("next/head", () => ({ __esModule: true, default: ({ children }) => <>{children}</> }));

const meta = (attribute, name) => document.querySelector(`meta[${attribute}="${name}"]`)?.getAttribute("content");

describe("PageLayout", () => {
  test("titles a page as '<page> · Nabad'", () => {
    expect(pageTitle("Log in")).toBe("Log in · Nabad");
    expect(pageTitle("My profile")).toBe("My profile · Nabad");
  });

  test("uses the site title when no page title is given (the landing page)", () => {
    expect(pageTitle()).toBe("Nabad: know where to go when it matters");
  });

  test("sets the tab title, description and Open Graph preview", () => {
    render(<PageLayout title="Dashboard">content</PageLayout>);

    expect(document.querySelector("title")).toHaveTextContent("Dashboard · Nabad");
    expect(meta("name", "description")).toMatch(/hospital/);
    expect(meta("property", "og:title")).toBe("Dashboard · Nabad");
    expect(meta("property", "og:description")).toBe(meta("name", "description"));
    expect(meta("property", "og:image")).toBe("https://nabad-psi.vercel.app/og-image.png");
  });

  test("every page gets a footer with the legal links, the disclaimer and the team credit", () => {
    render(<PageLayout title="Dashboard">content</PageLayout>);

    const footer = screen.getByRole("contentinfo");
    const links = within(within(footer).getByRole("navigation", { name: "Footer" })).getAllByRole("link");
    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["Privacy", "/privacy"],
      ["Terms of Use", "/terms"],
      ["Contact", "/contact"],
    ]);
    expect(footer).toHaveTextContent("Nabad gives guidance, not a diagnosis. In an emergency, call 140.");
    expect(within(footer).getByRole("link", { name: "140" })).toHaveAttribute("href", "tel:140");
    expect(footer).toHaveTextContent("© 2026 Nabad");
    expect(footer).toHaveTextContent("Built by Team 3 for CMPS 271 at the American University of Beirut.");
  });

  test("a page's own note goes above the site footer, outside it", () => {
    render(<PageLayout title="Privacy Policy" footer={<p>A page note</p>}>content</PageLayout>);

    expect(screen.getByText("A page note")).toBeInTheDocument();
    expect(within(screen.getByRole("contentinfo")).queryByText("A page note")).not.toBeInTheDocument();
  });
});
