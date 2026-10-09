import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "../App";
import type { components } from "../api/schema";
import { AuthProvider } from "../auth/AuthContext";
import { setToken } from "../auth/token";
import { server } from "../test/server";

const API = `${window.location.origin}/api`;

const member: components["schemas"]["MemberResponse"] = {
  id: 1,
  email: "ada@example.com",
  display_name: "Ada",
  tokens_used_today: 120,
  tokens_budget_daily: 5000,
  budget_window_start: "2026-10-07",
  role: "member",
};

function renderShell(path = "/chat", me: () => Response = () => HttpResponse.json(member)) {
  setToken("tok-1");
  server.use(http.get(`${API}/members/me`, me), http.get(`${API}/crops`, () => HttpResponse.json([])));
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </MemoryRouter>,
  );
  return userEvent.setup();
}

const dark = () => document.documentElement.classList.contains("dark");

afterEach(() => vi.unstubAllGlobals());

describe("app shell", () => {
  it("has one header and one main, and the page sits inside the main", async () => {
    renderShell();
    await screen.findByText(/Signed in as Ada/);
    expect(document.querySelectorAll("main")).toHaveLength(1);
    expect(screen.getAllByRole("banner")).toHaveLength(1);
    expect(within(screen.getByRole("main")).getByRole("heading", { name: "Ask" })).toBeInTheDocument();
  });

  it("marks the current page in the nav with aria-current", async () => {
    renderShell("/chat");
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "Ask" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Library" })).not.toHaveAttribute("aria-current");
    await screen.findByText(/Signed in as Ada/);
  });

  it("routes to the Library page from the nav and back through the logo", async () => {
    const user = renderShell("/chat");
    await screen.findByText(/Signed in as Ada/);
    await user.click(within(screen.getByRole("navigation", { name: "Main" })).getByRole("link", { name: "Library" }));
    expect(screen.getByRole("heading", { name: "Library" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Library" })).toHaveAttribute("aria-current", "page");
    await user.click(screen.getByRole("link", { name: "Crop CMS" }));
    expect(screen.getByRole("heading", { name: "Ask" })).toBeInTheDocument();
  });

  it("scrolls to the top on a route change", async () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const user = renderShell("/chat");
    await screen.findByText(/Signed in as Ada/);
    scrollTo.mockClear();
    await user.click(within(screen.getByRole("navigation", { name: "Main" })).getByRole("link", { name: "Library" }));
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    scrollTo.mockRestore();
  });

  it("renders when window.scrollTo returns a Promise, as some browsers do", async () => {
    const scrollTo = vi
      .spyOn(window, "scrollTo")
      .mockImplementation((() => Promise.resolve()) as unknown as typeof window.scrollTo);
    renderShell("/chat");
    await screen.findByText(/Signed in as Ada/);
    expect(screen.getAllByRole("banner")).toHaveLength(1);
    expect(within(screen.getByRole("main")).getByRole("heading", { name: "Ask" })).toBeInTheDocument();
    scrollTo.mockRestore();
  });

  it("shows the profile error in the shell with an icon", async () => {
    renderShell("/library", () => HttpResponse.json({ detail: "x" }, { status: 500 }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not load your profile (500).");
    expect(alert.querySelector("svg[aria-hidden='true']")).not.toBeNull();
    expect(within(screen.getByRole("main")).getByRole("alert")).toBe(alert);
    expect(screen.getByRole("button", { name: "Account" })).toBeInTheDocument();
  });
});

describe("member menu", () => {
  it("names the trigger with its visible name", async () => {
    renderShell();
    const trigger = await screen.findByRole("button", { name: "Account: Ada" });
    expect(trigger).toHaveTextContent("Ada");
  });

  it("opens with Enter and shows the email, the theme group and Log out", async () => {
    const user = renderShell();
    const trigger = await screen.findByRole("button", { name: /^Account/ });
    trigger.focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByText("Signed in as ada@example.com")).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: "System" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menuitem", { name: "Log out" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
  });

  it("applies Dark immediately and keeps it across a remount", async () => {
    const user = renderShell();
    await user.click(await screen.findByRole("button", { name: /^Account/ }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Dark" }));
    expect(dark()).toBe(true);
    expect(localStorage.getItem("crop-cms-theme")).toBe("dark");
    cleanup();
    document.documentElement.classList.remove("dark");
    renderShell();
    await screen.findByRole("button", { name: /^Account/ });
    expect(dark()).toBe(true);
  });

  it("follows an OS change while System is selected", async () => {
    let listener: ((e: { matches: boolean }) => void) | undefined;
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: (_: string, fn: typeof listener) => (listener = fn),
        removeEventListener: vi.fn(),
      }),
    );
    const user = renderShell();
    await user.click(await screen.findByRole("button", { name: /^Account/ }));
    await user.click(await screen.findByRole("menuitemradio", { name: "System" }));
    expect(dark()).toBe(false);
    listener!({ matches: true });
    await vi.waitFor(() => expect(dark()).toBe(true));
  });
});
