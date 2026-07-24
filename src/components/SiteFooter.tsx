import { createServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Facebook, Instagram, Linkedin, Twitter } from "lucide-react";
import type { LegalPageRecord } from "@/lib/legal-cms.server";

const loadFooterPages = createServerFn({ method: "GET" }).handler(async () => {
  const { listLegalPages } = await import("@/lib/legal-cms.server");
  return listLegalPages().filter((page) => page.status === "PUBLISHED");
});

const fallbackColumns: FooterColumn[] = [
  {
    title: "Company",
    links: [{ l: "About", to: "/about-us" }, { l: "Careers" }, { l: "Blog" }],
  },
  {
    title: "Support",
    links: [{ l: "FAQ", to: "/faq" }, { l: "Contact", to: "/contact-us" }, { l: "Help Center" }],
  },
  {
    title: "Legal",
    links: [
      { l: "Privacy Policy", to: "/privacy-policy" },
      { l: "Terms", to: "/terms-and-conditions" },
      { l: "Cookies" },
    ],
  },
];

export function SiteFooter() {
  const [legalPages, setLegalPages] = useState<LegalPageRecord[]>([]);

  useEffect(() => {
    loadFooterPages()
      .then(setLegalPages)
      .catch(() => setLegalPages([]));
  }, []);

  const columns = [
    fallbackColumns[0],
    fallbackColumns[1],
    {
      ...fallbackColumns[2],
      links: buildLegalLinks(legalPages),
    },
  ];

  return (
    <footer className="border-t border-border bg-ink text-ink-foreground">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-5 lg:px-8">
        <div className="md:col-span-2">
          <Link
            to="/"
            className="flex items-center gap-2 font-display text-xl font-bold text-white"
          >
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-cta text-cta-foreground">
              S
            </span>
            Servio
          </Link>
          <p className="mt-4 max-w-sm text-sm text-white/65">
            The trusted marketplace where clients meet vetted professionals. Post jobs, hire
            experts, track work — all in one platform.
          </p>
          <div className="mt-6 flex gap-2 text-white/70">
            <a href="#" className="rounded-md p-2 hover:bg-white/10 hover:text-white">
              <Facebook className="h-4 w-4" />
            </a>
            <a href="#" className="rounded-md p-2 hover:bg-white/10 hover:text-white">
              <Instagram className="h-4 w-4" />
            </a>
            <a href="#" className="rounded-md p-2 hover:bg-white/10 hover:text-white">
              <Linkedin className="h-4 w-4" />
            </a>
            <a href="#" className="rounded-md p-2 hover:bg-white/10 hover:text-white">
              <Twitter className="h-4 w-4" />
            </a>
          </div>
        </div>
        {columns.map((column) => (
          <FooterCol key={column.title} title={column.title} links={column.links} />
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-white/50 sm:flex-row sm:px-6 lg:px-8">
          <span>© 2026 Servio, Inc. All rights reserved.</span>
          <span>Made for trusted local & remote work.</span>
        </div>
      </div>
    </footer>
  );
}

type FooterLink = { l: string; to?: string };
type FooterColumn = { title: string; links: FooterLink[] };

function FooterCol({ title, links }: FooterColumn) {
  return (
    <div>
      <h4 className="font-display text-sm font-semibold text-white">{title}</h4>
      <ul className="mt-4 space-y-2 text-sm text-white/65">
        {links.map((l) => (
          <li key={l.l}>
            {l.to ? (
              <Link to={l.to as any} className="hover:text-white">
                {l.l}
              </Link>
            ) : (
              <span className="cursor-default text-white/40">{l.l}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function buildLegalLinks(pages: LegalPageRecord[]): FooterLink[] {
  const preferredOrder = ["faq", "terms-and-conditions", "privacy-policy"];
  const orderedPages = [...pages].sort((left, right) => {
    const leftIndex = preferredOrder.indexOf(left.slug);
    const rightIndex = preferredOrder.indexOf(right.slug);
    return (
      (leftIndex === -1 ? preferredOrder.length : leftIndex) -
      (rightIndex === -1 ? preferredOrder.length : rightIndex)
    );
  });

  return orderedPages.map((page) => ({
    l: page.slug === "faq" ? "FAQ" : page.slug === "terms-and-conditions" ? "Terms" : page.title,
    to: `/${page.slug}`,
  }));
}
