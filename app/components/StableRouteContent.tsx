"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

function renderableChildren(container: HTMLElement) {
  return Array.from(container.children).filter(
    (element) => element.tagName !== "SCRIPT" && element.tagName !== "STYLE"
  );
}

export default function StableRouteContent({ children }: { children: ReactNode }) {
  const liveRef = useRef<HTMLDivElement>(null);
  const snapshotRef = useRef<HTMLDivElement>(null);
  const lastContentRef = useRef<Element[]>([]);

  useLayoutEffect(() => {
    const live = liveRef.current;
    const snapshot = snapshotRef.current;
    if (!live || !snapshot) return;

    const syncSnapshot = () => {
      const currentContent = renderableChildren(live);

      if (currentContent.length > 0) {
        lastContentRef.current = currentContent.map((element) =>
          element.cloneNode(true) as Element
        );
        snapshot.replaceChildren();
        return;
      }

      if (snapshot.childElementCount === 0 && lastContentRef.current.length > 0) {
        snapshot.replaceChildren(
          ...lastContentRef.current.map((element) => element.cloneNode(true))
        );
      }
    };

    syncSnapshot();
    const observer = new MutationObserver(syncSnapshot);
    observer.observe(live, { childList: true });

    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div ref={liveRef} className="stable-route-live">
        {children}
      </div>
      <div
        ref={snapshotRef}
        className="stable-route-snapshot"
        aria-hidden="true"
      />
    </>
  );
}
