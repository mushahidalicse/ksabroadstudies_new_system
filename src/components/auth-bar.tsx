"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Me = { id: string; name: string } | null;

export function AuthBar({ isHome }: { isHome: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((json: { student?: { id: string; name: string } | null }) => {
        if (!alive) return;
        setMe(json.student ? { id: json.student.id, name: json.student.name } : null);
      })
      .catch(() => {
        if (alive) setMe(null);
      });
    return () => {
      alive = false;
    };
  }, [pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setMe(null);
    router.push("/");
    router.refresh();
  }

  const ghost = cn(
    "rounded-full px-2.5 py-1.5 text-sm font-semibold opacity-80 hover:opacity-100 transition",
    isHome ? "hover:bg-white/10" : "hover:bg-[rgba(15,106,111,0.08)]",
  );

  if (me) {
    return (
      <div className="hidden sm:flex items-center gap-1">
        <Link
          href="/portal"
          className={cn(
            ghost,
            pathname.startsWith("/portal") &&
              (isHome ? "opacity-100 bg-white/12" : "opacity-100 bg-[rgba(15,106,111,0.12)]"),
          )}
        >
          Portal
        </Link>
        <button type="button" className={ghost} onClick={() => void logout()}>
          Log out
        </button>
      </div>
    );
  }

  return (
    <div className="hidden sm:flex items-center gap-2">
      <Link href="/login" className={ghost}>
        Login
      </Link>
      <Link
        href="/register"
        className={cn("btn text-sm", isHome ? "btn-primary" : "btn-sea")}
      >
        Register
      </Link>
    </div>
  );
}
