"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  BadgeCheck,
  Ban,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  Car,
  ChevronDown,
  ClipboardList,
  Euro,
  Eye,
  ExternalLink,
  Home,
  LogOut,
  Mail,
  MessageCircle,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  Star,
  Trash2,
  Truck,
  UserCog,
  Users,
  X
} from "lucide-react";

import AppearancePanel from "./AppearancePanel";
import CategoriesPanel from "./CategoriesPanel";
import { sanitizePhoneInput } from "@/lib/phone-input";
import { listingPath, listingUrlId } from "@/lib/routes";

import {
  adminAdjustPhoneVerifications,
  adminBanIp,
  adminBanUser,
  adminDeleteListing,
  adminDeleteUser,
  adminDecideCompanyVerification,
  adminForceVerifyPhone,
  adminListBannedIps,
  adminListProfiles,
  adminActivityFeed,
  adminOverviewStats,
  adminPresencePage,
  adminPresenceSummary,
  adminSetCompanyVerified,
  adminUnbanIp,
  adminUnbanUser,
  adminUpdateProfile,
  authorizeAdminSensitiveAction,
  isSupabaseConfigured,
  supabase,
  type AdminActivityEvent,
  type AdminBannedIp,
  type AdminOverviewStats,
  type AdminPresenceSummary,
  type AdminPresenceUser,
  type AdminProfileRow,
  type SensitiveAdminAction
} from "@/lib/supabase";

import styles from "./admin.module.css";

type TabKey =
  | "overview"
  | "activity"
  | "users"
  | "company-verifications"
  | "listings"
  | "bans"
  | "appearance"
  | "categories";

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
type UserTypeFilter = "all" | "company" | "company_pending" | "private";

type Toast = { type: "ok" | "error"; message: string } | null;

type AdminMfaMode = "loading" | "enroll" | "enroll-verify" | "challenge" | "error";

type AdminMfaEnrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
};

const ADMIN_ACCOUNT_EMAIL = "matinpaja6@gmail.com";
const ADMIN_MFA_FRIENDLY_NAME = "Maskines Admin";

