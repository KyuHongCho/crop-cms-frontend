import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { expect, it } from "vitest";
import { AppRoutes } from "../App";
import { AuthProvider } from "../auth/AuthContext";
import { server } from "../test/server";

it("shows the login error with an aria-hidden icon beside the text", async () => {
  server.use(
    http.post(`${window.location.origin}/api/members/login`, () =>
      HttpResponse.json({ detail: "Incorrect email or password" }, { status: 401 }),
    ),
  );
  render(
    <MemoryRouter initialEntries={["/login"]}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </MemoryRouter>,
  );
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Email"), "ada@example.com");
  await user.type(screen.getByLabelText("Password"), "pw-123456");
  await user.click(screen.getByRole("button", { name: "Log in" }));
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("Incorrect email or password");
  expect(alert.querySelector("svg[aria-hidden]")).not.toBeNull();
});
