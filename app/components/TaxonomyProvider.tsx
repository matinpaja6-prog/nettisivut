"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import {
  DEFAULT_TAXONOMY,
  TAXONOMY_EVENT,
  fetchSiteTaxonomy,
  type SiteTaxonomy
} from "@/lib/taxonomy";
import { supabase } from "@/lib/supabase";

type Ctx = {
  taxonomy: SiteTaxonomy;
  loading: boolean;
  refresh: () => Promise<void>;
};

const TaxonomyContext = createContext<Ctx>({
  taxonomy: DEFAULT_TAXONOMY,
  loading: true,
  refresh: async () => {}
});

export default function TaxonomyProvider({ children }: { children: ReactNode }) {
  const [taxonomy, setTaxonomy] = useState<SiteTaxonomy>(DEFAULT_TAXONOMY);
  const [loading, setLoading] = useState(true);

  async function load() {
    const t = await fetchSiteTaxonomy();
    setTaxonomy(t);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  // Realtime updates from Supabase.
  useEffect(() => {
    const sb = supabase;
    if (!sb) return;
    const channel = sb
      .channel("site_taxonomy_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "site_taxonomy" },
        () => {
          void load();
        }
      )
      .subscribe();
    return () => {
      void sb.removeChannel(channel);
    };
  }, []);

  // Same-tab event from admin panel.
  useEffect(() => {
    function onChange() {
      void load();
    }
    window.addEventListener(TAXONOMY_EVENT, onChange);
    return () => window.removeEventListener(TAXONOMY_EVENT, onChange);
  }, []);

  const value = useMemo<Ctx>(
    () => ({ taxonomy, loading, refresh: load }),
    [taxonomy, loading]
  );

  return <TaxonomyContext.Provider value={value}>{children}</TaxonomyContext.Provider>;
}

export function useTaxonomy(): SiteTaxonomy {
  return useContext(TaxonomyContext).taxonomy;
}

export function useTaxonomyContext(): Ctx {
  return useContext(TaxonomyContext);
}
