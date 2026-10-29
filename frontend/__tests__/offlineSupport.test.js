import { render,screen,fireEvent } from "@testing-library/react";
import OfflineSupport from "../components/OfflineSupport";
test("connection loss exposes English emergency contact without signing in, and reconnection clears it",()=>{
 const state=jest.spyOn(navigator,"onLine","get").mockReturnValue(true);
 const view=render(<OfflineSupport/>);expect(screen.queryByRole("status")).not.toBeInTheDocument();
 state.mockReturnValue(false);fireEvent(window,new Event("offline"));
 expect(screen.getByRole("status")).toHaveTextContent("You are offline");
 expect(screen.getByRole("link",{name:"call 140"})).toHaveAttribute("href","tel:140");
 expect(screen.getByRole("link",{name:"Open emergency help"})).toHaveAttribute("href","/offline.html");
 state.mockReturnValue(true);fireEvent(window,new Event("online"));expect(screen.queryByRole("status")).not.toBeInTheDocument();
 view.unmount();state.mockRestore();
});
