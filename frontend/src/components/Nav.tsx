"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IS_LIVE } from "@/src/lib/contract";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/disasters", label: "Disasters" },
  { href: "/donate", label: "Donate" },
  { href: "/technology", label: "Technology" },
  { href: "/product", label: "Product" },
];

// Shared top nav. Transparent over the dark hero on "/", solid on the inner light pages.
export function Nav() {
  const pathname = usePathname();
  const onHero = pathname === "/";

  const base = onHero
    ? "absolute inset-x-0 top-0 z-30 text-white"
    : "sticky top-0 z-30 border-b border-stone-200 bg-[#fafaf9]/85 text-stone-900 backdrop-blur";

  return (
    <header className={base}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="font-serif text-xl font-semibold tracking-tight">
          CivicShield
        </Link>
        <nav className="hidden gap-8 text-sm sm:flex">
          {LINKS.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`transition-colors ${
                  active
                    ? onHero
                      ? "text-white"
                      : "text-stone-900"
                    : onHero
                    ? "text-white/70 hover:text-white"
                    : "text-stone-500 hover:text-stone-900"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${
            onHero ? "bg-white/10 text-white ring-white/20 backdrop-blur" : "bg-white text-stone-600 ring-stone-200"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${IS_LIVE ? "bg-emerald-400" : "bg-amber-400"}`} />
          {IS_LIVE ? "Live · Base mainnet" : "Demo"}
        </span>
      </div>
    </header>
  );
}
