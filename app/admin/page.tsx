"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  Ban,
  BarChart3,
  Bell,
  CalendarDays,
  Car,
  ChevronDown,
  ClipboardList,
  Euro,
  Eye,
  ExternalLink,
  Home,
  LogOut,
  Search,
  ShieldCheck,
  Trash2,
  Truck,
  UserCog,
  Users,
  X
} from "lucide-react";

import AppearancePanel from "./AppearancePanel";
import CategoriesPanel from "./CategoriesPanel";

import {
  adminAdjustPhoneVerifications,
  adminAdjustListingSlots,
  adminBanIp,
  adminBanUser,
  verifyAdminPin,
  adminDeleteListing,
  adminDeleteUser,
  adminForceVerifyPhone,
  adminListBannedIps,
  adminListProfiles,
  adminOverviewStats,
  adminSetPoints,
  adminUnbanIp,
  adminUnbanUser,
  adminUpdateProfile,
  isSupabaseConfigured,
  supabase,
  type AdminBannedIp,
  type AdminOverviewStats,
  type AdminProfileRow
} from "@/lib/supabase";

import { BASE_LISTING_SLOT_LIMIT } from "@/lib/listing-slots";

import styles from "./admin.module.css";

type TabKey = "overview" | "users" | "listings" | "bans" | "appearance" | "categories";

type AdminListing = {
  id: string;
  title: string | null;
  price: number | null;
  seller_name: string | null;
  seller_id: string | null;
  created_at: string | null;
  is_sold: boolean | null;
  is_hidden: boolean | null;
  image_url: string | null;
  image_urls: string[] | null;
  category: string | null;
  subcategory: string | null;
  vehicle_type: string | null;
  brand: string | null;
  model: string | null;
  view_count: number | null;
};

type ListingStatus = "all" | "active" | "sold";

type Toast = { type: "ok" | "error"; message: string } | null;

const ADMIN_LISTING_COLUMNS =
  "id,title,price,seller_name,seller_id,created_at,is_sold,is_hidden,image_url,image_urls,category,subcategory,vehicle_type,brand,model,view_count";

const ADMIN_VEHICLE_FILTERS: Record<string, string[]> = {
  Mopot: ["mopo", "mopot"],
  Moottorikelkka: ["moottorikelkka", "moottorikelkat"],
  Mönkijä: ["mönkijä", "mönkijät", "monkija", "monkijat"],
  Motocross: ["motocross", "crossi", "crossit"]
};

type ConfirmState =
  | null
  | {
      kind: "delete-listing";
      listing: AdminListing;
    }
  | {
      kind: "delete-user";
      user: AdminProfileRow;
    }
  | {
      kind: "ban-user";
      user: AdminProfileRow;
    }
  | {
      kind: "verify-phone";
      user: AdminProfileRow;
    }
  | {
      kind: "set-points";
      user: AdminProfileRow;
    }
  | {
      kind: "set-slots";
      user: AdminProfileRow;
    }
  | {
      kind: "edit-profile";
      user: AdminProfileRow;
    }
  | {
      kind: "ban-ip";
      prefillIp?: string;
      contextUserName?: string;
    };

function formatDate(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("fi-FI");
}

function formatPrice(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }

  return `${value.toLocaleString("fi-FI")} €`;
}

