// Automated tests for switching profiles and profile picture upload.
// These tests run automatically on every pull request.

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProfileHeader from "../components/ProfileHeader";
import { ActiveProfileProvider } from "../context/ActiveProfileContext";
import {
  addLinkedProfile,
  getMyProfile,
} from "../lib/profileApi";
import * as fakeProfileApi from "../test-utils/fakeProfileApi";

// The profile API is replaced by an in-memory fake of the backend.
jest.mock("../lib/profileApi", () => require("../test-utils/fakeProfileApi"));

// The profile provider loads profiles only while signed in; here the user is signed in.
jest.mock("../components/SessionTimeout", () => ({
  ...jest.requireActual("../components/SessionTimeout"),
  useSessionStatus: () => "signedIn",
}));

// Renders the header inside the provider, like every page gets from _app.js.
// Returns unmount so a test can "reload the page" by rendering again.
function renderHeader() {
  return render(
    <ActiveProfileProvider>
      <ProfileHeader />
    </ActiveProfileProvider>
  );
}

/* =========================================================
   PROFILE SWITCHER TESTS
   ========================================================= */

describe("Profile switcher", () => {
  let child;

  beforeEach(async () => {
    localStorage.clear();
    fakeProfileApi.resetFakeProfiles();

    child = await addLinkedProfile({
      fullName: "Sami",
      dateOfBirth: "2015-03-10",
      relationship: "child",
    });
  });

  test("lists the self profile and all dependents", async () => {
    renderHeader();

    expect(
      await screen.findByRole("option", {
        name: "Demo User (you)",
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("option", {
        name: "Sami (child)",
      })
    ).toBeInTheDocument();
  });

  test("no banner is shown while acting as yourself", async () => {
    renderHeader();

    await screen.findByRole("option", {
      name: "Demo User (you)",
    });

    expect(
      screen.queryByText(/Acting as:/)
    ).not.toBeInTheDocument();
  });

  test(
    "switching to a dependent shows the Acting as banner, switching back hides it",
    async () => {
      const user = userEvent.setup();

      renderHeader();

      await screen.findByRole("option", {
        name: "Sami (child)",
      });

      await user.selectOptions(
        screen.getByLabelText("Active profile"),
        child.id
      );

      expect(
        screen.getByText("Acting as: Sami (child)")
      ).toBeInTheDocument();

      await user.selectOptions(
        screen.getByLabelText("Active profile"),
        "self"
      );

      expect(
        screen.queryByText(/Acting as:/)
      ).not.toBeInTheDocument();
    }
  );

  test("the chosen profile survives a reload", async () => {
    const user = userEvent.setup();

    const { unmount } = renderHeader();

    await screen.findByRole("option", {
      name: "Sami (child)",
    });

    await user.selectOptions(
      screen.getByLabelText("Active profile"),
      child.id
    );

    // Unmounting and rendering again is like refreshing the page.
    unmount();

    renderHeader();

    expect(
      await screen.findByText("Acting as: Sami (child)")
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText("Active profile")
    ).toHaveValue(child.id);
  });

  test(
    "falls back to the self profile if the saved one no longer exists",
    async () => {
      localStorage.setItem(
        "nabad-active-profile-id",
        "p-deleted"
      );

      renderHeader();

      await screen.findByRole("option", {
        name: "Demo User (you)",
      });

      expect(
        screen.getByLabelText("Active profile")
      ).toHaveValue("self");

      expect(
        screen.queryByText(/Acting as:/)
      ).not.toBeInTheDocument();
    }
  );
});

/* =========================================================
   PROFILE PICTURE TESTS
   ========================================================= */

describe("Profile picture upload", () => {
  beforeEach(() => {
    localStorage.clear();
    fakeProfileApi.resetFakeProfiles();
  });

  test("shows the upload picture button", async () => {
    renderHeader();

    expect(
      await screen.findByRole("button", {
        name: "Upload picture",
      })
    ).toBeInTheDocument();
  });

  test("accepts a valid JPG image and saves it", async () => {
    const user = userEvent.setup();

    renderHeader();

    // Wait until the profile has loaded.
    await screen.findByRole("button", {
      name: "Upload picture",
    });

    const input = screen.getByTestId(
      "profile-picture-input"
    );

    const file = new File(
      ["fake image content"],
      "profile.jpg",
      {
        type: "image/jpeg",
      }
    );

    await user.upload(input, file);

    expect(
      await screen.findByRole("button", {
        name: "Change picture",
      })
    ).toBeInTheDocument();

    await waitFor(async () => {
      const profile = await getMyProfile();

      expect(
        profile.profilePicture
      ).toContain("data:image/jpeg");
    });
  });

  test("accepts a valid PNG image and saves it", async () => {
    const user = userEvent.setup();

    renderHeader();

    await screen.findByRole("button", {
      name: "Upload picture",
    });

    const input = screen.getByTestId(
      "profile-picture-input"
    );

    const file = new File(
      ["fake png content"],
      "profile.png",
      {
        type: "image/png",
      }
    );

    await user.upload(input, file);

    expect(
      await screen.findByRole("button", {
        name: "Change picture",
      })
    ).toBeInTheDocument();

    await waitFor(async () => {
      const profile = await getMyProfile();

      expect(
        profile.profilePicture
      ).toContain("data:image/png");
    });
  });

  test("rejects an unsupported file type", async () => {
    // applyAccept: false lets us test our own validation
    // instead of userEvent blocking the PDF first.
    const user = userEvent.setup({
      applyAccept: false,
    });

    renderHeader();

    await screen.findByRole("button", {
      name: "Upload picture",
    });

    const input = screen.getByTestId(
      "profile-picture-input"
    );

    const file = new File(
      ["fake pdf"],
      "document.pdf",
      {
        type: "application/pdf",
      }
    );

    await user.upload(input, file);

    expect(
      await screen.findByText(
        "Please upload a JPG or PNG image."
      )
    ).toBeInTheDocument();
  });

  test("rejects an image larger than 1 MB", async () => {
    const user = userEvent.setup();

    renderHeader();

    await screen.findByRole("button", {
      name: "Upload picture",
    });

    const input = screen.getByTestId(
      "profile-picture-input"
    );

    const largeFile = new File(
      [
        new Uint8Array(
          1024 * 1024 + 1
        ),
      ],
      "large.jpg",
      {
        type: "image/jpeg",
      }
    );

    await user.upload(input, largeFile);

    expect(
      await screen.findByText(
        "Image must be smaller than 1 MB."
      )
    ).toBeInTheDocument();
  });

  test("removes a saved profile picture", async () => {
    const user = userEvent.setup();

    renderHeader();

    await screen.findByRole("button", {
      name: "Upload picture",
    });

    const input = screen.getByTestId(
      "profile-picture-input"
    );

    const file = new File(
      ["fake image content"],
      "profile.jpg",
      {
        type: "image/jpeg",
      }
    );

    await user.upload(input, file);

    const removeButton =
      await screen.findByRole("button", {
        name: "Remove picture",
      });

    await user.click(removeButton);

    await waitFor(async () => {
      const profile = await getMyProfile();

      expect(
        profile.profilePicture
      ).toBe("");
    });

    expect(
      screen.getByRole("button", {
        name: "Upload picture",
      })
    ).toBeInTheDocument();
  });
});
describe("Profile picture after switching profiles", () => {
  beforeEach(() => {
    localStorage.clear();
    fakeProfileApi.resetFakeProfiles();
  });

  test("the saved picture is still shown after switching away and back", async () => {
    const child = await addLinkedProfile({ fullName: "Sami", dateOfBirth: "2015-03-10", relationship: "child" });
    const user = userEvent.setup();
    renderHeader();
    await screen.findByRole("button", { name: "Upload picture" });

    await user.upload(
      screen.getByTestId("profile-picture-input"),
      new File(["fake image content"], "profile.png", { type: "image/png" })
    );
    await screen.findByRole("button", { name: "Change picture" });
    // The picture was saved through the profile API.
    await waitFor(async () => expect((await getMyProfile()).profilePicture).not.toBe(""));

    await user.selectOptions(screen.getByLabelText("Active profile"), child.id);
    expect(await screen.findByRole("button", { name: "Upload picture" })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Active profile"), "self");
    expect(await screen.findByRole("button", { name: "Change picture" })).toBeInTheDocument();
  });
});

/* =========================================================
   DEFAULT AVATAR TESTS
   ========================================================= */

describe("Default avatar", () => {
  beforeEach(() => {
    localStorage.clear();
    fakeProfileApi.resetFakeProfiles();
  });

  // No image may come from another site (via.placeholder.com used to, and it went offline).
  function externalUrls(container) {
    return [...container.querySelectorAll("[src],[href]")]
      .map((el) => el.getAttribute("src") || el.getAttribute("href"))
      .filter((url) => /^(https?:)?\/\//i.test(url));
  }

  test("shows initials for you and for a linked profile, without external images", async () => {
    await addLinkedProfile({ fullName: "Sami Haddad", dateOfBirth: "2015-03-10", relationship: "child" });
    const user = userEvent.setup();
    const { container } = renderHeader();

    const own = await screen.findByRole("img", { name: "Profile picture of Demo User" });
    expect(own).toHaveTextContent("DU");
    expect(container.querySelector("img")).toBeNull();
    expect(externalUrls(container)).toEqual([]);

    await user.selectOptions(screen.getByLabelText("Active profile"), screen.getByRole("option", { name: "Sami Haddad (child)" }));
    expect(await screen.findByRole("img", { name: "Profile picture of Sami Haddad" })).toHaveTextContent("SH");
    expect(externalUrls(container)).toEqual([]);
  });

  test("falls back to initials when the saved picture cannot be loaded", async () => {
    fakeProfileApi.resetFakeProfiles({ profilePicture: "data:image/png;base64,broken" });
    const { container } = renderHeader();

    await waitFor(() => expect(container.querySelector("img")).not.toBeNull());
    const picture = screen.getByRole("img", { name: "Profile picture of Demo User" });
    expect(picture).toHaveAttribute("src", "data:image/png;base64,broken");
    fireEvent.error(picture);

    expect(screen.getByRole("img", { name: "Profile picture of Demo User" })).toHaveTextContent("DU");
    expect(container.querySelector("img")).toBeNull();
    // The picture is still saved, so it can still be changed or removed.
    expect(screen.getByRole("button", { name: "Remove picture" })).toBeInTheDocument();
  });
});
