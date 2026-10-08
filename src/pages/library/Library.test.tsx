import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AppRoutes } from "../../App";
import type { components } from "../../api/schema";
import { AuthProvider } from "../../auth/AuthContext";
import { setToken } from "../../auth/token";
import { server } from "../../test/server";

const API = `${window.location.origin}/api`;

const member: components["schemas"]["MemberResponse"] = {
  id: 1,
  email: "ada@example.com",
  display_name: "Ada",
  tokens_used_today: 0,
  tokens_budget_daily: 5000,
  budget_window_start: "2026-10-07",
  role: "member",
};

const crops: components["schemas"]["CropResponse"][] = [
  { id: 1, slug: "basil", common_name: "basil", scientific_name: "Ocimum basilicum" },
  { id: 2, slug: "kale", common_name: "kale", scientific_name: "Brassica oleracea" },
];

const item = (id: number, over: Partial<components["schemas"]["ItemResponse"]>): components["schemas"]["ItemResponse"] => ({
  id,
  sub_category_id: 1,
  crop_id: 1,
  topic: "watering-needs",
  title: `Item ${id}`,
  body: "body",
  published: true,
  source: "Src",
  reference: "Ref",
  url: "https://example.org/a",
  read_directly: true,
  ...over,
});

const doc = (id: number, over: Partial<components["schemas"]["RetrievedDocument"]> = {}): components["schemas"]["RetrievedDocument"] => ({
  id,
  topic: "watering-needs",
  title: `Doc ${id}`,
  body: `Body ${id}`,
  source: "Src",
  reference: "Ref",
  url: "https://example.org/a",
  read_directly: true,
  ...over,
});

const topicSet = (documents: components["schemas"]["RetrievedDocument"][]): components["schemas"]["TopicSetResponse"] => ({
  crop_slug: "basil",
  topic: "watering-needs",
  document_count: documents.length,
  documents,
  context_chars: 10,
  context_char_budget: 32000,
  chars_per_token: 4,
  dropped: [],
});

