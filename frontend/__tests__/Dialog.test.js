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

test('uses the native modal top layer and keeps controlled Escape dismissal in sync', () => {
  const dismiss=jest.fn();
  const {unmount}=render(<Dialog title="Delete record?" onDismiss={dismiss}><button>Cancel</button></Dialog>);
  const dialog=screen.getByRole('dialog',{name:'Delete record?'});
  expect(dialog.tagName).toBe('DIALOG');expect(dialog).toHaveAttribute('open');
  expect(document.body.style.overflow).toBe('hidden');
  const event=new Event('cancel',{bubbles:true,cancelable:true});dialog.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);expect(dismiss).toHaveBeenCalledTimes(1);
  unmount();expect(document.body.style.overflow).not.toBe('hidden');
});
