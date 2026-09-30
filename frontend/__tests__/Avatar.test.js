// Tests for the local default avatar (initials or person icon, no network requests).

import { fireEvent, render, screen } from "@testing-library/react";
import Avatar, { AVATAR_COLORS, avatarColor, initialsFor } from "../components/Avatar";

// WCAG 2 contrast ratio between a hex color and white.
function contrastWithWhite(hex) {
  const channel = (i) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
  return 1.05 / (luminance + 0.05);
}

// Every src/href in the rendered output must be local (data: or a relative path).
function externalUrls(container) {
  return [...container.querySelectorAll("[src],[href]")]
    .map((el) => el.getAttribute("src") || el.getAttribute("href"))
    .filter((url) => /^(https?:)?\/\//i.test(url));
}

describe("initials", () => {
  test("uses the first letter of the first and last name", () => {
    expect(initialsFor("Sami Haddad")).toBe("SH");
    expect(initialsFor("  lina   maria  khoury ")).toBe("LK");
    expect(initialsFor("Sami")).toBe("S");
    expect(initialsFor("عمر خالد")).toBe("عخ");
    expect(initialsFor("")).toBe("");
    expect(initialsFor(undefined)).toBe("");
  });

  test("renders the initials with the person's name as the accessible label", () => {
    const { container } = render(<Avatar name="Sami Haddad" />);
    const avatar = screen.getByRole("img", { name: "Profile picture of Sami Haddad" });
    expect(avatar).toHaveTextContent("SH");
    expect(container.querySelector("img")).toBeNull();
    expect(externalUrls(container)).toEqual([]);
  });

  test("shows a person icon when there is no name", () => {
    const { container } = render(<Avatar name="  " />);
    const avatar = screen.getByRole("img", { name: "Profile picture" });
    expect(avatar.querySelector("svg")).not.toBeNull();
    expect(avatar).toHaveTextContent("");
    expect(externalUrls(container)).toEqual([]);
  });
});

describe("color", () => {
  test("is the same every time for the same name", () => {
    expect(avatarColor("Sami Haddad")).toBe(avatarColor("Sami Haddad"));
    expect(avatarColor("sami haddad ")).toBe(avatarColor("Sami Haddad"));
    const colors = new Set(["Sami", "Lina", "Omar", "Maya", "Demo User", "Rami"].map(avatarColor));
    expect(colors.size).toBeGreaterThan(1);
  });

  test.each(AVATAR_COLORS)("%s keeps white text at WCAG AA contrast (4.5:1)", (color) => {
    expect(contrastWithWhite(color)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("uploaded pictures", () => {
  const picture = "data:image/png;base64,iVBORw0KGgo=";

  test("shows the picture with the person's name as alt text", () => {
    render(<Avatar name="Sami Haddad" src={picture} />);
    expect(screen.getByRole("img", { name: "Profile picture of Sami Haddad" })).toHaveAttribute("src", picture);
  });

  test("falls back to the initials when the picture fails to load", () => {
    const { container, rerender } = render(<Avatar name="Sami Haddad" src={picture} />);
    fireEvent.error(container.querySelector("img"));
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("img", { name: "Profile picture of Sami Haddad" })).toHaveTextContent("SH");

    // A newly uploaded picture is tried again.
    const newPicture = "data:image/jpeg;base64,/9j/4AAQ";
    rerender(<Avatar name="Sami Haddad" src={newPicture} />);
    expect(container.querySelector("img")).toHaveAttribute("src", newPicture);
  });
});