function renderAt(path: string, loggedIn = true) {
  if (loggedIn) {
    setToken("tok-1");
    server.use(http.get(`${API}/members/me`, () => HttpResponse.json(member)));
  }
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("Library", () => {
  it("lists the crops with the scientific name in italics", async () => {
    server.use(http.get(`${API}/crops`, () => HttpResponse.json(crops)));
    renderAt("/library");
    const link = await screen.findByRole("link", { name: /kale/ });
    expect(link).toHaveAttribute("href", "/library/kale");
    expect(within(link).getByText("Brassica oleracea").tagName).toBe("EM");
    expect(screen.getByRole("link", { name: /basil/ })).toBeInTheDocument();
  });

  it("lists published topics with counts and never a draft-only topic", async () => {
    server.use(
      http.get(`${API}/crops`, () => HttpResponse.json(crops)),
      http.get(`${API}/items`, () =>
        HttpResponse.json([
          item(1, {}),
          item(2, {}),
          item(3, { topic: "drafts-only", published: false }),
          item(4, { topic: null }),
          item(5, { topic: "other crop", crop_id: 2 }),
          item(6, { topic: "a b/c" }),
        ]),
      ),
    );
    renderAt("/library/basil");
    const watering = await screen.findByRole("link", { name: /watering-needs/ });
    expect(watering).toHaveTextContent("2 documents");
    expect(watering).toHaveAttribute("href", "/library/basil/watering-needs");
    expect(screen.getByRole("link", { name: /a b\/c/ })).toHaveAttribute("href", "/library/basil/a%20b%2Fc");
    expect(screen.queryByText("drafts-only")).toBeNull();
    expect(screen.queryByText("other crop")).toBeNull();
    expect(screen.getByRole("heading", { name: "basil" })).toBeInTheDocument();
  });

  it("shows an icon and text for a crop with no published topics", async () => {
    server.use(
      http.get(`${API}/crops`, () => HttpResponse.json(crops)),
      http.get(`${API}/items`, () => HttpResponse.json([item(3, { published: false })])),
    );
    renderAt("/library/basil");
    const note = await screen.findByText("No published topics for this crop yet.");
    expect(note.querySelector("svg[aria-hidden='true']")).not.toBeNull();
  });

  it("reports an unknown crop on the crop page with an icon and a way back", async () => {
    server.use(
      http.get(`${API}/crops`, () => HttpResponse.json(crops)),
      http.get(`${API}/items`, () => HttpResponse.json([])),
    );
    renderAt("/library/nope");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent('No crop named "nope".');
    expect(alert.querySelector("svg.lucide-circle-alert")).not.toBeNull();
    expect(screen.getByRole("link", { name: "Back to Library" })).toHaveAttribute("href", "/library");
  });

  it("calls /retrieval/basil/watering-needs and shows the count and the documents", async () => {
    let path = "";
    server.use(
      http.get(`${API}/retrieval/:crop/:topic`, ({ request }) => {
        path = new URL(request.url).pathname;
        return HttpResponse.json(topicSet([doc(1), doc(2)]));
      }),
    );
    renderAt("/library/basil/watering-needs");
    expect(await screen.findByText("2 documents")).toBeInTheDocument();
    expect(path).toBe("/api/retrieval/basil/watering-needs");
    const list = screen.getByRole("list", { name: "Documents" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(within(list).getByRole("heading", { name: "Doc 1" })).toBeInTheDocument();
    expect(within(list).queryByText(/\[S\d+\]/)).toBeNull();
    expect(screen.getByRole("link", { name: "Back to basil" })).toHaveAttribute("href", "/library/basil");
  });

  it("links only http(s) document urls", async () => {
    server.use(
      http.get(`${API}/retrieval/:crop/:topic`, () =>
        HttpResponse.json(
          topicSet([
            doc(1, { url: "javascript:alert(1)" }),
            doc(2, { url: "data:text/html,<b>x</b>" }),
            doc(3, { url: "https://example.org/ok" }),
          ]),
        ),
      ),
    );
    renderAt("/library/basil/watering-needs");
    const list = await screen.findByRole("list", { name: "Documents" });
    const links = within(list).getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "https://example.org/ok");
    expect(links[0]).toHaveAttribute("rel", "noopener noreferrer");
    expect(within(list).getByText("javascript:alert(1)")).toBeInTheDocument();
  });

  it("renders document HTML as literal text", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${API}/retrieval/:crop/:topic`, () =>
        HttpResponse.json(topicSet([doc(1, { title: "<i>Bold</i> title", body: "<script>alert(1)</script> <b>x</b>" })])),
      ),
    );
    renderAt("/library/basil/watering-needs");
    const list = await screen.findByRole("list", { name: "Documents" });
    expect(within(list).getByRole("heading", { name: "<i>Bold</i> title" })).toBeInTheDocument();
    await user.click(within(list).getByRole("button", { name: "Show text" }));
    expect(within(list).getByText("<script>alert(1)</script> <b>x</b>")).toBeInTheDocument();
    expect(list.querySelector("script, b, i")).toBeNull();
  });

  it("shows a 404 crop with the circle-alert icon and a way back", async () => {
    server.use(
      http.get(`${API}/retrieval/:crop/:topic`, () => HttpResponse.json({ detail: "crop 'basil' not found" }, { status: 404 })),
    );
    renderAt("/library/basil/watering-needs");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent('No crop named "basil".');
    expect(alert.querySelector("svg.lucide-circle-alert")).not.toBeNull();
    expect(screen.getByRole("link", { name: "Back to basil" })).toBeInTheDocument();
  });

  it("shows the server's message for a 413 with the circle-alert icon", async () => {
    server.use(
      http.get(`${API}/retrieval/:crop/:topic`, () =>
        HttpResponse.json({ detail: { topic: "watering-needs", document_count: 9, message: "Topic is too large to return whole." } }, { status: 413 }),
      ),
    );
    renderAt("/library/basil/watering-needs");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Topic is too large to return whole.");
    expect(alert.querySelector("svg.lucide-circle-alert")).not.toBeNull();
  });

  it("shows the offline message with the wifi-off icon when the network fails", async () => {
    server.use(http.get(`${API}/crops`, () => HttpResponse.error()));
    renderAt("/library");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not reach the server.");
    expect(alert.querySelector("svg.lucide-wifi-off")).not.toBeNull();
  });

  it("shows skeletons while loading", async () => {
    server.use(http.get(`${API}/crops`, () => HttpResponse.json(crops)));
    renderAt("/library");
    expect(screen.getByRole("status")).toHaveTextContent("Loading crops...");
    expect(document.querySelector("[data-slot='skeleton']")).not.toBeNull();
    await screen.findByRole("link", { name: /kale/ });
  });

  it("sends a logged-out visitor to login", async () => {
    renderAt("/library", false);
    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
  });
});
