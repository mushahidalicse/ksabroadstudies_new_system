"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { AuthBar } from "@/components/auth-bar";
import { BrandLogo } from "@/components/brand-logo";
import { SITE } from "@/lib/site";
import { cn } from "@/lib/utils";

const links = [
  { href: "/universities", label: "Universities" },
  { href: "/programs/master", label: "Master's" },
  { href: "/programs/bachelor", label: "Bachelor's" },
  { href: "/programs/single-cycle", label: "Medicine" },
  { href: "/phd", label: "PhD" },
  { href: "/guides", label: "Guides" },
  { href: "/scholarships", label: "Scholarships" },
  { href: "/erasmus", label: "Erasmus" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isHome = pathname === "/";

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b backdrop-blur-md",
        isHome
          ? "border-white/10 bg-[#0b2c33]/80 text-[#f4efe4]"
          : "border-[var(--line)] bg-[rgba(247,244,237,0.86)] text-[var(--ink)]",
      )}
    >
      <div className="site-shell flex items-center justify-between gap-4 py-2.5">
        <Link href="/" className="min-w-0 flex items-center gap-3">
          <BrandLogo size={52} priority />
          <div className="min-w-0">
            <div className="display text-lg md:text-xl tracking-tight leading-none">
              {SITE.name}
            </div>
            <div
              className={cn(
                "mt-1 text-[0.62rem] font-semibold uppercase tracking-[0.14em] truncate",
                isHome ? "text-[#d9c4a1]" : "text-[var(--sea)]",
              )}
            >
              Study in Italy · Pakistan
            </div>
          </div>
        </Link>

        <nav className="hidden xl:flex items-center gap-1 text-sm font-semibold">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-full px-2.5 py-1.5 opacity-80 hover:opacity-100 hover:bg-white/10 transition",
                !isHome && "hover:bg-[rgba(15,106,111,0.08)]",
                pathname.startsWith(link.href) &&
                  (isHome
                    ? "opacity-100 bg-white/12"
                    : "opacity-100 bg-[rgba(15,106,111,0.12)] text-[var(--sea-deep)]"),
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <AuthBar isHome={isHome} />
          <button
            type="button"
            className="xl:hidden p-2"
            aria-label="Toggle menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {open && (
        <div
          className={cn(
            "xl:hidden border-t px-4 py-4 grid gap-1",
            isHome
              ? "border-white/10 bg-[#0b2c33] text-[#f4efe4]"
              : "border-[var(--line)] bg-[#f7f4ed]",
          )}
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-xl px-3 py-2.5 font-semibold hover:bg-black/5"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/login"
            className="rounded-xl px-3 py-2.5 font-semibold"
            onClick={() => setOpen(false)}
          >
            Login
          </Link>
          <Link
            href="/register"
            className="rounded-xl px-3 py-2.5 font-semibold"
            onClick={() => setOpen(false)}
          >
            Register
          </Link>
          <Link
            href="/portal"
            className="rounded-xl px-3 py-2.5 font-semibold"
            onClick={() => setOpen(false)}
          >
            Portal
          </Link>
        </div>
      )}
    </header>
  );
}
