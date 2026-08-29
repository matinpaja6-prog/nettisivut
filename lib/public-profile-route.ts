import "server-only";

import { isUuidLike, legacySlugifyProfileName, publicCompanyDisplayName, slugifyProfileName } from "@/lib/routes";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type PublicProfileRow = {
  id: string;
  public_id: string | null;
  username: string | null;
  account_type: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  name: string | null;
  company_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  city: string | null;
  country: string | null;
};

type PublicCompanyRow = {
  owner_user_id: string;
  name: string;
  description: string | null;
  storefront_headline: string | null;
  banner_image_url: string | null;
  social_share_image_url: string | null;
  website: string | null;
  city: string | null;
  country: string | null;
  verification_status: string | null;
};

export type ResolvedPublicProfile = {
  id: string;
  name: string;
  slug: string;
  accountType: "company" | "private";
  description: string;
  image: string | null;
  city: string | null;
  country: string | null;
  website: string | null;
  verified: boolean;
};

const PROFILE_SELECT = "id,public_id,username,account_type,first_name,last_name,full_name,name,company_name,bio,avatar_url,city,country";
const COMPANY_SELECT = "owner_user_id,name,description,storefront_headline,banner_image_url,social_share_image_url,website,city,country,verification_status";

function profileName(profile: PublicProfileRow, company?: PublicCompanyRow | null) {
  if (profile.account_type === "company") {
    return publicCompanyDisplayName(company?.name || profile.company_name || profile.full_name || profile.name || "Yritys");
  }

  return profile.full_name || profile.name ||
    `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || "Myyjä";
}

export async function resolvePublicProfile(identifier: string): Promise<ResolvedPublicProfile | null> {
  const admin = getSupabaseAdmin();
  const decoded = decodeURIComponent(identifier).trim();
  let profile: PublicProfileRow | null = null;
  let matchedCompany: PublicCompanyRow | null = null;

  if (isUuidLike(decoded)) {
    const result = await admin
      .from("profiles")
      .select(PROFILE_SELECT)
      .eq("id", decoded)
      .maybeSingle<PublicProfileRow>();
    profile = result.data;
  } else {
    const publicIdResult = await admin
      .from("profiles")
      .select(PROFILE_SELECT)
      .eq("public_id", decoded)
      .maybeSingle<PublicProfileRow>();
    profile = publicIdResult.data;

    if (!profile) {
      const usernameResult = await admin
        .from("profiles")
        .select(PROFILE_SELECT)
        .eq("username", decoded)
        .maybeSingle<PublicProfileRow>();
      profile = usernameResult.data;
    }

    if (!profile) {
      const wantedSlug = slugifyProfileName(decoded);
      const [profilesResult, companiesResult] = await Promise.all([
        admin.from("profiles").select(PROFILE_SELECT).range(0, 4999).returns<PublicProfileRow[]>(),
        admin.from("companies").select(COMPANY_SELECT).range(0, 4999).returns<PublicCompanyRow[]>()
      ]);
      const companies = companiesResult.data ?? [];
      const companiesByOwner = new Map(companies.map((company) => [company.owner_user_id, company]));
      const wantedLegacySlug = legacySlugifyProfileName(decoded);
      const matches = (profilesResult.data ?? []).filter((candidate) => {
        const candidateName = profileName(candidate, companiesByOwner.get(candidate.id));
        const rawCompanyName = companiesByOwner.get(candidate.id)?.name || candidate.company_name || candidateName;

        return slugifyProfileName(candidateName) === wantedSlug ||
          legacySlugifyProfileName(rawCompanyName) === wantedLegacySlug;
      });

      // A human-readable URL must never resolve to the wrong person when two
      // accounts happen to share a name. UUID legacy links remain available
      // for the rare ambiguous case.
      if (matches.length !== 1) return null;
      profile = matches[0];
      matchedCompany = companiesByOwner.get(profile.id) ?? null;
    }
  }

  if (!profile) return null;
  if (!matchedCompany && profile.account_type === "company") {
    const companyResult = await admin
      .from("companies")
      .select(COMPANY_SELECT)
      .eq("owner_user_id", profile.id)
      .maybeSingle<PublicCompanyRow>();
    matchedCompany = companyResult.data;
  }

  const name = profileName(profile, matchedCompany);
  const slug = slugifyProfileName(name);
  if (!slug) return null;

  return {
    id: profile.id,
    name,
    slug,
    accountType: profile.account_type === "company" ? "company" : "private",
    description: matchedCompany?.storefront_headline || matchedCompany?.description || profile.bio || "",
    image: matchedCompany?.social_share_image_url || matchedCompany?.banner_image_url || profile.avatar_url,
    city: matchedCompany?.city || profile.city,
    country: matchedCompany?.country || profile.country,
    website: matchedCompany?.website || null,
    verified: matchedCompany?.verification_status === "approved"
  };
}
