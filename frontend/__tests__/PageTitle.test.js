// The page header row: title and lead on the left, one primary action and a More menu on the right.
import { render, screen, fireEvent } from "@testing-library/react";
import PageTitle from "../components/ui/PageTitle";
import MoreMenu from "../components/ui/MoreMenu";
import Button from "../components/ui/Button";

describe("PageTitle", () => {
  test("without actions it is just the heading and lead", () => {
    const { container } = render(<PageTitle lead="One line.">My vitals</PageTitle>);
    expect(screen.getByRole("heading", { level: 1, name: "My vitals" })).toBeInTheDocument();
    expect(screen.getByText("One line.")).toBeInTheDocument();
    expect(container.querySelector(".page-title__actions")).toBeNull();
  });

  test("puts the primary action and More in the same row as the heading", () => {
    const { container } = render(
      <PageTitle lead="One line." action={<Button>Log reading</Button>} more={<MoreMenu id="m" items={[{ label: "Print", onClick: () => {} }]} />}>My vitals</PageTitle>
    );
    const actions = container.querySelector(".page-title__actions");
    expect(container.querySelector(".page-title")).toHaveClass("page-title--with-actions");
    expect(actions).toContainElement(screen.getByRole("button", { name: "Log reading" }));
    expect(actions).toContainElement(screen.getByRole("button", { name: "More" }));
  });
});

describe("MoreMenu", () => {
  test("is a disclosure: opens, focuses its first item, runs the action and closes", () => {
    const print = jest.fn();
    render(<MoreMenu id="more" items={[false, { label: "Print", onClick: print }, { label: "Overview", href: "/medication-overview" }]} />);
    const button = screen.getByRole("button", { name: "More" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(button).toHaveAttribute("aria-controls", "more");
    expect(screen.getByRole("button", { name: "Print" })).toHaveFocus();
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("href", "/medication-overview");
    fireEvent.click(screen.getByRole("button", { name: "Print" }));
    expect(print).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Print" })).not.toBeInTheDocument();
  });

  test("Escape closes it and returns focus to the button", () => {
    render(<MoreMenu id="more" items={[{ label: "Print", onClick: () => {} }]} />);
    const button = screen.getByRole("button", { name: "More" });
    fireEvent.click(button);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("button", { name: "Print" })).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  test("renders nothing when every item is hidden", () => {
    const { container } = render(<MoreMenu id="more" items={[false, null]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
