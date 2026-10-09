import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider, useTheme } from "./ThemeProvider";

function Probe() {
  const { theme, setTheme } = useTheme();
  return (
    <>
      <p>theme:{theme}</p>
      <button onClick={() => setTheme("dark")}>dark</button>
    </>
  );
}

const dark = () => document.documentElement.classList.contains("dark");

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("ThemeProvider", () => {
  it("adds .dark when the theme is system and the OS prefers dark", () => {
    stubMatchMedia(true);
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(dark()).toBe(true);
  });

  it("does not throw when matchMedia is missing", () => {
    expect(typeof window.matchMedia).toBe("undefined");
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByText("theme:system")).toBeInTheDocument();
    expect(dark()).toBe(false);
  });

  it("applies a stored dark choice", () => {
    localStorage.setItem("crop-cms-theme", "dark");
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByText("theme:dark")).toBeInTheDocument();
    expect(dark()).toBe(true);
  });

  it("persists a choice made at runtime", async () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    await userEvent.click(screen.getByRole("button", { name: "dark" }));
    expect(dark()).toBe(true);
    expect(localStorage.getItem("crop-cms-theme")).toBe("dark");
  });

  it("useTheme throws outside the provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/ThemeProvider/);
    spy.mockRestore();
  });
});