export default function AdminPage() {
  const [bootLoading, setBootLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [bootMessage, setBootMessage] = useState("Tarkistetaan admin-oikeudet...");
  const [pinUnlocked, setPinUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinChecking, setPinChecking] = useState(false);
  const [pinError, setPinError] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminSearch, setAdminSearch] = useState("");

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [toast, setToast] = useState<Toast>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  const [stats, setStats] = useState<AdminOverviewStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const [users, setUsers] = useState<AdminProfileRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userQuery, setUserQuery] = useState("");
  const [userQueryDebounced, setUserQueryDebounced] = useState("");

  const [listings, setListings] = useState<AdminListing[]>([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [listingQuery, setListingQuery] = useState("");
  const [listingStatus, setListingStatus] = useState<ListingStatus>("all");
  const [listingVehicle, setListingVehicle] = useState<string>("all");

  const [bannedIps, setBannedIps] = useState<AdminBannedIp[]>([]);
  const [bannedIpsLoading, setBannedIpsLoading] = useState(false);
  const [bannedUsers, setBannedUsers] = useState<AdminProfileRow[]>([]);
  const [bannedUsersLoading, setBannedUsersLoading] = useState(false);

  /* Toast auto-dismiss */
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(id);
  }, [toast]);

  const showOk = useCallback((message: string) => setToast({ type: "ok", message }), []);
  const showError = useCallback((message: string) => setToast({ type: "error", message }), []);

  /* Boot: verify admin */
  useEffect(() => {
    let alive = true;

    async function boot() {
      if (!isSupabaseConfigured || !supabase) {
        if (!alive) return;
        setBootMessage("Supabase-asetuksia ei ole laitettu ympäristömuuttujiin.");
        setBootLoading(false);
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (!alive) return;

      if (authError || !authData.user) {
        setBootMessage("Kirjaudu ensin sisään sillä Gmaililla, jolle annoit admin-oikeuden.");
        setBootLoading(false);
        return;
      }

      const { data: adminData, error: adminError } = await supabase.rpc("is_admin");
      if (!alive) return;

      if (adminError) {
        setBootMessage("Admin SQL puuttuu Supabasesta. Aja tiedosto supabase/admin-roles.sql.");
        setBootLoading(false);
        return;
      }

      if (!adminData) {
        setBootMessage(`Tällä käyttäjällä ei ole admin-oikeutta: ${authData.user.email ?? "tuntematon käyttäjä"}`);
        setBootLoading(false);
        return;
      }

      setAdminEmail(authData.user.email ?? "");
      setIsAdmin(true);
      setBootMessage("");
      setBootLoading(false);
      // PIN tyhjennetään aina kun sivu mountataan — käyttäjän pitää
      // syöttää PIN joka kerta kun avaa admin-sivun
      setPinUnlocked(false);
      try {
        Object.keys(sessionStorage)
          .filter((k) => k.startsWith("admin-pin-ok:"))
          .forEach((k) => sessionStorage.removeItem(k));
      } catch {
        // ignore
      }
    }

    void boot();

    // Tyhjennä PIN-lippu kun käyttäjä kirjautuu ulos tai sessio päättyy
    const authSub = supabase?.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        setPinUnlocked(false);
        setIsAdmin(false);
        try {
          Object.keys(sessionStorage)
            .filter((k) => k.startsWith("admin-pin-ok:"))
            .forEach((k) => sessionStorage.removeItem(k));
        } catch {
          // ignore
        }
      }
    });

    return () => {
      alive = false;
      authSub?.data.subscription.unsubscribe();
    };
  }, []);

  async function submitPin() {
    if (!pinInput.trim()) {
      setPinError("Anna PIN-koodi.");
      return;
    }
    setPinChecking(true);
    setPinError("");
    const { data, error } = await verifyAdminPin(pinInput.trim());
    setPinChecking(false);
    if (error) {
      const errObj = error as { message?: string; hint?: string; details?: string };
      const rawMsg = errObj?.message || errObj?.hint || errObj?.details || (error instanceof Error ? error.message : String(error));
      setPinError(rawMsg || "PIN-koodin tarkistus epäonnistui.");
      return;
    }
    if (!data) {
      setPinError("Väärä PIN-koodi.");
      return;
    }
    setPinUnlocked(true);
    setPinInput("");
  }

  /* Load overview stats */
  const loadStats = useCallback(async () => {
    if (!isAdmin) return;
    setStatsLoading(true);
    const { data, error } = await adminOverviewStats();
    setStatsLoading(false);
    if (error) {
      const errObj = error as { message?: string; hint?: string; details?: string };
      const msg = errObj?.message || errObj?.hint || errObj?.details || (error instanceof Error ? error.message : "tuntematon virhe");
      showError(`Tilastot: ${msg}`);
      return;
    }
    setStats(data);
  }, [isAdmin, showError]);

  useEffect(() => {
    if (isAdmin && pinUnlocked && activeTab === "overview") {
      void loadStats();
      // Yleiskatsauksen "Viimeisimmät tapahtumat" tarvitsee dataa myös
      // muista tauluista — esiladataan niitä jos tyhjiä.
      if (users.length === 0) void loadUsers();
      if (listings.length === 0) void loadListings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, pinUnlocked, activeTab, loadStats]);

  useEffect(() => {
    if (!isAdmin || !pinUnlocked || activeTab !== "overview" || !supabase) return;
    const client = supabase;

    const interval = window.setInterval(() => {
      void loadStats();
    }, 15000);

    const channel = client
      .channel("admin-overview-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "listings" }, () => {
        void loadStats();
        void loadListings();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        void loadStats();
        void loadUsers();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "sold_listings" }, () => void loadStats())
      .on("postgres_changes", { event: "*", schema: "public", table: "deleted_listings_log" }, () => void loadStats())
      .on("postgres_changes", { event: "*", schema: "public", table: "user_activity" }, () => void loadStats())
      .subscribe();

    return () => {
      window.clearInterval(interval);
      void client.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isAdmin, loadStats, pinUnlocked]);

  /* Debounce user search */
  useEffect(() => {
    const id = window.setTimeout(() => setUserQueryDebounced(userQuery.trim()), 300);
    return () => window.clearTimeout(id);
  }, [userQuery]);

  /* Load users */
  const loadUsers = useCallback(async () => {
    if (!isAdmin) return;
    setUsersLoading(true);
    const { data, error } = await adminListProfiles({ query: userQueryDebounced, limit: 80 });
    setUsersLoading(false);
    if (error) {
      const errObj = error as { message?: string; hint?: string; details?: string };
      const msg = errObj?.message || errObj?.hint || errObj?.details || "tuntematon virhe";
      showError(`Käyttäjät: ${msg}`);
      return;
    }
    setUsers(data);
  }, [isAdmin, userQueryDebounced, showError]);

  useEffect(() => {
    if (isAdmin && pinUnlocked && activeTab === "users") void loadUsers();
  }, [isAdmin, pinUnlocked, activeTab, loadUsers]);

  /* Load listings */
  const loadListings = useCallback(async () => {
    if (!isAdmin || !supabase) return;
    setListingsLoading(true);
    const vehicleTerms = ADMIN_VEHICLE_FILTERS[listingVehicle] ?? [];
    let q = supabase
      .from("listings")
      .select(ADMIN_LISTING_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(listingVehicle === "all" ? 1000 : 10000);

    if (listingQuery.trim()) {
      const term = `%${listingQuery.trim()}%`;
      q = q.or(`title.ilike.${term},seller_name.ilike.${term}`);
    }

    if (vehicleTerms.length > 0) {
      q = q.or(vehicleTerms.map((term) => `vehicle_type.ilike.${term}`).join(","));
    } else if (listingVehicle === "Muut") {
      q = q
        .not("vehicle_type", "ilike", "mopo")
        .not("vehicle_type", "ilike", "mopot")
        .not("vehicle_type", "ilike", "moottorikelkka")
        .not("vehicle_type", "ilike", "moottorikelkat")
        .not("vehicle_type", "ilike", "mönkijä")
        .not("vehicle_type", "ilike", "mönkijät")
        .not("vehicle_type", "ilike", "monkija")
        .not("vehicle_type", "ilike", "monkijat")
        .not("vehicle_type", "ilike", "motocross")
        .not("vehicle_type", "ilike", "crossi")
        .not("vehicle_type", "ilike", "crossit");
    }

    const { data, error } = await q;
    setListingsLoading(false);
    if (error) {
      showError("Ilmoitusten lataus epäonnistui.");
      return;
    }
    setListings((data ?? []) as AdminListing[]);
  }, [isAdmin, listingQuery, listingVehicle, showError]);

  useEffect(() => {
    if (isAdmin && pinUnlocked && activeTab === "listings") void loadListings();
  }, [isAdmin, pinUnlocked, activeTab, loadListings]);

  /* Load banned IPs */
  const loadBannedIps = useCallback(async () => {
    if (!isAdmin) return;
    setBannedIpsLoading(true);
    const { data, error } = await adminListBannedIps();
    setBannedIpsLoading(false);
    if (error) {
      showError("Bannattujen IP:iden lataus epäonnistui.");
      return;
    }
    setBannedIps(data);
  }, [isAdmin, showError]);

  const loadBannedUsers = useCallback(async () => {
    if (!isAdmin) return;
    setBannedUsersLoading(true);
    const { data, error } = await adminListProfiles({ query: "", limit: 300 });
    setBannedUsersLoading(false);
    if (error) {
      showError("Bannattujen käyttäjien lataus epäonnistui.");
      return;
    }
    setBannedUsers(data.filter((user) => user.is_banned));
  }, [isAdmin, showError]);

  const loadBans = useCallback(async () => {
    await Promise.all([loadBannedIps(), loadBannedUsers()]);
  }, [loadBannedIps, loadBannedUsers]);

  useEffect(() => {
    if (isAdmin && pinUnlocked && activeTab === "bans") void loadBans();
  }, [isAdmin, pinUnlocked, activeTab, loadBans]);

  /* Action handlers */
  const handleDeleteListing = async (listing: AdminListing) => {
    const { error } = await adminDeleteListing(listing.id);
    if (error) { showError("Ilmoituksen poisto epäonnistui."); return; }
    showOk("Ilmoitus poistettu.");
    setListings((prev) => prev.filter((l) => l.id !== listing.id));
    void loadStats();
    setConfirm(null);
  };

  const handleDeleteUser = async (user: AdminProfileRow) => {
    const { error } = await adminDeleteUser(user.id);
    if (error) { showError("Käyttäjän poisto epäonnistui."); return; }
    showOk("Käyttäjä poistettu.");
    setUsers((prev) => prev.filter((u) => u.id !== user.id));
    setConfirm(null);
  };

  const handleToggleBan = async (user: AdminProfileRow, reason?: string) => {
    const action = user.is_banned ? adminUnbanUser(user.id) : adminBanUser(user.id, reason);
    const { error } = await action;
    if (error) { showError("Bannaus epäonnistui."); return; }
    showOk(user.is_banned ? "Käyttäjä unbannattu." : "Käyttäjä bannattu.");
    setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, is_banned: !u.is_banned, banned_reason: user.is_banned ? null : (reason ?? null) } : u));
    setBannedUsers((prev) => user.is_banned ? prev.filter((u) => u.id !== user.id) : [{ ...user, is_banned: true, banned_reason: reason ?? null }, ...prev]);
    setConfirm(null);
  };

  const handleVerifyPhone = async (user: AdminProfileRow, newPhone?: string) => {
    const { error } = await adminForceVerifyPhone(user.id, newPhone);
    if (error) { showError("Vahvistus epäonnistui."); return; }
    showOk("Puhelinnumero vahvistettu.");
    setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, phone_verified_at: new Date().toISOString(), phone_verification_count: Math.max(1, u.phone_verification_count ?? 0), phone: newPhone ?? u.phone } : u));
    setConfirm(null);
  };

  const handleSetPoints = async (user: AdminProfileRow, value: number) => {
    const { error } = await adminSetPoints(user.id, value);
    if (error) { showError("Pisteiden asetus epäonnistui."); return; }
    showOk("Pisteet päivitetty.");
    setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, points: value } : u));
    setConfirm(null);
  };

  const handleSetSlots = async (user: AdminProfileRow, value: number) => {
    const delta = value - (user.extra_listing_slots ?? 0);
    const { data, error } = await adminAdjustListingSlots(user.id, delta);
    if (error) {
      const errObj = error as { message?: string };
      showError(`Paikkojen asetus: ${errObj?.message || "epäonnistui"}`);
      return;
    }
    showOk("Ilmoituspaikat päivitetty.");
    setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, extra_listing_slots: data ?? value } : u));
    setConfirm(null);
  };

  const handleAdjustPhoneVerifications = async (user: AdminProfileRow, delta: number) => {
    const { data, error } = await adminAdjustPhoneVerifications(user.id, delta);
    if (error) {
      const errObj = error as { message?: string };
      showError(`Vahvistusten säätö: ${errObj?.message || "epäonnistui"}`);
      return;
    }
    showOk(delta > 0 ? "Vahvistuspaikkoja lisätty." : "Vahvistuspaikkoja poistettu.");
    setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, extra_phone_verifications: data ?? u.extra_phone_verifications } : u));
  };

  const handleUpdateProfile = async (user: AdminProfileRow, updates: Record<string, string>) => {
    const { error } = await adminUpdateProfile(user.id, updates);
    if (error) { showError("Profiilin päivitys epäonnistui."); return; }
    showOk("Profiili päivitetty.");
    setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, ...updates } : u));
    setConfirm(null);
  };

  const handleBanIp = async (ip: string, reason?: string) => {
    const { error } = await adminBanIp(ip, reason);
    if (error) { showError("IP-bannaus epäonnistui."); return; }
    showOk(`IP ${ip} bannattu.`);
    void loadBans();
    setConfirm(null);
  };

  const handleUnbanIp = async (ip: string) => {
    const { error } = await adminUnbanIp(ip);
    if (error) { showError("IP-unbannaus epäonnistui."); return; }
    showOk(`IP ${ip} unbannattu.`);
    setBannedIps((prev) => prev.filter((b) => b.ip !== ip));
  };

  /* Render */
  const tabs: { key: TabKey; label: string; icon: typeof Users }[] = useMemo(() => [
    { key: "overview", label: "Yleiskatsaus", icon: Home },
    { key: "users", label: "Käyttäjät", icon: Truck },
    { key: "listings", label: "Ilmoitukset", icon: ClipboardList },
    { key: "bans", label: "Bannit", icon: Users },
    { key: "categories", label: "Kategoriat", icon: Car },
    { key: "appearance", label: "Ulkoasu", icon: BarChart3 }
  ], []);

  async function handleSignOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  const adminName =
    adminEmail
      ? adminEmail.split("@")[0].replace(/[._-]+/g, " ")
      : "Admin";
  const adminInitial =
    adminName.trim().charAt(0).toUpperCase() || "A";
  const dashboardRange = (() => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    const fmt = new Intl.DateTimeFormat("fi-FI", { day: "numeric", month: "numeric" });
    return `${fmt.format(start)} - ${fmt.format(end)}.${end.getFullYear()}`;
  })();

  function submitAdminSearch() {
    const q = adminSearch.trim();
    if (!q) return;
    if (activeTab === "listings") {
      setListingQuery(q);
      return;
    }
    setUserQuery(q);
    setActiveTab("users");
  }

  function refreshAdminDashboard() {
    void loadStats();
    void loadUsers();
    void loadListings();
  }

  return (
    <main className={`${styles.page} admin-page`}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarBrand}>
          <div className={styles.sidebarBrandIcon} aria-label="Maskines">
            <ShieldCheck size={24} />
          </div>
        </div>

        <nav className={styles.sidebarNav} aria-label="Admin-navigaatio">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                className={`${styles.sidebarLink} ${isActive ? styles.sidebarLinkActive : ""}`}
                onClick={() => setActiveTab(tab.key)}
                disabled={!isAdmin || !pinUnlocked}
              >
                <Icon size={17} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className={styles.sidebarBottom}>
          <Link href="/" className={styles.sidebarLink}>
            <ArrowLeft size={16} />
            Takaisin sivustolle
          </Link>
          <button type="button" className={`${styles.sidebarLink} danger`} onClick={handleSignOut}>
            <LogOut size={16} />
            Kirjaudu ulos
          </button>
        </div>
      </aside>

      <section className={styles.shell}>
        {!bootLoading && isAdmin && pinUnlocked && (
          <header className={styles.adminTopbar}>
            <button type="button" className={styles.adminMenuButton} aria-label="Avaa yleiskatsaus" onClick={() => setActiveTab("overview")}>
              <ChevronDown size={18} />
            </button>
            <label className={styles.adminSearch}>
              <Search size={18} />
              <input
                type="search"
                placeholder="Hae..."
                aria-label="Hae admin-dataa"
                value={adminSearch}
                onChange={(event) => setAdminSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") submitAdminSearch();
                }}
              />
              <button type="button" onClick={submitAdminSearch}>Hae</button>
            </label>
            <div className={styles.adminTopbarSpacer} />
            <button type="button" className={styles.adminBell} aria-label="Päivitä tiedot" onClick={refreshAdminDashboard}>
              <Bell size={21} />
              <span />
            </button>
            <div className={styles.adminUserBadge}>
              <div className={styles.adminAvatar}>{adminInitial}</div>
              <div>
                <strong>{adminName}</strong>
                <span>Admin</span>
              </div>
              <ChevronDown size={15} />
            </div>
          </header>
        )}

        {!bootLoading && isAdmin && pinUnlocked && stats && (
          <div className={styles.dashboardHero}>
            <div>
              <h1>Tervetuloa takaisin, {adminName}! <span aria-hidden="true">👋</span></h1>
              <p>Tässä näet, mitä kauppapaikalla tapahtuu tänään.</p>
            </div>
            <button type="button" className={styles.dateRangeButton} onClick={refreshAdminDashboard}>
              <CalendarDays size={16} />
              {dashboardRange}
              <ChevronDown size={15} />
            </button>
          </div>
        )}

        {!bootLoading && isAdmin && pinUnlocked && stats && (
          <div className={styles.summaryStrip}>
            <article className={styles.summaryCard}>
              <div className={`${styles.summaryIcon} ${styles.iconBlue}`}><Users size={22} /></div>
              <div className={styles.summaryBody}>
                <span>Käyttäjät</span>
                <strong>{Number(stats.profiles_total ?? 0).toLocaleString("fi-FI")}</strong>
                <small>Aktiiviset käyttäjät</small>
              </div>
            </article>
            <article className={styles.summaryCard}>
              <div className={`${styles.summaryIcon} ${styles.iconCyan}`}><ClipboardList size={22} /></div>
              <div className={styles.summaryBody}>
                <span>Ilmoitukset</span>
                <strong>{Number(stats.listings_total ?? 0).toLocaleString("fi-FI")}</strong>
                <small>Ilmoituksia yhteensä</small>
              </div>
            </article>
            <article className={styles.summaryCard}>
              <div className={`${styles.summaryIcon} ${styles.iconGreen}`}><BadgeCheck size={22} /></div>
              <div className={styles.summaryBody}>
                <span>Myydyt</span>
                <strong>{Number(stats.sold_total ?? 0).toLocaleString("fi-FI")}</strong>
                <small>Tällä viikolla</small>
              </div>
            </article>
            <article className={styles.summaryCard}>
              <div className={`${styles.summaryIcon} ${styles.iconRed}`}><Ban size={22} /></div>
              <div className={styles.summaryBody}>
                <span>Bannatut</span>
                <strong>{users.filter((u) => u.is_banned).length}</strong>
                <small>Tällä viikolla</small>
              </div>
            </article>
            <article className={styles.summaryCard}>
              <div className={`${styles.summaryIcon} ${styles.iconOrange}`}><Euro size={22} /></div>
              <div className={styles.summaryBody}>
                <span>Liikevaihto</span>
                <strong>{Number(stats.revenue_total ?? 0).toLocaleString("fi-FI")} €</strong>
                <small>Liikevaihto yhteensä</small>
              </div>
            </article>
          </div>
        )}

        {bootLoading && (
          <div className={styles.notice}>
            Tarkistetaan oikeudet...
          </div>
        )}

        {!bootLoading && !isAdmin && (
          <div className={styles.notice}>
            <strong>{bootMessage}</strong>
            <p>
              Aja Supabasessa `supabase/admin-roles.sql` ja `supabase/admin-extended.sql`,
              ja lisää käyttäjä tällä komennolla:
            </p>
            <pre>{"select public.grant_admin_to_email('sinun@gmail.com');"}</pre>
          </div>
        )}

        {!bootLoading && isAdmin && !pinUnlocked && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              minHeight: "60vh",
              padding: "20px 0"
            }}
          >
          <div className={styles.notice} style={{ display: "grid", gap: 12, maxWidth: 480, width: "100%", margin: "0 auto" }}>
            <strong>Syötä PIN-koodi jatkaaksesi</strong>
            <p>
              Admin-toiminnot avautuvat vasta kun annat oikean PIN:n. Jokainen
              uusi kirjautuminen vaatii PIN:n syöttämisen.
            </p>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={pinInput}
              onChange={(e) => { setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6)); setPinError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") void submitPin(); }}
              placeholder=""
              className={styles.searchInput}
              style={{ fontSize: "1.2rem", letterSpacing: "0.3em", textAlign: "center" }}
              autoFocus
            />
            {pinError && (
              <span style={{ color: "#b91c1c", fontWeight: 900, fontSize: "0.9rem" }}>
                {pinError}
              </span>
            )}
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => void submitPin()}
              disabled={pinChecking}
            >
              {pinChecking ? "Tarkistetaan..." : "Avaa admin"}
            </button>
          </div>
          </div>
        )}

        {!bootLoading && isAdmin && pinUnlocked && (
          <>
            {activeTab === "overview" && (
              <>
                <DashboardOverviewPanel
                  stats={stats}
                  loading={statsLoading}
                  onOpenReport={() => setActiveTab("listings")}
                />
                <RecentEventsPanelV2
                  users={users}
                  listings={listings}
                  onViewAll={() => setActiveTab("users")}
                />
              </>
            )}

            {activeTab === "users" && (
              <UsersPanel
                users={users}
                loading={usersLoading}
                query={userQuery}
                onQueryChange={setUserQuery}
                onRefresh={loadUsers}
                onAction={(action, user) => setConfirm({ kind: action, user } as ConfirmState)}
                onAdjustPhoneVer={handleAdjustPhoneVerifications}
                onToggleBan={(user) => {
                  if (user.is_banned) {
                    void handleToggleBan(user);
                  } else {
                    setConfirm({ kind: "ban-user", user });
                  }
                }}
                onBanUserIp={(user) => {
                  if (!user.last_ip) {
                    showError("Käyttäjältä ei löydy tallennettua IP:tä vielä.");
                    return;
                  }
                  setConfirm({
                    kind: "ban-ip",
                    prefillIp: user.last_ip,
                    contextUserName: user.full_name || user.email || user.id.slice(0, 8)
                  });
                }}
              />
            )}

            {activeTab === "listings" && (
              <ListingsPanel
                listings={listings}
                stats={stats}
                loading={listingsLoading}
                query={listingQuery}
                onQueryChange={setListingQuery}
                onRefresh={loadListings}
                onDelete={(listing) => setConfirm({ kind: "delete-listing", listing })}
                status={listingStatus}
                onStatusChange={setListingStatus}
                vehicle={listingVehicle}
                onVehicleChange={setListingVehicle}
              />
            )}

            {activeTab === "appearance" && (
              <AppearancePanel
                onToastAction={(kind: "ok" | "err", text: string) =>
                  kind === "ok" ? showOk(text) : showError(text)
                }
              />
            )}

            {activeTab === "categories" && (
              <CategoriesPanel
                onToastAction={(kind: "ok" | "err", text: string) =>
                  kind === "ok" ? showOk(text) : showError(text)
                }
              />
            )}

            {activeTab === "bans" && (
              <BansPanel
                bannedIps={bannedIps}
                bannedUsers={bannedUsers}
                loading={bannedIpsLoading}
                usersLoading={bannedUsersLoading}
                onAddIp={() => setConfirm({ kind: "ban-ip" })}
                onUnbanIp={handleUnbanIp}
                onUnbanUser={(user) => void handleToggleBan(user)}
                onRefresh={loadBans}
              />
            )}
          </>
        )}
      </section>

      {confirm && (
        <ConfirmDialogs
          state={confirm}
          onClose={() => setConfirm(null)}
          onDeleteListing={handleDeleteListing}
          onDeleteUser={handleDeleteUser}
          onBanUser={handleToggleBan}
          onVerifyPhone={handleVerifyPhone}
          onSetPoints={handleSetPoints}
          onSetSlots={handleSetSlots}
          onUpdateProfile={handleUpdateProfile}
          onBanIp={handleBanIp}
        />
      )}

      {toast && (
        <div className={`${styles.toast} ${toast.type === "error" ? styles.toastError : ""}`}>
          {toast.message}
        </div>
      )}
    </main>
  );
}

