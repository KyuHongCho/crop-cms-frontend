import { matchPath } from "react-router-dom";

export const ROLES = ["member", "editor", "admin"] as const;
export type Role = (typeof ROLES)[number];

export type Section = {
  id: string;
  label: string;
  prefix: string;
  home: string;
  routes: readonly string[];
  roles: readonly Role[];
};

export const SECTIONS: readonly Section[] = [
  { id: "ask", label: "Ask", prefix: "/chat", home: "/chat", routes: ["/chat"], roles: ROLES },
  {
    id: "library",
    label: "Library",
    prefix: "/library",
    home: "/library",
    routes: ["/library", "/library/:cropSlug", "/library/:cropSlug/:topic"],
    roles: ROLES,
  },
];

export function sectionFor(pathname: string): Section | undefined {
  return SECTIONS.find((s) => pathname === s.prefix || pathname.startsWith(`${s.prefix}/`));
}

// Before the profile loads the role is unknown, so only sections open to every role show.
export function allows(section: Section, role: string | undefined): boolean {
  return role === undefined ? section.roles.length === ROLES.length : (section.roles as readonly string[]).includes(role);
}

export function routable(section: Section, pathname: string): boolean {
  return section.routes.some((pattern) => matchPath({ path: pattern, end: true }, pathname) !== null);
}
