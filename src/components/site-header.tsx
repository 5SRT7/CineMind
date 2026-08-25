import Link from "next/link";
import Image from "next/image";
import { Bookmark, Compass, Search, Sparkles } from "lucide-react";

const navItems = [
  { href: "/", label: "首页", icon: Search },
  { href: "/browse", label: "浏览", icon: Compass },
  { href: "/watchlist", label: "想看", icon: Bookmark },
  { href: "/ai-search", label: "找相似", icon: Sparkles, accent: true },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-background/85 backdrop-blur-xl">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <Image
            src="/cinemind-logo.svg"
            alt="CineMind logo"
            width={36}
            height={36}
            priority
            className="h-9 w-9 rounded-lg"
          />
          <span className="text-lg font-extrabold tracking-tight">
            Cine<span className="text-accent">Mind</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex h-10 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors hover:bg-white/[0.06] ${
                  item.accent
                    ? "bg-accent-soft text-accent hover:bg-accent/20"
                    : "text-foreground/80 hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
