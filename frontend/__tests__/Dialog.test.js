import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Dialog from "../components/Dialog";

test("keeps keyboard focus inside and restores it when closed", async () => {
  const user = userEvent.setup({ delay: null });
  function Example({ open }) {
    return <><button>Open dialog</button>{open && <Dialog title="Confirm action"><button>Cancel</button><button>Confirm</button></Dialog>}</>;
  }
  const { rerender } = render(<Example open={false} />);
  const trigger = screen.getByRole("button", { name: "Open dialog" });
  trigger.focus();
  rerender(<Example open />);
  expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  await user.tab({ shift: true });
  expect(screen.getByRole("button", { name: "Confirm" })).toHaveFocus();
  await user.tab();
  expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  rerender(<Example open={false} />);
  expect(trigger).toHaveFocus();
});
