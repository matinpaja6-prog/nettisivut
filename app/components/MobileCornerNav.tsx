"use client";

import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { canonicalPathFromLocalized } from "@/lib/routes";

export default function MobileCornerNav() {
  const pathname = usePathname();
  const router = useRouter();
  const canonicalPathname = canonicalPathFromLocalized(pathname || "/");
  const isHomePage = canonicalPathname === "/";

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/");
  }

  if (isHomePage) {
    return (
      <Link href="/" className="mobile-corner-nav mobile-corner-logo" aria-label="Maskines etusivu">
        <Image src="/maskines-icon.png" alt="Maskines" width={44} height={44} priority />
      </Link>
    );
  }

  return (
    <button
      type="button"
      className="mobile-corner-nav mobile-corner-back"
      aria-label="Takaisin edelliselle sivulle"
      onClick={goBack}
    >
      <ArrowLeft size={25} aria-hidden="true" />
    </button>
  );
}