/* =================================================================
   RECENT EVENTS PANEL
================================================================= */

function relativeTime(value?: string | null) {
  if (!value) return "";
  const ms = Date.now() - new Date(value).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "juuri nyt";
  if (min < 60) return `${min} min sitten`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h sitten`;
  const d = Math.floor(h / 24);
  return `${d} pv sitten`;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function RecentEventsPanel({ users, listings }: {
  users: AdminProfileRow[];
  listings: AdminListing[];
}) {
  type Event = { kind: string; title: string; sub: string; time: string };
  const events: Event[] = useMemo(() => {
    const arr: Event[] = [];
    users.slice(0, 4).forEach((u) => {
      arr.push({
        kind: "user",
        title: `Uusi käyttäjä: ${u.full_name || u.email || "tuntematon"}`,
        sub: u.email || u.id.slice(0, 8),
        time: u.created_at ?? ""
      });
    });
    listings.slice(0, 4).forEach((l) => {
      arr.push({
        kind: "listing",
        title: `Uusi ilmoitus: ${l.title || "Nimetön"}`,
        sub: l.seller_name || "—",
        time: l.created_at ?? ""
      });
    });
    return arr
      .filter((e) => e.time)
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 8);
  }, [users, listings]);

  if (events.length === 0) return null;

  return (
    <div className={styles.recentEvents}>
      <h3>Viimeisimmät tapahtumat</h3>
      <div className={styles.recentEventList}>
        {events.map((e, idx) => (
          <div key={idx} className={styles.recentEventItem}>
            <div>
              <strong>{e.title}</strong>
              <small>{e.sub}</small>
            </div>
            <span className={styles.recentEventTime}>{relativeTime(e.time)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentEventsPanelV2({ users, listings, onViewAll }: {
  users: AdminProfileRow[];
  listings: AdminListing[];
  onViewAll: () => void;
}) {
  type Event = { kind: "user" | "listing" | "completed"; title: string; sub: string; time: string };
  const events: Event[] = useMemo(() => {
    const arr: Event[] = [];
    users.slice(0, 6).forEach((user) => {
      arr.push({
        kind: "user",
        title: "Uusi käyttäjä rekisteröityi",
        sub: user.email || user.full_name || user.id.slice(0, 8),
        time: user.created_at ?? ""
      });
    });
    listings.slice(0, 6).forEach((listing) => {
      arr.push({
        kind: listing.is_sold ? "completed" : "listing",
        title: listing.is_sold ? `Tilaus valmis #${listing.id.slice(0, 6)}` : `Uusi tilaus #${listing.id.slice(0, 6)}`,
        sub: listing.seller_name || listing.title || "-",
        time: listing.created_at ?? ""
      });
    });
    return arr
      .filter((event) => event.time)
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 9);
  }, [users, listings]);

  if (events.length === 0) return null;

  return (
    <div className={styles.recentEvents}>
      <div className={styles.recentEventsHeader}>
        <h3>Viimeisin toiminta</h3>
        <button type="button" onClick={onViewAll}>Näytä kaikki tapahtumat</button>
      </div>
      <div className={styles.recentEventList}>
        {events.map((event, index) => (
          <div key={`${event.title}-${index}`} className={styles.recentEventItem}>
            <div className={`${styles.recentEventIcon} ${styles[event.kind]}`}>
              {event.kind === "listing" ? (
                <ClipboardList size={18} />
              ) : event.kind === "completed" ? (
                <BadgeCheck size={18} />
              ) : (
                <Users size={18} />
              )}
            </div>
            <div>
              <strong>{event.title}</strong>
              <small>{event.sub}</small>
            </div>
            <span className={styles.recentEventTime}>{relativeTime(event.time)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* =================================================================
   OVERVIEW PANEL
================================================================= */

function formatNumber(value: number, suffix = "") {
  return `${Number(value ?? 0).toLocaleString("fi-FI")}${suffix}`;
}

function trendBadge(current: number, previous: number) {
  if (previous === 0 && current === 0) {
    return { className: "flat", icon: "·", text: "—" };
  }
  if (previous === 0) {
    return { className: "up", icon: "▲", text: "uusi" };
  }
  const diff = ((current - previous) / previous) * 100;
  const rounded = Math.round(diff);
  if (rounded > 0) return { className: "up", icon: "▲", text: `${rounded}%` };
  if (rounded < 0) return { className: "down", icon: "▼", text: `${rounded}%` };
  return { className: "flat", icon: "·", text: "0%" };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function OverviewPanel({ stats, loading, onRefresh }: {
  stats: AdminOverviewStats | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  type CardSpec = {
    icon: typeof Users;
    label: string;
    accent?: "" | "accentGreen" | "accentRed" | "accentPurple" | "accentOrange";
    today: number;
    week: number;
    month: number;
    total: number;
    prev?: number;
    suffix?: string;
  };

  const cards: CardSpec[] = [
    {
      icon: Users, label: "Käyttäjiä",
      today: stats?.profiles_today ?? 0,
      week: stats?.profiles_7d ?? 0,
      month: stats?.profiles_month ?? 0,
      total: stats?.profiles_total ?? 0,
      prev: stats?.profiles_prev_month ?? 0
    },
    {
      icon: ClipboardList, label: "Ilmoituksia",
      today: stats?.listings_today ?? 0,
      week: stats?.listings_7d ?? 0,
      month: stats?.listings_month ?? 0,
      total: stats?.listings_total ?? 0,
      prev: stats?.listings_prev_month ?? 0
    },
    {
      icon: BadgeCheck, label: "Myytyjä", accent: "accentGreen",
      today: stats?.sold_today ?? 0,
      week: stats?.sold_7d ?? 0,
      month: stats?.sold_month ?? 0,
      total: stats?.sold_total ?? 0,
      prev: stats?.sold_prev_month ?? 0
    },
    {
      icon: Euro, label: "Liikevaihto", accent: "accentOrange", suffix: " €",
      today: stats?.revenue_today ?? 0,
      week: stats?.revenue_7d ?? 0,
      month: stats?.revenue_month ?? 0,
      total: stats?.revenue_total ?? 0,
      prev: stats?.revenue_prev_month ?? 0
    },
    {
      icon: Eye, label: "Sivulatauksia", accent: "accentPurple",
      today: stats?.visits_today ?? 0,
      week: stats?.visits_7d ?? 0,
      month: stats?.visits_month ?? 0,
      total: stats?.visits_total ?? 0
    },
    {
      icon: Users, label: "Uniikit kävijät", accent: "accentPurple",
      today: stats?.unique_visitors_today ?? 0,
      week: stats?.unique_visitors_7d ?? 0,
      month: stats?.unique_visitors_month ?? 0,
      total: stats?.unique_visitors_total ?? 0
    },
    {
      icon: Trash2, label: "Poistettuja", accent: "accentRed",
      today: stats?.deleted_today ?? 0,
      week: stats?.deleted_7d ?? 0,
      month: stats?.deleted_month ?? 0,
      total: stats?.deleted_total ?? 0
    }
  ];

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <span>Tilastot</span>
          <h2>Yleiskatsaus</h2>
        </div>
        <button type="button" className={styles.ghostBtn} onClick={onRefresh}>
          {loading ? "Päivitetään..." : "Päivitä"}
        </button>
      </div>

      <div className={styles.statsGridLarge}>
        {cards.map((card) => {
          const Icon = card.icon;
          const trend = card.prev !== undefined ? trendBadge(card.month, card.prev) : null;
          const accentClass = card.accent ? styles[card.accent] : "";
          return (
            <article key={card.label} className={`${styles.statCardRich} ${accentClass}`}>
              <div className={styles.statCardHead}>
                <Icon size={18} />
                <span>{card.label}</span>
              </div>
              <div className={styles.statCardBig}>
                <b>{formatNumber(card.month, card.suffix)}</b>
                {trend && (
                  <span className={`${styles.statCardTrend} ${styles[trend.className]}`}>
                    {trend.icon} {trend.text}
                  </span>
                )}
              </div>
              <div className={styles.statCardBreakdown}>
                <div>
                  <small>Tänään</small>
                  <strong>{formatNumber(card.today, card.suffix)}</strong>
                </div>
                <div>
                  <small>7 pv</small>
                  <strong>{formatNumber(card.week, card.suffix)}</strong>
                </div>
                <div>
                  <small>Yhteensä</small>
                  <strong>{formatNumber(card.total, card.suffix)}</strong>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function dashboardTrend(current: number, previous?: number) {
  if (previous === undefined || (previous === 0 && current === 0)) {
    return { className: "flat", label: "-" };
  }
  if (previous === 0) {
    return { className: "up", label: "100%" };
  }
  const value = Math.round(((current - previous) / previous) * 100);
  if (value > 0) return { className: "up", label: `${value}%` };
  if (value < 0) return { className: "down", label: `${Math.abs(value)}%` };
  return { className: "flat", label: "0%" };
}

function dashboardSpark(values: number[]) {
  const max = Math.max(...values, 1);
  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * 100;
      const y = 34 - (Math.max(0, value) / max) * 24;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function DashboardOverviewPanel({ stats, loading, onOpenReport }: {
  stats: AdminOverviewStats | null;
  loading: boolean;
  onOpenReport: () => void;
}) {
  const cards = [
    {
      label: "Käyttäjät",
      value: stats?.profiles_month ?? 0,
      today: stats?.profiles_today ?? 0,
      week: stats?.profiles_7d ?? 0,
      month: stats?.profiles_month ?? 0,
      previous: stats?.profiles_prev_month ?? 0,
      accent: "accentBlue",
      series: [0, stats?.profiles_today ?? 0, stats?.profiles_7d ?? 0, stats?.profiles_month ?? 0, stats?.profiles_total ?? 0]
    },
    {
      label: "Ilmoitukset",
      value: stats?.listings_month ?? 0,
      today: stats?.listings_today ?? 0,
      week: stats?.listings_7d ?? 0,
      month: stats?.listings_month ?? 0,
      previous: stats?.listings_prev_month ?? 0,
      accent: "accentBlue",
      series: [stats?.listings_today ?? 0, stats?.listings_7d ?? 0, stats?.listings_month ?? 0, stats?.listings_total ?? 0, stats?.listings_7d ?? 0]
    },
    {
      label: "Myydyt",
      value: stats?.sold_month ?? 0,
      today: stats?.sold_today ?? 0,
      week: stats?.sold_7d ?? 0,
      month: stats?.sold_month ?? 0,
      previous: stats?.sold_prev_month ?? 0,
      accent: "accentGreen",
      series: [0, stats?.sold_today ?? 0, stats?.sold_7d ?? 0, stats?.sold_month ?? 0, stats?.sold_total ?? 0]
    },
    {
      label: "Liikevaihto",
      value: stats?.revenue_month ?? 0,
      today: stats?.revenue_today ?? 0,
      week: stats?.revenue_7d ?? 0,
      month: stats?.revenue_month ?? 0,
      previous: stats?.revenue_prev_month ?? 0,
      suffix: " €",
      accent: "accentOrange",
      series: [stats?.revenue_today ?? 0, stats?.revenue_7d ?? 0, stats?.revenue_month ?? 0, stats?.revenue_total ?? 0, stats?.revenue_7d ?? 0]
    },
    {
      label: "Sivulataukset",
      value: stats?.visits_month ?? 0,
      today: stats?.visits_today ?? 0,
      week: stats?.visits_7d ?? 0,
      month: stats?.visits_month ?? 0,
      previous: Math.max(0, (stats?.visits_month ?? 0) - (stats?.visits_7d ?? 0)),
      accent: "accentPurple",
      series: [stats?.visits_today ?? 0, stats?.visits_7d ?? 0, stats?.visits_month ?? 0, stats?.visits_total ?? 0, stats?.visits_7d ?? 0]
    },
    {
      label: "Uniikit kävijät",
      value: stats?.unique_visitors_month ?? 0,
      today: stats?.unique_visitors_today ?? 0,
      week: stats?.unique_visitors_7d ?? 0,
      month: stats?.unique_visitors_month ?? 0,
      previous: Math.max(0, (stats?.unique_visitors_month ?? 0) - (stats?.unique_visitors_7d ?? 0)),
      accent: "accentPurple",
      series: [stats?.unique_visitors_today ?? 0, stats?.unique_visitors_7d ?? 0, stats?.unique_visitors_month ?? 0, stats?.unique_visitors_total ?? 0, stats?.unique_visitors_7d ?? 0]
    },
    {
      label: "Poistetut",
      value: stats?.deleted_month ?? 0,
      today: stats?.deleted_today ?? 0,
      week: stats?.deleted_7d ?? 0,
      month: stats?.deleted_month ?? 0,
      accent: "accentRed",
      series: [0, stats?.deleted_today ?? 0, stats?.deleted_7d ?? 0, stats?.deleted_month ?? 0, stats?.deleted_total ?? 0]
    },
    {
      label: "Hyvitykset",
      value: 0,
      today: 0,
      week: 0,
      month: 0,
      suffix: " €",
      accent: "accentYellow",
      series: [0, 0, 0, 0, 0]
    }
  ];

  return (
    <section className={`${styles.panel} ${styles.dashboardPanel}`}>
      <div className={styles.dashboardSectionHeader}>
        <h2>Tilastojen yleiskatsaus</h2>
        <button type="button" className={styles.fullReportButton} onClick={onOpenReport}>
          {loading ? "Päivitetään..." : "Näytä koko raportti"}
          <ExternalLink size={15} />
        </button>
      </div>

      <div className={styles.statsGridLarge}>
        {cards.map((card) => {
          const trend = dashboardTrend(card.month, card.previous);
          return (
            <article key={card.label} className={`${styles.statCardRich} ${styles[card.accent]}`}>
              <div className={styles.statCardHead}>
                <span>{card.label}</span>
                <span className={`${styles.statCardTrend} ${styles[trend.className]}`}>
                  {trend.className === "flat" ? "-" : trend.className === "down" ? "↓" : "↑"} {trend.label}
                </span>
              </div>
              <div className={styles.statCardBig}>
                <b>{formatNumber(card.value, card.suffix)}</b>
              </div>
              <div className={styles.statCardBreakdown}>
                <div>
                  <small>Tänään</small>
                  <strong>{formatNumber(card.today, card.suffix)}</strong>
                </div>
                <div>
                  <small>7 pv</small>
                  <strong>{formatNumber(card.week, card.suffix)}</strong>
                </div>
                <div>
                  <small>30 pv</small>
                  <strong>{formatNumber(card.month, card.suffix)}</strong>
                </div>
              </div>
              <svg className={styles.sparkline} viewBox="0 0 100 38" preserveAspectRatio="none" aria-hidden="true">
                <polyline points={dashboardSpark(card.series)} />
              </svg>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/* =================================================================
   USERS PANEL
================================================================= */

type UserActionKind = "delete-user" | "ban-user" | "verify-phone" | "set-points" | "set-slots" | "edit-profile";

function UsersPanel({
  users,
  loading,
  query,
  onQueryChange,
  onRefresh,
  onAction,
  onAdjustPhoneVer,
  onToggleBan,
  onBanUserIp
}: {
  users: AdminProfileRow[];
  loading: boolean;
  query: string;
  onQueryChange: (q: string) => void;
  onRefresh: () => void;
  onAction: (kind: UserActionKind, user: AdminProfileRow) => void;
  onAdjustPhoneVer: (user: AdminProfileRow, delta: number) => void;
  onToggleBan: (user: AdminProfileRow) => void;
  onBanUserIp: (user: AdminProfileRow) => void;
}) {
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <span>Hallinta</span>
          <h2>Käyttäjät</h2>
        </div>
        <p>Etsi nimellä, sähköpostilla, puhelinnumerolla tai ID:llä.</p>
      </div>

      <div className={styles.searchBar}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Hae käyttäjiä..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
        <button type="button" className={styles.ghostBtn} onClick={onRefresh}>
          {loading ? "Ladataan..." : "Päivitä"}
        </button>
      </div>

      {users.length === 0 && !loading ? (
        <div className={styles.empty}>Ei käyttäjiä.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className={styles.userTable}>
            <thead>
              <tr>
                <th>Nimi</th>
                <th>Sähköposti</th>
                <th>Pisteet</th>
                <th>Vahvistukset</th>
                <th>Paikat</th>
                <th>Tila</th>
                <th>Liittynyt</th>
                <th style={{ textAlign: "right" }}>Toiminnot</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <UserTableRow
                  key={u.id}
                  user={u}
                  onAction={onAction}
                  onAdjustPhoneVer={onAdjustPhoneVer}
                  onToggleBan={onToggleBan}
                  onBanUserIp={onBanUserIp}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function UserTableRow({
  user: u,
  onAction,
  onAdjustPhoneVer,
  onToggleBan,
  onBanUserIp
}: {
  user: AdminProfileRow;
  onAction: (kind: UserActionKind, user: AdminProfileRow) => void;
  onAdjustPhoneVer: (user: AdminProfileRow, delta: number) => void;
  onToggleBan: (user: AdminProfileRow) => void;
  onBanUserIp: (user: AdminProfileRow) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);

  const openMenu = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const menuHeightEstimate = 230;
      const opensBelow = rect.bottom + menuHeightEstimate + 12 <= window.innerHeight;
      setMenuPos({
        top: opensBelow ? rect.bottom + 8 : Math.max(12, rect.top - menuHeightEstimate - 8),
        right: Math.max(12, window.innerWidth - rect.right),
      });
    }
    setMenuOpen(true);
  };

  useEffect(() => {
    if (!menuOpen) return;
    function onClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest(`[data-action-menu="${u.id}"]`) && !target.closest(`[data-action-portal="${u.id}"]`)) {
        setMenuOpen(false);
      }
    }
    function onScroll() { setMenuOpen(false); }
    document.addEventListener("mousedown", onClickOutside);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [menuOpen, u.id]);

  const verifyCount = u.phone_verification_count;
  const verifyMax = 2 + (u.extra_phone_verifications ?? 0);
  const phoneVerified = Boolean(u.phone_verified_at);
  const verifyClass =
    !phoneVerified ? "danger" : verifyCount >= verifyMax ? "warn" : "ok";
  const slots = BASE_LISTING_SLOT_LIMIT + (u.extra_listing_slots ?? 0);

  return (
    <tr>
      <td className={styles.cellName}>
        <strong>{u.full_name || [u.first_name, u.last_name].filter(Boolean).join(" ") || "Tuntematon"}</strong>
        <small>
          {u.account_type === "company" ? "Yritys" : "Yksityinen"}
          {u.business_id ? ` · ${u.business_id}` : ""}
          {u.is_admin ? " · ADMIN" : ""}
        </small>
      </td>
      <td>
        <div>{u.email || "—"}</div>
        <small style={{ color: "#94a3b8", fontSize: "0.78rem", fontWeight: 700 }}>
          {u.phone || "ei puhelinta"}
          {u.last_ip ? ` · ${u.last_ip}` : ""}
        </small>
      </td>
      <td><strong>{u.points}</strong></td>
      <td>
        <span className={`${styles.verifyText} ${styles[verifyClass]}`}>
          {verifyCount}/{verifyMax}
        </span>
      </td>
      <td><strong>{slots}</strong>{(u.extra_listing_slots ?? 0) > 0 && <small style={{ color: "#94a3b8", marginLeft: 4 }}>(+{u.extra_listing_slots})</small>}</td>
      <td>
        {u.is_banned ? (
          <span className={`${styles.statusPill} ${styles.statusBanned}`}>Bannattu</span>
        ) : !phoneVerified ? (
          <span className={`${styles.statusPill} ${styles.statusPending}`}>Odottaa</span>
        ) : (
          <span className={`${styles.statusPill} ${styles.statusActive}`}>Aktiivinen</span>
        )}
      </td>
      <td><small style={{ color: "#5c6b7a", fontWeight: 800 }}>{formatDate(u.created_at)}</small></td>
      <td style={{ textAlign: "right" }}>
        <div className={styles.actionMenuWrap} data-action-menu={u.id}>
          <button
            ref={triggerRef}
            type="button"
            className={styles.actionMenuTrigger}
            onClick={() => menuOpen ? setMenuOpen(false) : openMenu()}
          >
            Toiminnot <ChevronDown size={14} />
          </button>
        </div>
        {menuOpen && typeof document !== "undefined" && createPortal(
          <div
            data-action-portal={u.id}
            className={styles.actionMenu}
            style={{ position: "fixed", top: menuPos.top, right: menuPos.right, zIndex: 9999 }}
          >
            <div className={styles.actionMenuGrid}>
            <button
              type="button"
              className={styles.actionMenuItem}
              onClick={() => { setMenuOpen(false); onAction("edit-profile", u); }}
            >
              <UserCog size={14} /> Muokkaa
            </button>
            <button
              type="button"
              className={styles.actionMenuItem}
              onClick={() => { setMenuOpen(false); onAction("set-points", u); }}
            >
              <Euro size={14} /> Aseta pisteet
            </button>
            <button
              type="button"
              className={styles.actionMenuItem}
              onClick={() => { setMenuOpen(false); onAction("set-slots", u); }}
            >
              <ClipboardList size={14} /> Ilmoituspaikat
            </button>
            <button
              type="button"
              className={styles.actionMenuItem}
              onClick={() => { setMenuOpen(false); onAdjustPhoneVer(u, 1); }}
            >
              <BadgeCheck size={14} /> +1 vahvistus
            </button>
            <button
              type="button"
              className={styles.actionMenuItem}
              onClick={() => { setMenuOpen(false); onAdjustPhoneVer(u, -1); }}
              disabled={(u.extra_phone_verifications ?? 0) === 0}
            >
              <BadgeCheck size={14} /> -1 vahvistus
            </button>
            <button
              type="button"
              className={styles.actionMenuItem}
              onClick={() => { setMenuOpen(false); onAction("verify-phone", u); }}
            >
              <BadgeCheck size={14} /> Puhelin ok
            </button>
            </div>
            <div className={styles.actionMenuDangerGrid}>
            <button
              type="button"
              className={`${styles.actionMenuItem} ${u.is_banned ? "" : styles.danger}`}
              onClick={() => { setMenuOpen(false); onToggleBan(u); }}
              disabled={u.is_admin}
            >
              <Ban size={14} /> {u.is_banned ? "Poista banni" : "Bannaa käyttäjä"}
            </button>
            <button
              type="button"
              className={`${styles.actionMenuItem} ${styles.danger}`}
              onClick={() => { setMenuOpen(false); onBanUserIp(u); }}
              disabled={u.is_admin}
            >
              <Ban size={14} /> Bannaa IP
            </button>
            <button
              type="button"
              className={`${styles.actionMenuItem} ${styles.danger}`}
              onClick={() => { setMenuOpen(false); onAction("delete-user", u); }}
              disabled={u.is_admin}
            >
              <Trash2 size={14} /> Poista käyttäjä
            </button>
            </div>
          </div>,
          document.body
        )}
      </td>
    </tr>
  );
}

/* =================================================================
   LISTINGS PANEL
================================================================= */

function ListingsPanel({
  listings,
  stats,
  loading,
  query,
  onQueryChange,
  onRefresh,
  onDelete,
  status,
  onStatusChange,
  vehicle,
  onVehicleChange
}: {
  listings: AdminListing[];
  stats: AdminOverviewStats | null;
  loading: boolean;
  query: string;
  onQueryChange: (q: string) => void;
  onRefresh: () => void;
  onDelete: (listing: AdminListing) => void;
  status: ListingStatus;
  onStatusChange: (status: ListingStatus) => void;
  vehicle: string;
  onVehicleChange: (v: string) => void;
}) {
  function normalizeVehicle(v?: string | null): string {
    const s = (v ?? "").trim().toLowerCase();
    if (!s) return "";
    if (s === "mopo" || s === "mopot") return "Mopot";
    if (s === "moottorikelkka" || s === "moottorikelkat") return "Moottorikelkka";
    if (s === "mönkijä" || s === "mönkijät" || s === "monkija" || s === "monkijat") return "Mönkijä";
    if (s === "motocross" || s === "crossi" || s === "crossit") return "Motocross";
    return v ?? "";
  }

  const vehicleBucket = useCallback((v?: string | null): string => {
    const norm = normalizeVehicle(v);
    if (!norm) return "Muut";
    if (["Mopot", "Moottorikelkka", "Mönkijä", "Motocross"].includes(norm)) return norm;
    return "Muut";
  }, []);

  const useGlobalListingCounts = !query.trim() && vehicle === "all";
  const totalListingCount = useGlobalListingCounts
    ? Number(stats?.listings_total ?? listings.length)
    : listings.length;
  const soldListingCount = useGlobalListingCounts
    ? Number(stats?.sold_total ?? listings.filter((l) => !!l.is_sold).length)
    : listings.filter((l) => !!l.is_sold).length;
  const activeListingCount = Math.max(0, totalListingCount - soldListingCount);

  const vehicleCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: totalListingCount,
      Mopot: 0,
      Moottorikelkka: 0,
      Mönkijä: 0,
      Motocross: 0,
      Muut: 0
    };
    listings.forEach((l) => {
      const bucket = vehicleBucket(l.vehicle_type);
      counts[bucket] = (counts[bucket] ?? 0) + 1;
    });
    return counts;
  }, [listings, totalListingCount, vehicleBucket]);

  const filtered = useMemo(() => {
    let arr = listings;
    if (status === "active") arr = arr.filter((l) => !l.is_sold);
    if (status === "sold") arr = arr.filter((l) => !!l.is_sold);
    if (vehicle !== "all") {
      arr = arr.filter((l) => vehicleBucket(l.vehicle_type) === vehicle);
    }
    return arr;
  }, [listings, status, vehicle, vehicleBucket]);

  const counts = {
    all: totalListingCount,
    active: activeListingCount,
    sold: soldListingCount
  };

  const totalViews = listings.reduce((sum, l) => sum + (l.view_count ?? 0), 0);
  const activeRevenue = stats?.revenue_total ?? 0;

  return (
    <section className={styles.panel}>
      <div className={styles.listingsHero}>
        <div>
          <h2>Ilmoitusten hallinta</h2>
          <p>Hallitse ilmoituksia ja seuraa niiden tilannetta.</p>
        </div>
        <button
          type="button"
          className={styles.fullReportButton}
          onClick={() => {
            onQueryChange("");
            onStatusChange("all");
            onVehicleChange("all");
            window.setTimeout(onRefresh, 0);
          }}
        >
          {loading ? "Ladataan..." : "Näytä kaikki ilmoitukset"}
        </button>
      </div>

      {/* Yhteenveto */}
      <div className={styles.summaryStrip} style={{ marginBottom: 18 }}>
        <article className={styles.summaryCard}>
          <div className={`${styles.summaryIcon} ${styles.iconBlue}`}><ClipboardList size={22} /></div>
          <div className={styles.summaryBody}>
            <strong>{counts.active}</strong>
            <span>Aktiivisia ilmoituksia</span>
          </div>
        </article>
        <article className={styles.summaryCard}>
          <div className={`${styles.summaryIcon} ${styles.iconGreen}`}><Euro size={22} /></div>
          <div className={styles.summaryBody}>
            <strong>{Number(activeRevenue).toLocaleString("fi-FI")} €</strong>
            <span>Kokonaismyynti</span>
          </div>
        </article>
        <article className={styles.summaryCard}>
          <div className={`${styles.summaryIcon} ${styles.iconPurple ?? styles.iconCyan}`} style={{ background: "linear-gradient(135deg, #7c3aed, #a78bfa)" }}>
            <Eye size={22} />
          </div>
          <div className={styles.summaryBody}>
            <strong>{Number(totalViews).toLocaleString("fi-FI")}</strong>
            <span>Katselukertoja</span>
          </div>
        </article>
        <article className={styles.summaryCard}>
          <div className={`${styles.summaryIcon} ${styles.iconOrange}`}><BadgeCheck size={22} /></div>
          <div className={styles.summaryBody}>
            <strong>{counts.sold}</strong>
            <span>Myyty</span>
          </div>
        </article>
      </div>

      {/* Status-välilehdet + työkalut */}
      <div className={styles.listingsToolbar}>
        <div className={styles.listingStatusTabs}>
          <button
            type="button"
            className={`${styles.listingStatusTab} ${status === "all" ? styles.listingStatusTabActive : ""}`}
            onClick={() => onStatusChange("all")}
          >
            Kaikki ({counts.all})
          </button>
          <button
            type="button"
            className={`${styles.listingStatusTab} ${status === "active" ? styles.listingStatusTabActive : ""}`}
            onClick={() => onStatusChange("active")}
          >
            Aktiiviset ({counts.active})
          </button>
          <button
            type="button"
            className={`${styles.listingStatusTab} ${status === "sold" ? styles.listingStatusTabActive : ""}`}
            onClick={() => onStatusChange("sold")}
          >
            Myydyt ({counts.sold})
          </button>
        </div>
        <button type="button" className={styles.ghostBtn} onClick={onRefresh}>
          {loading ? "Ladataan..." : "Päivitä"}
        </button>
      </div>

      <div className={styles.listingStatusTabs} style={{ marginBottom: 12 }}>
        {[
          { key: "all", label: "Kaikki tyypit" },
          { key: "Moottorikelkka", label: "Moottorikelkat" },
          { key: "Mönkijä", label: "Mönkijät" },
          { key: "Motocross", label: "Crossit" },
          { key: "Mopot", label: "Mopot" },
          { key: "Muut", label: "Muut / luokittelematon" }
        ].map((v) => (
          <button
            key={v.key}
            type="button"
            className={`${styles.listingStatusTab} ${vehicle === v.key ? styles.listingStatusTabActive : ""}`}
            onClick={() => onVehicleChange(v.key)}
          >
            {v.label} ({vehicleCounts[v.key] ?? 0})
          </button>
        ))}
      </div>

      <div className={styles.searchBar}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Hae ilmoituksia otsikolla tai myyjällä..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
        <button type="button" className={styles.ghostBtn} onClick={onRefresh}>
          {loading ? "Ladataan..." : "Päivitä"}
        </button>
      </div>
      {listings.length < counts.all && !query.trim() && vehicle === "all" && (
        <p className={styles.listingLimitNote}>
          Näytetään {listings.length.toLocaleString("fi-FI")} uusinta ilmoitusta. Kokonaismäärä on {counts.all.toLocaleString("fi-FI")}.
        </p>
      )}

      <div className={styles.listingCardList}>
        {filtered.length === 0 && !loading && (
          <div className={styles.empty}>Ei ilmoituksia.</div>
        )}
        {filtered.map((listing) => {
          const imgUrl = listing.image_url || (listing.image_urls && listing.image_urls[0]) || null;
          const imgCount = listing.image_urls?.length ?? (imgUrl ? 1 : 0);
          const subtitle = [listing.brand, listing.model, listing.vehicle_type].filter(Boolean).join(" · ");

          return (
            <div key={listing.id} className={styles.listingMgmtCard}>
              <div className={styles.listingMgmtImg}>
                {imgUrl ? (
                  <img src={imgUrl} alt={listing.title || ""} />
                ) : (
                  <div style={{ display: "grid", placeItems: "center", height: "100%", color: "#94a3b8" }}>
                    <ClipboardList size={28} />
                  </div>
                )}
                {imgCount > 0 && (
                  <span className={styles.listingImageBadge}>📷 {imgCount}</span>
                )}
              </div>

              <div className={styles.listingMgmtBody}>
                {listing.category && (
                  <span className={styles.listingMgmtCategory}>{listing.category}</span>
                )}
                <h3 className={styles.listingMgmtTitle}>{listing.title || "Nimetön ilmoitus"}</h3>
                {subtitle && <p className={styles.listingMgmtSub}>{subtitle}</p>}
                <div className={styles.listingMgmtMeta}>
                  <span><Eye size={13} /> {Number(listing.view_count ?? 0).toLocaleString("fi-FI")} katselua</span>
                  <span>👤 {listing.seller_name || "—"}</span>
                </div>
              </div>

              <div className={styles.listingMgmtPrice}>
                <strong>{formatPrice(listing.price)}</strong>
                {listing.is_sold ? (
                  <span className={`${styles.statusPill} ${styles.statusBanned}`} style={{ background: "#dcfce7", color: "#166534" }}>● Myyty</span>
                ) : listing.is_hidden ? (
                  <span className={styles.statusPill} style={{ background: "#fef3c7", color: "#92400e", borderColor: "#fcd34d" }}>● Piilotettu</span>
                ) : (
                  <span className={`${styles.statusPill} ${styles.statusActive}`}>● Aktiivinen</span>
                )}
                <small>Lisätty {formatDate(listing.created_at)}</small>
              </div>

              <div className={styles.listingMgmtActions}>
                <Link href={`/listing/${listing.id}`} target="_blank" rel="noreferrer">
                  Avaa
                </Link>
                <button
                  type="button"
                  className="danger"
                  onClick={() => onDelete(listing)}
                >
                  <Trash2 size={14} /> Poista
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* =================================================================
   BANS PANEL
================================================================= */

function BansPanel({
  bannedIps,
  bannedUsers,
  loading,
  usersLoading,
  onAddIp,
  onUnbanIp,
  onUnbanUser,
  onRefresh
}: {
  bannedIps: AdminBannedIp[];
  bannedUsers: AdminProfileRow[];
  loading: boolean;
  usersLoading: boolean;
  onAddIp: () => void;
  onUnbanIp: (ip: string) => void;
  onUnbanUser: (user: AdminProfileRow) => void;
  onRefresh: () => void | Promise<void>;
}) {
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <span>Suojaus</span>
          <h2>Bannit</h2>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className={styles.ghostBtn} onClick={onRefresh}>
            {loading || usersLoading ? "Ladataan..." : "Päivitä"}
          </button>
          <button type="button" className={styles.primaryBtn} onClick={onAddIp}>
            <Ban size={14} /> Bannaa IP
          </button>
        </div>
      </div>

      <div className={styles.bansGrid}>
        <div className={styles.banColumn}>
          <div className={styles.banColumnHead}>
            <strong>IP-bännit</strong>
            <span>{bannedIps.length}</span>
          </div>

          <div className={styles.list}>
            {bannedIps.length === 0 && !loading && (
              <div className={styles.empty}>Ei bannattuja IP-osoitteita.</div>
            )}
            {bannedIps.map((ban) => (
              <div key={ban.ip} className={styles.bannedIpRow}>
                <code>{ban.ip}</code>
                <div className={styles.banMeta}>
                  <small>{ban.reason || "Ei syytä"} · {formatDate(ban.banned_at)}</small>
                </div>
                <button
                  type="button"
                  className={styles.ghostBtn}
                  onClick={() => onUnbanIp(ban.ip)}
                >
                  Unban
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.banColumn}>
          <div className={styles.banColumnHead}>
            <strong>Bännätyt käyttäjät</strong>
            <span>{bannedUsers.length}</span>
          </div>

          <div className={styles.list}>
            {bannedUsers.length === 0 && !usersLoading && (
              <div className={styles.empty}>Ei bannattuja käyttäjiä.</div>
            )}
            {bannedUsers.map((user) => (
              <div key={user.id} className={styles.bannedUserRow}>
                <div className={styles.cellName}>
                  <strong>{user.full_name || user.email || user.id.slice(0, 8)}</strong>
                  <small>{user.email || "Ei sähköpostia"}</small>
                </div>
                <div className={styles.banMeta}>
                  <small>{user.banned_reason || "Ei syytä"} · {formatDate(user.created_at)}</small>
                </div>
                <button
                  type="button"
                  className={styles.ghostBtn}
                  onClick={() => onUnbanUser(user)}
                >
                  Poista banni
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* =================================================================
   CONFIRM DIALOGS
================================================================= */

function ConfirmDialogs({
  state,
  onClose,
  onDeleteListing,
  onDeleteUser,
  onBanUser,
  onVerifyPhone,
  onSetPoints,
  onSetSlots,
  onUpdateProfile,
  onBanIp
}: {
  state: ConfirmState;
  onClose: () => void;
  onDeleteListing: (listing: AdminListing) => void;
  onDeleteUser: (user: AdminProfileRow) => void;
  onBanUser: (user: AdminProfileRow, reason?: string) => void;
  onVerifyPhone: (user: AdminProfileRow, newPhone?: string) => void;
  onSetPoints: (user: AdminProfileRow, value: number) => void;
  onSetSlots: (user: AdminProfileRow, value: number) => void;
  onUpdateProfile: (user: AdminProfileRow, updates: Record<string, string>) => void;
  onBanIp: (ip: string, reason?: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [phone, setPhone] = useState("");
  const [points, setPoints] = useState("");
  const [slots, setSlots] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [editFirst, setEditFirst] = useState("");
  const [editLast, setEditLast] = useState("");
  const [editFull, setEditFull] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editCountry, setEditCountry] = useState("");
  const [editBirthDate, setEditBirthDate] = useState("");
  const [editBusinessId, setEditBusinessId] = useState("");
  const [editCompanyName, setEditCompanyName] = useState("");

  /* Reset fields whenever the dialog changes */
  useEffect(() => {
    setReason("");
    setPhone("");
    setPoints("");
    setSlots("");
    setIpAddress(state && state.kind === "ban-ip" ? (state.prefillIp ?? "") : "");
    if (state && "user" in state && state.kind === "set-slots") {
      setSlots(String(BASE_LISTING_SLOT_LIMIT + (state.user.extra_listing_slots ?? 0)));
    }
    if (state && "user" in state && state.kind === "edit-profile") {
      setEditFirst(state.user.first_name ?? "");
      setEditLast(state.user.last_name ?? "");
      setEditFull(state.user.full_name ?? "");
      setEditCity("");
      setEditCountry("");
      setEditBirthDate("");
      setEditBusinessId(state.user.business_id ?? "");
      setEditCompanyName(state.user.company_name ?? "");
    }
    if (state && "user" in state && state.kind === "set-points") {
      setPoints(String(state.user.points));
    }
    if (state && "user" in state && state.kind === "verify-phone") {
      setPhone(state.user.phone ?? "");
    }
  }, [state]);

  if (!state) return null;

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {state.kind === "delete-listing" && (
          <>
            <h3>Poista ilmoitus?</h3>
            <p>
              Tätä ei voi perua. Ilmoitus &quot;{state.listing.title || "Nimetön ilmoitus"}&quot;
              poistetaan lopullisesti ja kirjataan poistettujen lokiin.
            </p>
            <div className={styles.modalActions}>
              <button type="button" className={styles.ghostBtn} onClick={onClose}>Peruuta</button>
              <button type="button" className={styles.dangerBtn} onClick={() => onDeleteListing(state.listing)}>
                <Trash2 size={14} /> Poista pysyvästi
              </button>
            </div>
          </>
        )}

        {state.kind === "delete-user" && (
          <>
            <h3>Poista käyttäjä?</h3>
            <p>
              Tätä ei voi perua. Käyttäjä {state.user.email || state.user.id.slice(0, 8)}
              {" "}poistetaan kokonaan – kaikki ilmoitukset ja viestit häviävät.
            </p>
            <div className={styles.modalActions}>
              <button type="button" className={styles.ghostBtn} onClick={onClose}>Peruuta</button>
              <button type="button" className={styles.dangerBtn} onClick={() => onDeleteUser(state.user)}>
                <Trash2 size={14} /> Poista käyttäjä
              </button>
            </div>
          </>
        )}

        {state.kind === "ban-user" && (
          <>
            <h3>Bannaa käyttäjä</h3>
            <p>Käyttäjä ei voi luoda ilmoituksia bannin aikana.</p>
            <label>
              Syy (valinnainen)
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
            </label>
            <div className={styles.modalActions}>
              <button type="button" className={styles.ghostBtn} onClick={onClose}>Peruuta</button>
              <button type="button" className={styles.dangerBtn} onClick={() => onBanUser(state.user, reason || undefined)}>
                <Ban size={14} /> Bannaa
              </button>
            </div>
          </>
        )}

        {state.kind === "verify-phone" && (
          <>
            <h3>Vahvista puhelinnumero</h3>
            <p>
              Nollataan {state.user.email || "käyttäjän"} vahvistuslaskuri ja merkitään
              numero vahvistetuksi (ohittaa 2× rajan).
            </p>
            <label>
              Puhelinnumero (jätä tyhjäksi pitääksesi nykyisen)
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+358..." />
            </label>
            <div className={styles.modalActions}>
              <button type="button" className={styles.ghostBtn} onClick={onClose}>Peruuta</button>
              <button type="button" className={styles.primaryBtn} onClick={() => onVerifyPhone(state.user, phone.trim() || undefined)}>
                <BadgeCheck size={14} /> Vahvista
              </button>
            </div>
          </>
        )}

        {state.kind === "set-points" && (
          <>
            <h3>Aseta pisteet</h3>
            <p>Nykyiset pisteet: {state.user.points}</p>
            <label>
              Uusi pistemäärä
              <input
                type="number"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                min={0}
              />
            </label>
            <div className={styles.modalActions}>
              <button type="button" className={styles.ghostBtn} onClick={onClose}>Peruuta</button>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => {
                  const value = Number.parseInt(points, 10);
                  if (Number.isNaN(value) || value < 0) return;
                  onSetPoints(state.user, value);
                }}
              >
                Tallenna
              </button>
            </div>
          </>
        )}

        {state.kind === "set-slots" && (
          <>
            <h3>Aseta ilmoituspaikat</h3>
            <p>
              Nykyiset paikat: <strong>{BASE_LISTING_SLOT_LIMIT + (state.user.extra_listing_slots ?? 0)}</strong>
              {" "}({BASE_LISTING_SLOT_LIMIT} perus + {state.user.extra_listing_slots ?? 0} extra)
            </p>
            <label>
              Uusi kokonaismäärä (sis. perus 100)
              <input
                type="number"
                value={slots}
                onChange={(e) => setSlots(e.target.value)}
                min={BASE_LISTING_SLOT_LIMIT}
                step={1}
              />
            </label>
            <div className={styles.modalActions}>
              <button type="button" className={styles.ghostBtn} onClick={onClose}>Peruuta</button>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => {
                  const total = Number.parseInt(slots, 10);
                  if (Number.isNaN(total)) return;
                  // Käyttäjä antaa kokonaismäärän — vähennetään perus jotta saadaan extras-arvo
                  const extras = Math.max(0, total - BASE_LISTING_SLOT_LIMIT);
                  onSetSlots(state.user, extras);
                }}
              >
                Tallenna
              </button>
            </div>
          </>
        )}

        {state.kind === "edit-profile" && (
          <>
            <h3>Muokkaa profiilia</h3>
            <p>{state.user.email}</p>
            <label>Etunimi <input value={editFirst} onChange={(e) => setEditFirst(e.target.value)} /></label>
            <label>Sukunimi <input value={editLast} onChange={(e) => setEditLast(e.target.value)} /></label>
            <label>Koko nimi <input value={editFull} onChange={(e) => setEditFull(e.target.value)} /></label>
            <label>Kaupunki <input value={editCity} onChange={(e) => setEditCity(e.target.value)} /></label>
            <label>Maa <input value={editCountry} onChange={(e) => setEditCountry(e.target.value)} /></label>
            <label>Syntymäpäivä <input type="date" value={editBirthDate} onChange={(e) => setEditBirthDate(e.target.value)} /></label>
            {state.user.account_type === "company" && (
              <>
                <label>Yrityksen nimi <input value={editCompanyName} onChange={(e) => setEditCompanyName(e.target.value)} /></label>
                <label>Y-tunnus <input value={editBusinessId} onChange={(e) => setEditBusinessId(e.target.value)} placeholder="esim. 1234567-8" /></label>
              </>
            )}
            <div className={styles.modalActions}>
              <button type="button" className={styles.ghostBtn} onClick={onClose}>Peruuta</button>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => {
                  const updates: Record<string, string> = {};
                  if (editFirst) updates.first_name = editFirst;
                  if (editLast) updates.last_name = editLast;
                  if (editFull) updates.full_name = editFull;
                  if (editCity) updates.city = editCity;
                  if (editCountry) updates.country = editCountry;
                  if (editBirthDate) updates.birth_date = editBirthDate;
                  if (state.user.account_type === "company") {
                    if (editCompanyName !== (state.user.company_name ?? "")) updates.company_name = editCompanyName;
                    if (editBusinessId !== (state.user.business_id ?? "")) updates.business_id = editBusinessId;
                  }
                  onUpdateProfile(state.user, updates);
                }}
              >
                Tallenna
              </button>
            </div>
          </>
        )}

        {state.kind === "ban-ip" && (
          <>
            <h3>Bannaa IP-osoite</h3>
            <p>
              {state.contextUserName
                ? `Bannataan käyttäjän ${state.contextUserName} viimeisin IP.`
                : "Bannattu IP ei voi seurata vierailuja tai (jos sovellus tukee) luoda sisältöä."}
            </p>
            <label>
              IP-osoite
              <input value={ipAddress} onChange={(e) => setIpAddress(e.target.value)} placeholder="esim. 192.168.1.1" />
            </label>
            <label>
              Syy (valinnainen)
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
            </label>
            <div className={styles.modalActions}>
              <button type="button" className={styles.ghostBtn} onClick={onClose}>Peruuta</button>
              <button
                type="button"
                className={styles.dangerBtn}
                onClick={() => {
                  const ip = ipAddress.trim();
                  if (!ip) return;
                  onBanIp(ip, reason || undefined);
                }}
              >
                <Ban size={14} /> Bannaa IP
              </button>
            </div>
          </>
        )}

        <button
          type="button"
          aria-label="Sulje"
          onClick={onClose}
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            background: "transparent",
            border: 0,
            cursor: "pointer",
            color: "#617186"
          }}
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
