import { createClient } from "@/lib/supabase/client";

/** Branding-only company fields that public pages (careers, apply, intake share) may show. */
export interface PublicCompany {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  brand_color: string;
  accent_color: string | null;
  website_url: string | null;
}

const PUBLIC_COLUMNS = "id, name, slug, logo_url, brand_color, accent_color, website_url";

const isMissingRpc = (e: { code?: string } | null) => !!e && (e.code === "PGRST202" || e.code === "42883");

/**
 * Look up a company's public branding by id or slug.
 *
 * `companies` is readable only by that company's members, so public pages use
 * the get_public_company RPC (SECURITY DEFINER, branding columns only). Before
 * that migration is applied the RPC is missing and we fall back to the table.
 */
export async function getPublicCompany(lookup: { id: string } | { slug: string }): Promise<PublicCompany | null> {
  const supabase = createClient();
  const args = "id" in lookup
    ? { p_company_id: lookup.id, p_slug: null }
    : { p_company_id: null, p_slug: lookup.slug };

  const rpc = await supabase.rpc("get_public_company", args);
  if (!rpc.error) {
    const rows = (rpc.data ?? []) as PublicCompany[];
    return rows[0] ?? null;
  }
  if (!isMissingRpc(rpc.error)) return null;

  // Legacy path (pre-migration).
  const query = supabase.from("companies").select(PUBLIC_COLUMNS);
  const { data } = await ("id" in lookup ? query.eq("id", lookup.id) : query.eq("slug", lookup.slug)).maybeSingle();
  return (data as PublicCompany | null) ?? null;
}
