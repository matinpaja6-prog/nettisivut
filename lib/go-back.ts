"use client";

type RouterLike = {
  back: () => void;
  push: (href: string) => void;
};

export function goBackOrFallback(
  router: RouterLike,
  fallback = "/"
) {
  if (typeof window === "undefined") {
    router.push(fallback);
    return;
  }

  if (window.history.length > 1) {
    router.back();
    return;
  }

  router.push(fallback);
}
