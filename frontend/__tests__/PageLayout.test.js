// Automated tests for the page frame: the browser tab title and the link preview tags.
import { render } from "@testing-library/react";
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
});
