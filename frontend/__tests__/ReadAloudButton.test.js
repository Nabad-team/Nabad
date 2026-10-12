import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReadAloudButton from "../components/ReadAloudButton";

describe("ReadAloudButton", () => {
  const originalUtterance = window.SpeechSynthesisUtterance;

  beforeEach(() => {
    window.speechSynthesis = {
      cancel: jest.fn(),
      speak: jest.fn(),
    };
    window.SpeechSynthesisUtterance = jest.fn(() => ({}));
  });

  afterEach(() => {
    window.SpeechSynthesisUtterance = originalUtterance;
  });

  test("reads text aloud and can stop reading", async () => {
    const user = userEvent.setup({ delay: null });
    render(<ReadAloudButton text="Drink water." />);

    await user.click(screen.getByRole("button", { name: "Read aloud" }));

    expect(window.SpeechSynthesisUtterance).toHaveBeenCalledWith("Drink water.");
    expect(window.speechSynthesis.cancel).toHaveBeenCalled();
    expect(window.speechSynthesis.speak).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Stop reading" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Stop reading" }));

    expect(window.speechSynthesis.cancel).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "Read aloud" })).toBeInTheDocument();
  });

  test("does not render when speech synthesis is unavailable", () => {
    delete window.SpeechSynthesisUtterance;

    render(<ReadAloudButton text="Drink water." />);

    expect(screen.queryByRole("button", { name: "Read aloud" })).not.toBeInTheDocument();
  });
});