type AdminStepUpState = {
  action: SensitiveAdminAction;
  title: string;
};

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
      kind: "edit-profile";
      user: AdminProfileRow;
    }
  | {
      kind: "view-profile";
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

function getErrorMessage(error: unknown, fallback: string) {
  const value = error as { message?: string; hint?: string; details?: string } | null;
  return value?.message || value?.hint || value?.details || (error instanceof Error ? error.message : fallback);
}

function getAuthenticatorQrSource(value: string) {
  if (value.startsWith("data:")) return value;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(value)}`;
}

async function activateCurrentAdminSession() {
  if (!supabase) throw new Error("Supabase-yhteys puuttuu.");

  const { data, error } = await supabase.rpc("activate_admin_session");
  if (error || !data) {
    throw error ?? new Error("Admin-istunnon aktivointi epäonnistui.");
  }

  // Tietokanta estää vanhan istunnon admin-toiminnot heti. Lisäksi poistetaan
  // muiden istuntojen refresh tokenit Supabase Authista.
  await supabase.auth.signOut({ scope: "others" });
}

export default function AdminPage() {
  const [bootLoading, setBootLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [bootMessage, setBootMessage] = useState("Tarkistetaan admin-oikeudet...");
  const [adminSetupRequired, setAdminSetupRequired] = useState(false);
  const [mfaUnlocked, setMfaUnlocked] = useState(false);
  const [mfaMode, setMfaMode] = useState<AdminMfaMode>("loading");
  const [mfaFactorId, setMfaFactorId] = useState("");
  const [mfaEnrollment, setMfaEnrollment] = useState<AdminMfaEnrollment | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaChecking, setMfaChecking] = useState(false);
  const [mfaError, setMfaError] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminSearch, setAdminSearch] = useState("");

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [toast, setToast] = useState<Toast>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [stepUp, setStepUp] = useState<AdminStepUpState | null>(null);
  const stepUpResolver = useRef<((approvalToken: string | null) => void) | null>(null);

  const [stats, setStats] = useState<AdminOverviewStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [presence, setPresence] = useState<AdminPresenceSummary | null>(null);
  const [presenceLoading, setPresenceLoading] = useState(false);

  const [users, setUsers] = useState<AdminProfileRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userQuery, setUserQuery] = useState("");
  const [userQueryDebounced, setUserQueryDebounced] = useState("");
  const [userTypeFilter, setUserTypeFilter] = useState<UserTypeFilter>("all");
  const [companyDecisionBusy, setCompanyDecisionBusy] = useState<string | null>(null);

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

  const requestStepUp = useCallback((action: SensitiveAdminAction, title: string) => {
    setConfirm(null);
    setStepUp({ action, title });
    return new Promise<string | null>((resolve) => {
      stepUpResolver.current = resolve;
    });
  }, []);

  const finishStepUp = useCallback((approvalToken: string | null) => {
    stepUpResolver.current?.(approvalToken);
    stepUpResolver.current = null;
    setStepUp(null);
  }, []);

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

      if (authData.user.email?.trim().toLowerCase() !== ADMIN_ACCOUNT_EMAIL) {
        setBootMessage(`Tällä käyttäjällä ei ole admin-oikeutta: ${authData.user.email ?? "tuntematon käyttäjä"}`);
        setBootLoading(false);
        return;
      }

      const { data: adminData, error: adminError } = await supabase.rpc("has_admin_role");
      if (!alive) return;

      if (adminError) {
        setAdminSetupRequired(true);
        setBootMessage("Adminin Authenticator-päivitys puuttuu Supabasesta.");
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

      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();

      if (!alive) return;

      if (factorsError) {
        setMfaMode("error");
        setMfaError(getErrorMessage(factorsError, "Authenticator-tietojen lataaminen epäonnistui."));
        setBootLoading(false);
        return;
      }

      const verifiedTotp = factors?.totp?.find(
        (factor) => factor.friendly_name === ADMIN_MFA_FRIENDLY_NAME
      );
      if (!verifiedTotp) {
        setMfaMode("enroll");
        setBootLoading(false);
        return;
      }

      setMfaFactorId(verifiedTotp.id);
      // Admin-koodi pyydetään aina admin-paneeliin avattaessa. Tavallisen
      // käyttäjäprofiilin mahdollinen MFA ei avaa admin-paneelia automaattisesti.
      setMfaMode("challenge");

      setBootLoading(false);
    }

    void boot();

    const authSub = supabase?.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        setMfaUnlocked(false);
        setIsAdmin(false);
      }
    });

    return () => {
      alive = false;
      authSub?.data.subscription.unsubscribe();
    };
  }, []);

  async function beginMfaEnrollment() {
    if (!supabase) return;
    setMfaChecking(true);
    setMfaError("");

    try {
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;

      const verifiedTotp = factors?.totp?.find(
        (factor) => factor.friendly_name === ADMIN_MFA_FRIENDLY_NAME
      );
      if (verifiedTotp) {
        setMfaFactorId(verifiedTotp.id);
        setMfaMode("challenge");
        return;
      }

      const unfinishedTotp = (factors?.all ?? []).filter(
        (factor) =>
          factor.factor_type === "totp" &&
          factor.status === "unverified" &&
          factor.friendly_name === ADMIN_MFA_FRIENDLY_NAME
      );
      for (const factor of unfinishedTotp) {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: ADMIN_MFA_FRIENDLY_NAME
      });
      if (error) throw error;

      setMfaFactorId(data.id);
      setMfaEnrollment({
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret
      });
      setMfaMode("enroll-verify");
    } catch (error) {
      setMfaError(getErrorMessage(error, "Authenticatorin käyttöönotto epäonnistui."));
    } finally {
      setMfaChecking(false);
    }
  }

  async function submitMfaCode() {
    if (!supabase) return;
    if (!/^\d{6}$/.test(mfaCode)) {
      setMfaError("Anna Authenticator-sovelluksen kuusinumeroinen koodi.");
      return;
    }

    const factorId = mfaEnrollment?.factorId || mfaFactorId;
    if (!factorId) {
      setMfaError("Authenticator-laitetta ei löytynyt. Päivitä sivu ja yritä uudelleen.");
      return;
    }

    setMfaChecking(true);
    setMfaError("");

    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: mfaCode });
      if (error) throw error;

      await activateCurrentAdminSession();
      setMfaUnlocked(true);
      setMfaCode("");
      setMfaEnrollment(null);
    } catch (error) {
      setMfaError(getErrorMessage(error, "Authenticator-koodin tarkistus epäonnistui."));
    } finally {
      setMfaChecking(false);
    }
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

  const loadPresence = useCallback(async (silent = false) => {
    if (!isAdmin) return;
    if (!silent) setPresenceLoading(true);
    const { data, error } = await adminPresenceSummary();
    if (!silent) setPresenceLoading(false);
    if (error) {
      if (!silent) {
        showError(getErrorMessage(error, "Paikallaolotietojen lataus epäonnistui."));
      }
      return;
    }
    setPresence(data);
  }, [isAdmin, showError]);

  useEffect(() => {
    if (!isAdmin || !mfaUnlocked) return;
    void loadPresence();
    const interval = window.setInterval(() => {
      void loadPresence(true);
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [isAdmin, loadPresence, mfaUnlocked]);

  useEffect(() => {
    if (isAdmin && mfaUnlocked && activeTab === "overview") {
      void loadStats();
      // Yleiskatsauksen "Viimeisimmät tapahtumat" tarvitsee dataa myös
      // muista tauluista — esiladataan niitä jos tyhjiä.
      if (users.length === 0) void loadUsers();
      if (listings.length === 0) void loadListings();
    }
  }, [isAdmin, mfaUnlocked, activeTab, loadStats]);

  useEffect(() => {
    if (!isAdmin || !mfaUnlocked || activeTab !== "overview" || !supabase) return;
    const client = supabase;

    const interval = window.setInterval(() => {
      void loadStats();
    }, 5000);

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
      .on("postgres_changes", { event: "*", schema: "public", table: "site_visits" }, () => void loadStats())
      .on("postgres_changes", { event: "*", schema: "public", table: "user_activity" }, () => void loadStats())
      .subscribe();

    return () => {
      window.clearInterval(interval);
      void client.removeChannel(channel);
    };
  }, [activeTab, isAdmin, loadStats, mfaUnlocked]);

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
    if (isAdmin && mfaUnlocked && (activeTab === "users" || activeTab === "company-verifications")) void loadUsers();
  }, [isAdmin, mfaUnlocked, activeTab, loadUsers]);

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
    if (isAdmin && mfaUnlocked && activeTab === "listings") void loadListings();
  }, [isAdmin, mfaUnlocked, activeTab, loadListings]);

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
    if (isAdmin && mfaUnlocked && activeTab === "bans") void loadBans();
  }, [isAdmin, mfaUnlocked, activeTab, loadBans]);

  /* Action handlers */
  const handleDeleteListing = async (listing: AdminListing) => {
    const approvalToken = await requestStepUp("delete-listing", "Poista ilmoitus pysyvästi");
    if (!approvalToken) return;
    const { error } = await adminDeleteListing(listing.id, undefined, approvalToken);
    if (error) { showError(getErrorMessage(error, "Ilmoituksen poisto epäonnistui.")); return; }
    showOk("Ilmoitus poistettu.");
    setListings((prev) => prev.filter((l) => l.id !== listing.id));
    void loadStats();
    setConfirm(null);
  };

  const handleDeleteUser = async (user: AdminProfileRow) => {
    const approvalToken = await requestStepUp("delete-user", "Poista käyttäjä pysyvästi");
    if (!approvalToken) return;
    const { error } = await adminDeleteUser(user.id, approvalToken);
    if (error) { showError(getErrorMessage(error, "Käyttäjän poisto epäonnistui.")); return; }
    showOk("Käyttäjä poistettu.");
    setUsers((prev) => prev.filter((u) => u.id !== user.id));
    setConfirm(null);
  };

  const handleToggleBan = async (user: AdminProfileRow, reason?: string) => {
    let action;
    if (user.is_banned) {
      action = adminUnbanUser(user.id);
    } else {
      const approvalToken = await requestStepUp("ban-user", "Bannaa käyttäjä");
      if (!approvalToken) return;
      action = adminBanUser(user.id, reason, approvalToken);
    }
    const { error } = await action;
    if (error) { showError(getErrorMessage(error, "Bannaus epäonnistui.")); return; }
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

  const handleToggleCompanyVerified = async (user: AdminProfileRow) => {
    if (!user.company_verified_at) {
      if (user.company_verification_requested_at) {
        setActiveTab("company-verifications");
      } else {
        showError("Yrityksellä ei ole käsiteltävää vahvistuspyyntöä.");
      }
      return;
    }
    const nextVerified = !user.company_verified_at;
    const { data, error } = await adminSetCompanyVerified(user.id, nextVerified);
    if (error) {
      showError("Yrityksen vahvistus epäonnistui. Aja Supabasessa admin-company-verification-and-bans.sql.");
      return;
    }
    showOk(nextVerified ? "Yritys merkitty vahvistetuksi." : "Yrityksen vahvistus poistettu.");
    setUsers((prev) => prev.map((u) => (
      u.id === user.id
        ? {
            ...u,
            company_verified_at: nextVerified ? (data ?? new Date().toISOString()) : null,
            company_verification_requested_at: null
          }
        : u
    )));
  };

  const handleCompanyDecision = async (
    user: AdminProfileRow,
    decision: "approved" | "rejected",
    reason = ""
  ) => {
    setCompanyDecisionBusy(user.id);
    const { data, error } = await adminDecideCompanyVerification(user.id, decision, reason);
    setCompanyDecisionBusy(null);
    if (error || !data) {
      showError(getErrorMessage(error, "Yritysvahvistuksen käsittely epäonnistui."));
      return false;
    }

    setUsers((previous) => previous.map((item) => item.id === user.id ? {
      ...item,
      company_verified_at: data.companyVerifiedAt,
      company_verification_requested_at: null,
      company_verification_status: decision,
      company_verification_rejection_reason: decision === "rejected" ? reason || null : null,
      company_verification_decided_at: data.decidedAt
    } : item));
    void loadStats();

    if (data.emailSent) {
      showOk(decision === "approved"
        ? "Yritys hyväksyttiin ja vahvistusviesti lähetettiin."
        : "Yritys hylättiin ja päätösviesti lähetettiin.");
    } else {
      showError(`Päätös tallennettiin, mutta sähköposti ei lähtenyt: ${data.emailError || "tuntematon virhe"}`);
    }
    return true;
  };

  const handleBanIp = async (ip: string, reason?: string) => {
    const approvalToken = await requestStepUp("ban-ip", "Bannaa IP-osoite");
    if (!approvalToken) return;
    const { error } = await adminBanIp(ip, reason, approvalToken);
    if (error) { showError(getErrorMessage(error, "IP-bannaus epäonnistui.")); return; }
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
    { key: "activity", label: "Tapahtumat", icon: Activity },
    { key: "users", label: "Käyttäjät", icon: Truck },
    { key: "company-verifications", label: "Yritysvahvistukset", icon: Building2 },
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
    void loadPresence();
    void loadUsers();
    void loadListings();
  }

  return (
    <main className={`${styles.page} admin-page`}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarBrand}>
          <div className={styles.sidebarBrandIcon} aria-label="Maskines">
            <Image src="/maskines-brand-mark-dark-clean-v4.png" alt="Maskines" width={48} height={38} priority unoptimized />
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
                disabled={!isAdmin || !mfaUnlocked}
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
        {!bootLoading && isAdmin && mfaUnlocked && stats && (
          <div className={styles.dashboardHero}>
            <div>
              <h1>Tervetuloa takaisin, {adminName}! <span aria-hidden="true">👋</span></h1>
              <p>Tässä näet, mitä kauppapaikalla tapahtuu tänään.</p>
            </div>
          </div>
        )}

        {!bootLoading && isAdmin && mfaUnlocked && stats && (
          <div className={styles.summaryStrip}>
            <article className={`${styles.summaryCard} ${styles.onlineSummaryCard}`}>
              <div className={`${styles.summaryIcon} ${styles.iconGreen}`}><Radio size={22} /></div>
              <div className={styles.summaryBody}>
                <span>Paikalla nyt</span>
                <strong>{presenceLoading && !presence ? "…" : Number(presence?.onlineCount ?? 0).toLocaleString("fi-FI")}</strong>
                <small>{Number(presence?.totalRegistered ?? stats.profiles_total ?? 0).toLocaleString("fi-FI")} rekisteröitynyttä</small>
              </div>
            </article>
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
            {adminSetupRequired ? (
              <p>
                Aja Supabase SQL Editorissa tiedosto <code>supabase/admin-mfa.sql</code>
                ja päivitä tämä sivu. Admin-paneeli pysyy suljettuna siihen asti.
              </p>
            ) : (
              <>
                <p>
                  Aja Supabasessa <code>supabase/admin-roles.sql</code> ja <code>supabase/admin-extended.sql</code>,
                  ja lisää käyttäjä tällä komennolla:
                </p>
                <pre>{"select public.grant_admin_to_email('sinun@gmail.com');"}</pre>
              </>
            )}
          </div>
        )}

        {!bootLoading && isAdmin && !mfaUnlocked && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              minHeight: "60vh",
              padding: "20px 0"
            }}
          >
            <div className={styles.notice} style={{ display: "grid", gap: 14, maxWidth: 500, width: "100%", margin: "0 auto" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Smartphone size={25} aria-hidden="true" />
                <strong>
                  {mfaMode === "enroll" || mfaMode === "enroll-verify"
                    ? "Ota Authenticator käyttöön"
                    : "Vahvista admin-kirjautuminen"}
                </strong>
              </div>

              {mfaMode === "enroll" && (
                <>
                  <p>
                    Admin-PIN on korvattu käyttäjäkohtaisella vaihtuvalla koodilla.
                    Tarvitset puhelimeen esimerkiksi Google Authenticatorin tai Microsoft Authenticatorin.
                  </p>
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    onClick={() => void beginMfaEnrollment()}
                    disabled={mfaChecking}
                  >
                    {mfaChecking ? "Valmistellaan..." : "Yhdistä Authenticator"}
                  </button>
                </>
              )}

              {mfaMode === "enroll-verify" && mfaEnrollment && (
                <>
                  <p>Skannaa tämä QR-koodi puhelimen Authenticator-sovelluksella.</p>
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <Image
                      src={getAuthenticatorQrSource(mfaEnrollment.qrCode)}
                      alt="Maskines Admin Authenticator QR-koodi"
                      width={220}
                      height={220}
                      unoptimized
                      style={{ background: "white", borderRadius: 12, padding: 8 }}
                    />
                  </div>
                  <p style={{ margin: 0, fontSize: "0.85rem" }}>
                    Jos skannaus ei onnistu, syötä tämä avain käsin:<br />
                    <code style={{ wordBreak: "break-all", userSelect: "all" }}>{mfaEnrollment.secret}</code>
                  </p>
                </>
              )}

              {(mfaMode === "challenge" || mfaMode === "enroll-verify") && (
                <>
                  <p>
                    Avaa Authenticator puhelimessa ja anna uusi kuusinumeroinen koodi.
                    Koodi vaihtuu noin 30 sekunnin välein.
                  </p>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={mfaCode}
                    onChange={(event) => {
                      setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                      setMfaError("");
                    }}
                    onKeyDown={(event) => { if (event.key === "Enter") void submitMfaCode(); }}
                    aria-label="Authenticator-koodi"
                    className={styles.searchInput}
                    style={{ fontSize: "1.2rem", letterSpacing: "0.3em", textAlign: "center" }}
                    autoFocus
                  />
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    onClick={() => void submitMfaCode()}
                    disabled={mfaChecking || mfaCode.length !== 6}
                  >
                    {mfaChecking ? "Tarkistetaan..." : "Vahvista ja avaa admin"}
                  </button>
                </>
              )}

              {mfaMode === "error" && (
                <button type="button" className={styles.primaryBtn} onClick={() => window.location.reload()}>
                  Yritä uudelleen
                </button>
              )}

              {mfaError && (
                <span style={{ color: "#ef4444", fontWeight: 900, fontSize: "0.9rem" }}>
                  {mfaError}
                </span>
              )}
            </div>
          </div>
        )}

        {!bootLoading && isAdmin && mfaUnlocked && (
          <>
            {activeTab === "overview" && (
              <>
                <DashboardOverviewPanel
                  stats={stats}
                />
                <RecentEventsPanelV2
                  users={users}
                  listings={listings}
                  onViewAll={() => setActiveTab("users")}
                />
              </>
            )}

            {activeTab === "activity" && (
              <ActivityAndPresencePanel
                summary={presence}
                summaryLoading={presenceLoading}
                onRefreshSummary={() => void loadPresence()}
                onBanIp={(ip, contextUserName) => {
                  setConfirm({
                    kind: "ban-ip",
                    prefillIp: ip,
                    contextUserName
                  });
                }}
              />
            )}

            {activeTab === "users" && (
              <UsersPanel
                users={users}
                loading={usersLoading}
                query={userQuery}
                typeFilter={userTypeFilter}
                onQueryChange={setUserQuery}
                onTypeFilterChange={setUserTypeFilter}
                onRefresh={loadUsers}
                onAction={(action, user) => setConfirm({ kind: action, user } as ConfirmState)}
                onAdjustPhoneVer={handleAdjustPhoneVerifications}
                onToggleCompanyVerified={(user) => void handleToggleCompanyVerified(user)}
                onToggleBan={(user) => {
                  if (user.is_banned) {
                    void handleToggleBan(user);
                  } else {
                    setConfirm({ kind: "ban-user", user });
                  }
                }}
                onBanUserIp={(user) => {
                  const ip = user.last_ip || user.last_seen_ip;
                  if (!ip) {
                    showError("Käyttäjältä ei löydy tallennettua IP:tä vielä.");
                    return;
                  }
                  setConfirm({
                    kind: "ban-ip",
                    prefillIp: ip,
                    contextUserName: user.full_name || user.email || user.id.slice(0, 8)
                  });
                }}
              />
            )}

            {activeTab === "company-verifications" && (
              <CompanyVerificationsPanel
                users={users}
                loading={usersLoading}
                busyUserId={companyDecisionBusy}
                onRefresh={loadUsers}
                onDecision={handleCompanyDecision}
                onView={(user) => setConfirm({ kind: "view-profile", user })}
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
          onUpdateProfile={handleUpdateProfile}
          onBanIp={handleBanIp}
        />
      )}

      {stepUp && (
        <AdminStepUpDialog
          state={stepUp}
          factorId={mfaFactorId}
          onCancel={() => finishStepUp(null)}
          onApproved={(approvalToken) => finishStepUp(approvalToken)}
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

function formatAdminDateTime(value?: string | null) {
  if (!value) return "Ei koskaan";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Ei koskaan";
  return new Intl.DateTimeFormat("fi-FI", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}

function activityIcon(event: AdminActivityEvent) {
  if (event.kind === "account") return <Users size={18} />;
  if (event.kind === "listing") return <ClipboardList size={18} />;
  if (event.kind === "sale") return <BadgeCheck size={18} />;
  if (event.kind === "conversation" || event.kind === "message") {
    return <MessageCircle size={18} />;
  }
  if (event.kind === "review") return <Star size={18} />;
  if (event.kind === "search-alert") return <Bell size={18} />;
  if (event.kind === "visit") return <Eye size={18} />;
  return <ShieldCheck size={18} />;
}

function ActivityAndPresencePanel({
  summary,
  summaryLoading,
  onRefreshSummary,
  onBanIp
}: {
  summary: AdminPresenceSummary | null;
  summaryLoading: boolean;
  onRefreshSummary: () => void;
  onBanIp: (ip: string, contextUserName: string) => void;
}) {
  const [events, setEvents] = useState<AdminActivityEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState("");
  const [eventsPartial, setEventsPartial] = useState(false);
  const [eventsHasMore, setEventsHasMore] = useState(true);
  const [presenceUsers, setPresenceUsers] = useState<AdminPresenceUser[]>([]);
  const [presenceUsersLoading, setPresenceUsersLoading] = useState(false);
  const [presenceUsersError, setPresenceUsersError] = useState("");
  const [presenceUsersHasMore, setPresenceUsersHasMore] = useState(true);
  const eventsCursorRef = useRef<string | null>(null);
  const eventsLoadingRef = useRef(false);
  const eventsHasMoreRef = useRef(true);
  const presenceOffsetRef = useRef(0);
  const presenceLoadingRef = useRef(false);
  const presenceHasMoreRef = useRef(true);
  const eventsScrollRef = useRef<HTMLDivElement>(null);
  const presenceScrollRef = useRef<HTMLDivElement>(null);
  const eventsSentinelRef = useRef<HTMLDivElement>(null);
  const presenceSentinelRef = useRef<HTMLDivElement>(null);

  const loadEvents = useCallback(async (reset = false) => {
    if (eventsLoadingRef.current) return;
    if (!reset && !eventsHasMoreRef.current) return;

    eventsLoadingRef.current = true;
    setEventsLoading(true);
    setEventsError("");

    const { data, error } = await adminActivityFeed({
      cursor: reset ? null : eventsCursorRef.current,
      limit: 40
    });

    eventsLoadingRef.current = false;
    setEventsLoading(false);

    if (error || !data) {
      setEventsError(getErrorMessage(error, "Tapahtumalokin lataus epäonnistui."));
      return;
    }

    eventsCursorRef.current = data.nextCursor;
    eventsHasMoreRef.current = data.hasMore;
    setEventsHasMore(data.hasMore);
    setEventsPartial(data.partial);
    setEvents((current) => {
      const combined = reset ? data.events : [...current, ...data.events];
      return Array.from(
        new Map(combined.map((event) => [event.id, event])).values()
      );
    });
  }, []);

  const loadPresenceUsers = useCallback(async (reset = false) => {
    if (presenceLoadingRef.current) return;
    if (!reset && !presenceHasMoreRef.current) return;

    presenceLoadingRef.current = true;
    setPresenceUsersLoading(true);
    setPresenceUsersError("");

    const { data, error } = await adminPresencePage({
      offset: reset ? 0 : presenceOffsetRef.current,
      limit: 60
    });

    presenceLoadingRef.current = false;
    setPresenceUsersLoading(false);

    if (error || !data) {
      setPresenceUsersError(
        getErrorMessage(error, "Käyttäjien paikallaolotietojen lataus epäonnistui.")
      );
      return;
    }

    presenceOffsetRef.current = data.nextOffset ?? presenceOffsetRef.current;
    presenceHasMoreRef.current = data.hasMore;
    setPresenceUsersHasMore(data.hasMore);
    setPresenceUsers((current) => {
      const combined = reset ? data.users : [...current, ...data.users];
      return Array.from(
        new Map(combined.map((user) => [user.id, user])).values()
      );
    });
  }, []);

  const refreshAll = useCallback(() => {
    eventsCursorRef.current = null;
    eventsHasMoreRef.current = true;
    presenceOffsetRef.current = 0;
    presenceHasMoreRef.current = true;
    setEventsHasMore(true);
    setPresenceUsersHasMore(true);
    void loadEvents(true);
    void loadPresenceUsers(true);
    onRefreshSummary();
  }, [loadEvents, loadPresenceUsers, onRefreshSummary]);

  useEffect(() => {
    void loadEvents(true);
    void loadPresenceUsers(true);
  }, [loadEvents, loadPresenceUsers]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if ((eventsScrollRef.current?.scrollTop ?? 0) < 80) {
        eventsCursorRef.current = null;
        eventsHasMoreRef.current = true;
        void loadEvents(true);
      }
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [loadEvents]);

  useEffect(() => {
    const sentinel = eventsSentinelRef.current;
    const root = eventsScrollRef.current;
    if (!sentinel || !root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadEvents();
      },
      { root, rootMargin: "180px 0px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadEvents]);

  useEffect(() => {
    const sentinel = presenceSentinelRef.current;
    const root = presenceScrollRef.current;
    if (!sentinel || !root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadPresenceUsers();
      },
      { root, rootMargin: "180px 0px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadPresenceUsers]);

  return (
    <section className={`${styles.panel} ${styles.activityPanel}`}>
      <div className={styles.activityPanelHeader}>
        <div>
          <span>Reaaliaikainen seuranta</span>
          <h2>Tapahtumaloki ja paikallaolo</h2>
          <p>
            Uusimmat tapahtumat ovat ylhäällä. Lisää historiaa latautuu automaattisesti,
            kun vierität alaspäin.
          </p>
        </div>
        <button
          type="button"
          className={styles.fullReportButton}
          onClick={refreshAll}
          disabled={eventsLoading || presenceUsersLoading || summaryLoading}
        >
          <RefreshCw size={16} />
          Päivitä
        </button>
      </div>

      <div className={styles.activityMetricGrid}>
        <article className={styles.activityMetric}>
          <span className={styles.liveDot} aria-hidden="true" />
          <div>
            <small>Paikalla nyt</small>
            <strong>{summaryLoading && !summary ? "…" : summary?.onlineCount ?? 0}</strong>
          </div>
        </article>
        <article className={styles.activityMetric}>
          <Users size={20} />
          <div>
            <small>Rekisteröityneet</small>
            <strong>{summary?.totalRegistered ?? presenceUsers.length}</strong>
          </div>
        </article>
        <article className={styles.activityMetric}>
          <Activity size={20} />
          <div>
            <small>Lokitapahtumia ladattu</small>
            <strong>{events.length}</strong>
          </div>
        </article>
        <article className={styles.activityMetric}>
          <Radio size={20} />
          <div>
            <small>Tilanne päivitetty</small>
            <strong className={styles.activityMetricTime}>
              {summary?.updatedAt ? formatAdminDateTime(summary.updatedAt) : "—"}
            </strong>
          </div>
        </article>
      </div>

      <div className={styles.activityWorkspace}>
        <article className={styles.activityFeedCard}>
          <div className={styles.activityColumnHeader}>
            <div>
              <span className={styles.liveDot} aria-hidden="true" />
              <h3>Tapahtumat</h3>
            </div>
            <small>Viestien sisältöjä ei näytetä · IP:t vain adminille</small>
          </div>
          <div
            ref={eventsScrollRef}
            className={styles.activityScroll}
            aria-live="polite"
            aria-label="Adminin tapahtumaloki"
          >
            {events.map((event) => (
              <div key={event.id} className={`${styles.activityBubble} ${styles[`activity_${event.kind}`]}`}>
                <div className={styles.activityBubbleIcon}>{activityIcon(event)}</div>
                <div className={styles.activityBubbleBody}>
                  <div>
                    <strong>{event.title}</strong>
                    <time dateTime={event.occurred_at}>{formatAdminDateTime(event.occurred_at)}</time>
                  </div>
                  <p>{event.detail || "Ei lisätietoja"}</p>
                  {event.actor_name && (
                    <small>
                      Tekijä: {event.actor_name}
                      {event.actor_id ? ` · ${event.actor_id.slice(0, 8)}` : ""}
                    </small>
                  )}
                  {event.ip && (
                    <div className={styles.activityIpRow}>
                      <span>
                        <code>{event.ip}</code>
                        <small>
                          {event.ip_source === "event"
                            ? "Tapahtuman IP"
                            : "Käyttäjän viimeisin IP"}
                        </small>
                      </span>
                      <button
                        type="button"
                        onClick={() => onBanIp(
                          event.ip!,
                          event.actor_name || event.title
                        )}
                      >
                        <Ban size={14} />
                        Bannaa IP
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {!events.length && !eventsLoading && !eventsError && (
              <div className={styles.activityEmpty}>Tapahtumia ei löytynyt.</div>
            )}
            {eventsError && <div className={styles.activityError}>{eventsError}</div>}
            {eventsPartial && (
              <div className={styles.activityWarning}>
                Osa vanhoista tapahtumalähteistä ei ole käytössä tässä ympäristössä.
              </div>
            )}
            <div ref={eventsSentinelRef} className={styles.activitySentinel}>
              {eventsLoading
                ? "Ladataan tapahtumia…"
                : eventsHasMore
                  ? "Vieritä alemmas ladataksesi lisää"
                  : "Kaikki tapahtumat on ladattu"}
            </div>
          </div>
        </article>

        <article className={styles.presenceCard}>
          <div className={styles.activityColumnHeader}>
            <div>
              <Radio size={18} />
              <h3>Rekisteröityneet</h3>
            </div>
            <small>Viimeksi paikalla</small>
          </div>
          <div
            ref={presenceScrollRef}
            className={styles.presenceScroll}
            aria-label="Rekisteröityneiden käyttäjien paikallaolotiedot"
          >
            {presenceUsers.map((user) => (
              <div key={user.id} className={styles.presenceRow}>
                <span
                  className={`${styles.presenceDot} ${user.online ? styles.presenceDotOnline : ""}`}
                  aria-label={user.online ? "Paikalla" : "Poissa"}
                />
                <div>
                  <strong>{user.displayName}</strong>
                  <small>{user.email || user.id.slice(0, 8)}</small>
                </div>
                <div className={styles.presenceTime}>
                  <strong>{user.online ? "Paikalla nyt" : relativeTime(user.lastSeen) || "Ei koskaan"}</strong>
                  <small>{formatAdminDateTime(user.lastSeen)}</small>
                </div>
              </div>
            ))}

            {!presenceUsers.length && !presenceUsersLoading && !presenceUsersError && (
              <div className={styles.activityEmpty}>Rekisteröityneitä ei löytynyt.</div>
            )}
            {presenceUsersError && (
              <div className={styles.activityError}>{presenceUsersError}</div>
            )}
            <div ref={presenceSentinelRef} className={styles.activitySentinel}>
              {presenceUsersLoading
                ? "Ladataan käyttäjiä…"
                : presenceUsersHasMore
                  ? "Vieritä alemmas ladataksesi lisää"
                  : "Kaikki rekisteröityneet on ladattu"}
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}

function AdminStepUpDialog({
  state,
  factorId,
  onCancel,
  onApproved
}: {
  state: AdminStepUpState;
  factorId: string;
  onCancel: () => void;
  onApproved: (approvalToken: string) => void;
}) {
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  async function verify() {
    if (!supabase || !factorId || !/^\d{6}$/.test(code)) {
      setError("Anna Authenticator-sovelluksen kuusinumeroinen koodi.");
      return;
    }

    setChecking(true);
    setError("");
    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code
      });
      if (verifyError) throw verifyError;

      const { data: approvalToken, error: approvalError } =
        await authorizeAdminSensitiveAction(state.action);
      if (approvalError || !approvalToken) {
        throw approvalError ?? new Error("Kertakäyttöisen hyväksynnän luominen epäonnistui.");
      }

      onApproved(approvalToken);
    } catch (stepUpError) {
      setError(getErrorMessage(stepUpError, "Authenticator-koodin tarkistus epäonnistui."));
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className={styles.modalBackdrop} onClick={onCancel}>
      <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Smartphone size={24} aria-hidden="true" />
            <h3 style={{ margin: 0 }}>Vahvista vaarallinen toiminto</h3>
          </div>
          <p style={{ margin: 0 }}>
            <strong>{state.title}</strong> vaatii uuden Authenticator-koodin.
            Hyväksyntä toimii vain tähän yhteen toimintoon ja vanhenee kahdessa minuutissa.
          </p>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(event) => {
              setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
              setError("");
            }}
            onKeyDown={(event) => { if (event.key === "Enter") void verify(); }}
            aria-label="Uusi Authenticator-koodi"
            className={styles.searchInput}
            style={{ fontSize: "1.2rem", letterSpacing: "0.3em", textAlign: "center" }}
            autoFocus
          />
          {error && (
            <span style={{ color: "#ef4444", fontWeight: 900, fontSize: "0.9rem" }}>
              {error}
            </span>
          )}
          <div className={styles.modalActions}>
            <button type="button" className={styles.ghostBtn} onClick={onCancel} disabled={checking}>
              Peruuta
            </button>
            <button
              type="button"
              className={styles.dangerBtn}
              onClick={() => void verify()}
              disabled={checking || code.length !== 6}
            >
              {checking ? "Tarkistetaan..." : "Vahvista toiminto"}
            </button>
          </div>
        </div>
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

function DashboardOverviewPanel({ stats }: {
  stats: AdminOverviewStats | null;
}) {
  const cards = [
    {
      label: "Käyttäjät",
      value: stats?.profiles_total ?? 0,
      today: stats?.profiles_today ?? 0,
      week: stats?.profiles_7d ?? 0,
      month: stats?.profiles_month ?? 0,
      previous: stats?.profiles_prev_month ?? 0,
      accent: "accentBlue",
      series: [0, stats?.profiles_today ?? 0, stats?.profiles_7d ?? 0, stats?.profiles_month ?? 0, stats?.profiles_total ?? 0]
    },
    {
      label: "Ilmoitukset",
      value: stats?.listings_total ?? 0,
      today: stats?.listings_today ?? 0,
      week: stats?.listings_7d ?? 0,
      month: stats?.listings_month ?? 0,
      previous: stats?.listings_prev_month ?? 0,
      accent: "accentBlue",
      series: [stats?.listings_today ?? 0, stats?.listings_7d ?? 0, stats?.listings_month ?? 0, stats?.listings_total ?? 0, stats?.listings_7d ?? 0]
    },
    {
      label: "Myydyt",
      value: stats?.sold_total ?? 0,
      today: stats?.sold_today ?? 0,
      week: stats?.sold_7d ?? 0,
      month: stats?.sold_month ?? 0,
      previous: stats?.sold_prev_month ?? 0,
      accent: "accentGreen",
      series: [0, stats?.sold_today ?? 0, stats?.sold_7d ?? 0, stats?.sold_month ?? 0, stats?.sold_total ?? 0]
    },
    {
      label: "Liikevaihto",
      value: stats?.revenue_total ?? 0,
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
      value: stats?.visits_total ?? 0,
      today: stats?.visits_today ?? 0,
      week: stats?.visits_7d ?? 0,
      month: stats?.visits_month ?? 0,
      previous: Math.max(0, (stats?.visits_month ?? 0) - (stats?.visits_7d ?? 0)),
      accent: "accentPurple",
      series: [stats?.visits_today ?? 0, stats?.visits_7d ?? 0, stats?.visits_month ?? 0, stats?.visits_total ?? 0, stats?.visits_7d ?? 0]
    },
    {
      label: "Uniikit kävijät",
      value: stats?.unique_visitors_total ?? 0,
      today: stats?.unique_visitors_today ?? 0,
      week: stats?.unique_visitors_7d ?? 0,
      month: stats?.unique_visitors_month ?? 0,
      previous: Math.max(0, (stats?.unique_visitors_month ?? 0) - (stats?.unique_visitors_7d ?? 0)),
      accent: "accentPurple",
      series: [stats?.unique_visitors_today ?? 0, stats?.unique_visitors_7d ?? 0, stats?.unique_visitors_month ?? 0, stats?.unique_visitors_total ?? 0, stats?.unique_visitors_7d ?? 0]
    },
    {
      label: "Poistetut",
      value: stats?.deleted_total ?? 0,
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
                  <small>All</small>
                  <strong>{formatNumber(card.value, card.suffix)}</strong>
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
   COMPANY VERIFICATIONS PANEL
================================================================= */

function CompanyVerificationsPanel({
  users,
  loading,
  busyUserId,
  onRefresh,
  onDecision,
  onView
}: {
  users: AdminProfileRow[];
  loading: boolean;
  busyUserId: string | null;
  onRefresh: () => void;
  onDecision: (user: AdminProfileRow, decision: "approved" | "rejected", reason?: string) => Promise<boolean>;
  onView: (user: AdminProfileRow) => void;
}) {
  const [rejectingUserId, setRejectingUserId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const companies = users.filter((user) => user.account_type === "company");
  const pending = companies.filter((user) => user.company_verification_requested_at && !user.company_verified_at);
  const approvedCount = companies.filter((user) => user.company_verified_at).length;
  const rejectedCount = companies.filter((user) => user.company_verification_status === "rejected").length;
  const recentDecisions = companies
    .filter((user) => user.company_verified_at || user.company_verification_status === "rejected")
    .sort((left, right) => Date.parse(right.company_verification_decided_at || right.company_verified_at || "") - Date.parse(left.company_verification_decided_at || left.company_verified_at || ""))
    .slice(0, 8);

  async function reject(user: AdminProfileRow) {
    const succeeded = await onDecision(user, "rejected", rejectionReason.trim());
    if (succeeded) {
      setRejectingUserId(null);
      setRejectionReason("");
    }
  }

  return (
    <section className={`${styles.panel} ${styles.companyVerificationPanel}`}>
      <div className={styles.panelHeader}>
        <div>
          <span>Luottamus ja turvallisuus</span>
          <h2>Yritysvahvistukset</h2>
        </div>
        <p>Tarkista maksetut vahvistuspyynnöt. Päätösviesti lähtee automaattisesti käyttäjän omalla kielellä.</p>
      </div>

      <div className={styles.companyVerificationSummary}>
        <div><span>Odottaa käsittelyä</span><strong>{pending.length}</strong></div>
        <div><span>Hyväksytty</span><strong>{approvedCount}</strong></div>
        <div><span>Hylätty</span><strong>{rejectedCount}</strong></div>
        <button type="button" className={styles.ghostBtn} onClick={onRefresh} disabled={loading}>
          <RefreshCw size={15} /> {loading ? "Päivitetään…" : "Päivitä jono"}
        </button>
      </div>

      {pending.length === 0 && !loading ? (
        <div className={styles.companyVerificationEmpty}>
          <BadgeCheck size={30} />
          <strong>Kaikki pyynnöt on käsitelty</strong>
          <span>Uudet maksetut vahvistuspyynnöt ilmestyvät automaattisesti tähän jonoon.</span>
        </div>
      ) : (
        <div className={styles.companyVerificationGrid}>
          {pending.map((user) => {
            const isBusy = busyUserId === user.id;
            const isRejecting = rejectingUserId === user.id;
            const companyName = user.company_name || user.full_name || "Nimetön yritys";
            return (
              <article className={styles.companyVerificationCard} key={user.id}>
                <div className={styles.companyVerificationCardHead}>
                  <div className={styles.companyVerificationIcon}><Building2 size={22} /></div>
                  <div>
                    <span>MAKSETTU · ODOTTAA TARKISTUSTA</span>
                    <h3>{companyName}</h3>
                    <p>{user.business_id || "Y-tunnus puuttuu"}</p>
                  </div>
                  <span className={styles.companyVerificationAge}>{formatDate(user.company_verification_requested_at)}</span>
                </div>

                <div className={styles.companyVerificationDetails}>
                  <div><span>Sähköposti</span><strong>{user.email || "—"}</strong></div>
                  <div><span>Kieli</span><strong>{(user.preferred_locale || "automaattinen").toUpperCase()}</strong></div>
                  <div><span>Maa</span><strong>{user.country || "—"}</strong></div>
                  <div><span>Puhelin</span><strong>{user.phone || "—"}</strong></div>
                  {user.company_website && <div className={styles.companyVerificationWide}><span>Verkkosivu</span><strong>{user.company_website}</strong></div>}
                  {(user.address || user.city) && <div className={styles.companyVerificationWide}><span>Osoite</span><strong>{[user.address, user.postal_code, user.city].filter(Boolean).join(", ")}</strong></div>}
                </div>

                {isRejecting && (
                  <div className={styles.companyRejectionBox}>
                    <label htmlFor={`rejection-${user.id}`}>Hylkäyksen perustelu sähköpostiin</label>
                    <textarea
                      id={`rejection-${user.id}`}
                      value={rejectionReason}
                      onChange={(event) => setRejectionReason(event.target.value.slice(0, 600))}
                      placeholder="Esimerkiksi: Y-tunnus ei vastaa ilmoitettua yrityksen nimeä."
                      rows={3}
                      autoFocus
                    />
                    <small>{rejectionReason.length}/600 merkkiä · perustelu on vapaaehtoinen</small>
                  </div>
                )}

                <div className={styles.companyVerificationActions}>
                  <button type="button" className={styles.ghostBtn} onClick={() => onView(user)} disabled={isBusy}>
                    <Eye size={15} /> Tarkat tiedot
                  </button>
                  {isRejecting ? (
                    <>
                      <button type="button" className={styles.ghostBtn} onClick={() => { setRejectingUserId(null); setRejectionReason(""); }} disabled={isBusy}>Peruuta</button>
                      <button type="button" className={styles.companyRejectBtn} onClick={() => void reject(user)} disabled={isBusy}>
                        <X size={16} /> {isBusy ? "Käsitellään…" : "Vahvista hylkäys"}
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" className={styles.companyRejectBtn} onClick={() => { setRejectingUserId(user.id); setRejectionReason(""); }} disabled={isBusy}>
                        <X size={16} /> Hylkää
                      </button>
                      <button type="button" className={styles.companyApproveBtn} onClick={() => void onDecision(user, "approved")} disabled={isBusy}>
                        <BadgeCheck size={17} /> {isBusy ? "Käsitellään…" : "Hyväksy yritys"}
                      </button>
                    </>
                  )}
                </div>
                <div className={styles.companyVerificationMailNote}><Mail size={14} /> Päätöksen jälkeen sähköposti lähetetään automaattisesti.</div>
              </article>
            );
          })}
        </div>
      )}

      {recentDecisions.length > 0 && (
        <div className={styles.companyDecisionHistory}>
          <div className={styles.companyDecisionHistoryTitle}>
            <div><span>Viimeisimmät päätökset</span><strong>Hyväksynnät ja hylkäykset</strong></div>
          </div>
          {recentDecisions.map((user) => {
            const rejected = user.company_verification_status === "rejected";
            return (
              <button type="button" key={user.id} onClick={() => onView(user)}>
                <span className={rejected ? styles.companyDecisionRejected : styles.companyDecisionApproved}>
                  {rejected ? <X size={14} /> : <BadgeCheck size={14} />}
                  {rejected ? "Hylätty" : "Hyväksytty"}
                </span>
                <strong>{user.company_name || user.full_name || user.email}</strong>
                <small>{user.business_id || "Ei Y-tunnusta"}</small>
                <time>{formatDate(user.company_verification_decided_at || user.company_verified_at)}</time>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* =================================================================
   USERS PANEL
================================================================= */

type UserActionKind = "delete-user" | "ban-user" | "verify-phone" | "edit-profile" | "view-profile";

function UsersPanel({
  users,
  loading,
  query,
  typeFilter,
  onQueryChange,
  onTypeFilterChange,
  onRefresh,
  onAction,
  onAdjustPhoneVer,
  onToggleCompanyVerified,
  onToggleBan,
  onBanUserIp
}: {
  users: AdminProfileRow[];
  loading: boolean;
  query: string;
  typeFilter: UserTypeFilter;
  onQueryChange: (q: string) => void;
  onTypeFilterChange: (filter: UserTypeFilter) => void;
  onRefresh: () => void;
  onAction: (kind: UserActionKind, user: AdminProfileRow) => void;
  onAdjustPhoneVer: (user: AdminProfileRow, delta: number) => void;
  onToggleCompanyVerified: (user: AdminProfileRow) => void;
  onToggleBan: (user: AdminProfileRow) => void;
  onBanUserIp: (user: AdminProfileRow) => void;
}) {
  const filteredUsers = useMemo(() => {
    if (typeFilter === "company") return users.filter((user) => user.account_type === "company");
    if (typeFilter === "company_pending") {
      return users.filter((user) =>
        user.account_type === "company" &&
        Boolean(user.company_verification_requested_at) &&
        !user.company_verified_at
      );
    }
    if (typeFilter === "private") return users.filter((user) => user.account_type !== "company");
    return users;
  }, [typeFilter, users]);
  const pendingCompanyCount =
    users.filter((u) =>
      u.account_type === "company" &&
      Boolean(u.company_verification_requested_at) &&
      !u.company_verified_at
    ).length;

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
          {loading ? "..." : "Päivitä"}
        </button>
      </div>

      <div className={styles.listingStatusTabs} style={{ marginBottom: 14 }}>
        {[
          { key: "all", label: `Kaikki (${users.length})` },
          { key: "company", label: `Yritykset (${users.filter((u) => u.account_type === "company").length})` },
          { key: "company_pending", label: `Odottaa vahvistusta (${pendingCompanyCount})` },
          { key: "private", label: `Yksityiset (${users.filter((u) => u.account_type !== "company").length})` }
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            className={`${styles.listingStatusTab} ${typeFilter === item.key ? styles.listingStatusTabActive : ""}`}
            onClick={() => onTypeFilterChange(item.key as UserTypeFilter)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {filteredUsers.length === 0 && !loading ? (
        <div className={styles.empty}>Ei käyttäjiä.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className={styles.userTable}>
            <thead>
              <tr>
                <th>Nimi</th>
                <th>Sähköposti</th>
                <th>Vahvistukset</th>
                <th>Tila</th>
                <th>Viimeksi paikalla</th>
                <th>Liittynyt</th>
                <th style={{ textAlign: "right" }}>Toiminnot</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <UserTableRow
                  key={u.id}
                  user={u}
                  onAction={onAction}
                  onAdjustPhoneVer={onAdjustPhoneVer}
                  onToggleCompanyVerified={onToggleCompanyVerified}
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
  onToggleCompanyVerified,
  onToggleBan,
  onBanUserIp
}: {
  user: AdminProfileRow;
  onAction: (kind: UserActionKind, user: AdminProfileRow) => void;
  onAdjustPhoneVer: (user: AdminProfileRow, delta: number) => void;
  onToggleCompanyVerified: (user: AdminProfileRow) => void;
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
  const displayName =
    u.full_name || [u.first_name, u.last_name].filter(Boolean).join(" ") || "Tuntematon";
  const ip = u.last_ip || u.last_seen_ip;
  const lastSeenTimestamp = Date.parse(u.last_seen ?? "");
  const userIsOnline =
    Boolean(u.online) &&
    Number.isFinite(lastSeenTimestamp) &&
    lastSeenTimestamp >= Date.now() - 65_000 &&
    lastSeenTimestamp <= Date.now() + 10_000;

  return (
    <tr>
      <td className={styles.cellName}>
        <strong title={displayName}>{displayName}</strong>
        <small>{u.account_type === "company" ? "Yritys" : "Yksityinen"}{u.business_id ? ` · ${u.business_id}` : ""}</small>
        {u.company_verified_at && (
          <span className={styles.companyVerifiedText}>Vahvistettu yritys</span>
        )}
        {u.account_type === "company" && u.company_verification_requested_at && !u.company_verified_at && (
          <span className={styles.companyPendingText}>Odottaa vahvistusta</span>
        )}
        {u.is_admin && <span className={styles.adminInlineText}>ADMIN</span>}
      </td>
      <td className={styles.contactCell}>
        <div title={u.email || undefined}>{u.email || "—"}</div>
        <small>
          {u.phone || "ei puhelinta"}
        </small>
        <small className={styles.ipLine} title={ip || undefined}>
          IP: {ip || "ei tallennettua IP:tä"}
          {u.ip_count ? ` · ${u.ip_count} osumaa` : ""}
        </small>
      </td>
      <td>
        <span className={`${styles.verifyText} ${styles[verifyClass]}`}>
          {verifyCount}/{verifyMax}
        </span>
      </td>
      <td>
        {u.is_banned ? (
          <span className={`${styles.statusPill} ${styles.statusBanned}`}>Bannattu</span>
        ) : !phoneVerified ? (
          <span className={`${styles.statusPill} ${styles.statusPending}`}>Odottaa</span>
        ) : (
          <span className={`${styles.statusPill} ${styles.statusActive}`}>Aktiivinen</span>
        )}
      </td>
      <td className={styles.userPresenceCell}>
        <span className={`${styles.presenceDot} ${userIsOnline ? styles.presenceDotOnline : ""}`} aria-hidden="true" />
        <span>
          <strong>{userIsOnline ? "Paikalla nyt" : relativeTime(u.last_seen) || "Ei koskaan"}</strong>
          <small>{formatAdminDateTime(u.last_seen)}</small>
        </span>
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
              onClick={() => { setMenuOpen(false); onAction("view-profile", u); }}
            >
              <Eye size={14} /> Tarkat tiedot
            </button>
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
            {u.account_type === "company" && (
              <button
                type="button"
                className={styles.actionMenuItem}
                onClick={() => { setMenuOpen(false); onToggleCompanyVerified(u); }}
                disabled={!u.company_verified_at && !u.company_verification_requested_at}
              >
                <ShieldCheck size={14} /> {u.company_verified_at
                  ? "Poista yritysvahvistus"
                  : u.company_verification_requested_at
                    ? "Käsittele vahvistus"
                    : "Ei vahvistuspyyntöä"}
              </button>
            )}
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
          {loading ? "..." : "Näytä kaikki ilmoitukset"}
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
          {loading ? "..." : "Päivitä"}
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
          {loading ? "..." : "Päivitä"}
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
                <Link href={listingPath(listing)} target="_blank" rel="noreferrer">
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
            {loading || usersLoading ? "..." : "Päivitä"}
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
  onUpdateProfile,
  onBanIp
}: {
  state: ConfirmState;
  onClose: () => void;
  onDeleteListing: (listing: AdminListing) => void;
  onDeleteUser: (user: AdminProfileRow) => void;
  onBanUser: (user: AdminProfileRow, reason?: string) => void;
  onVerifyPhone: (user: AdminProfileRow, newPhone?: string) => void;
  onUpdateProfile: (user: AdminProfileRow, updates: Record<string, string>) => void;
  onBanIp: (ip: string, reason?: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [phone, setPhone] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [editFirst, setEditFirst] = useState("");
  const [editLast, setEditLast] = useState("");
  const [editFull, setEditFull] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editCountry, setEditCountry] = useState("");
  const [editBusinessId, setEditBusinessId] = useState("");
  const [editCompanyName, setEditCompanyName] = useState("");

  /* Reset fields whenever the dialog changes */
  useEffect(() => {
    setReason("");
    setPhone("");
    setIpAddress(state && state.kind === "ban-ip" ? (state.prefillIp ?? "") : "");
    if (state && "user" in state && state.kind === "edit-profile") {
      setEditFirst(state.user.first_name ?? "");
      setEditLast(state.user.last_name ?? "");
      setEditFull(state.user.full_name ?? "");
      setEditCity("");
      setEditCountry("");
      setEditBusinessId(state.user.business_id ?? "");
      setEditCompanyName(state.user.company_name ?? "");
    }
    if (state && "user" in state && state.kind === "verify-phone") {
      setPhone(state.user.phone ?? "");
    }
  }, [state]);

  if (!state) return null;

  const profileDetailRows =
    state && "user" in state
      ? [
          ["ID", state.user.id],
          ["Julkinen ID", state.user.public_id],
          ["Sähköposti", state.user.email],
          ["Puhelin", state.user.phone],
          ["Nimi", state.user.full_name],
          ["Etunimi", state.user.first_name],
          ["Sukunimi", state.user.last_name],
          ["Tilityyppi", state.user.account_type === "company" ? "Yritys" : "Yksityinen"],
          ["Yritys", state.user.company_name],
          ["Y-tunnus", state.user.business_id],
          ["Yrityksen sivu", state.user.company_website],
          ["Vahvistuspyyntö", state.user.company_verification_requested_at ? formatDate(state.user.company_verification_requested_at) : null],
          ["Yritys vahvistettu", state.user.company_verified_at ? formatDate(state.user.company_verified_at) : null],
          ["Vahvistuspäätös", state.user.company_verification_status],
          ["Päätöspäivä", state.user.company_verification_decided_at ? formatDate(state.user.company_verification_decided_at) : null],
          ["Hylkäyksen syy", state.user.company_verification_rejection_reason],
          ["Laskutussähköposti", state.user.billing_email],
          ["Osoite", state.user.address],
          ["Postinumero", state.user.postal_code],
          ["Kaupunki", state.user.city],
          ["Maa", state.user.country],
          ["Julkinen osoite", state.user.public_address],
          ["Käyttäjänimi", state.user.username],
          ["Bio", state.user.bio],
          ["IP", state.user.last_ip || state.user.last_seen_ip],
          ["IP-osumat", state.user.ip_count ? String(state.user.ip_count) : null],
          ["Puhelin vahvistettu", state.user.phone_verified_at ? formatDate(state.user.phone_verified_at) : null],
          ["Vahvistukset", `${state.user.phone_verification_count}/${2 + (state.user.extra_phone_verifications ?? 0)}`],
          ["Bannattu", state.user.is_banned ? "Kyllä" : "Ei"],
          ["Bannin syy", state.user.banned_reason],
          ["Liittynyt", formatDate(state.user.created_at)],
          ["Päivitetty", formatDate(state.user.updated_at)]
        ].filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "")
      : [];

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {state.kind === "view-profile" && (
          <>
            <h3>Profiilin tarkat tiedot</h3>
            <p>{state.user.email || state.user.id}</p>
            <div className={styles.profileDetailsGrid}>
              {profileDetailRows.map(([label, value]) => (
                <div key={label} className={styles.profileDetailRow}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.ghostBtn} onClick={onClose}>Sulje</button>
            </div>
          </>
        )}

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
              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                value={phone}
                onChange={(e) => setPhone(sanitizePhoneInput(e.target.value))}
                placeholder="358..."
              />
            </label>
            <div className={styles.modalActions}>
              <button type="button" className={styles.ghostBtn} onClick={onClose}>Peruuta</button>
              <button type="button" className={styles.primaryBtn} onClick={() => onVerifyPhone(state.user, phone.trim() || undefined)}>
                <BadgeCheck size={14} /> Vahvista
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
