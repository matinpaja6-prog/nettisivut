"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode
} from "react";
import { usePathname } from "next/navigation";

type RouteLayer = {
  key: string;
  content: ReactNode;
};

function PendingRouteLayer({
  children,
  onReady
}: {
  children: ReactNode;
  onReady: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const container = ref.current;
    if (!container) return;

    const hasContent = () =>
      Array.from(container.children).some(
        (element) => element.tagName !== "SCRIPT" && element.tagName !== "STYLE"
      );

    if (hasContent()) {
      onReady();
      return;
    }

    const observer = new MutationObserver(() => {
      if (!hasContent()) return;
      observer.disconnect();
      onReady();
    });
    observer.observe(container, { childList: true });

    return () => observer.disconnect();
  }, [onReady]);

  return (
    <div ref={ref} className="stable-route-layer stable-route-pending" aria-hidden="true">
      {children}
    </div>
  );
}

export default function StableRouteContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [activeKey, setActiveKey] = useState(pathname);
  const [layers, setLayers] = useState<RouteLayer[]>([
    { key: pathname, content: children }
  ]);

  useEffect(() => {
    setLayers((current) => {
      const existing = current.find((layer) => layer.key === pathname);
      if (!existing) return [...current, { key: pathname, content: children }];
      if (existing.content === children) return current;

      return current.map((layer) =>
        layer.key === pathname ? { ...layer, content: children } : layer
      );
    });
  }, [children, pathname]);

  const activate = useCallback((key: string) => {
    setActiveKey(key);
    setLayers((current) => current.filter((layer) => layer.key === key));
  }, []);

  return layers.map((layer) =>
    layer.key === activeKey ? (
      <div className="stable-route-layer" key={layer.key}>
        {layer.content}
      </div>
    ) : (
      <PendingRouteLayer key={layer.key} onReady={() => activate(layer.key)}>
        {layer.content}
      </PendingRouteLayer>
    )
  );
}
