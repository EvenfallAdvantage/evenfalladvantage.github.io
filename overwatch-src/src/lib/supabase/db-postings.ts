import { createClient } from "@/lib/supabase/client";
import { ensureInternalUser } from "./db-helpers";
import { logDbReadError } from "./db-error";

export type EmploymentType = "full-time" | "part-time" | "contract" | "temporary" | "internship";
export type PostingStatus = "draft" | "active" | "paused" | "closed";

export interface JobPosting {
  id: string;
  company_id: string;
  title: string;
  department: string | null;
  location: string | null;
  employment_type: EmploymentType | null;
  description_html: string;
  requirements: string | null;
  compensation_range: string | null;
  show_compensation: boolean;
  status: PostingStatus;
  external_ids: Record<string, unknown>;
  created_by: string | null;
  published_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Create a new job posting.
 */
export async function createJobPosting(
  companyId: string,
  posting: {
    title: string;
    department?: string;
    location?: string;
    employment_type?: EmploymentType;
    description_html: string;
    requirements?: string;
    compensation_range?: string;
    show_compensation?: boolean;
  }
): Promise<JobPosting> {
  const supabase = createClient();
  const userId = await ensureInternalUser();

  const { data, error } = await supabase
    .from("job_postings")
    .insert({
      company_id: companyId,
      ...posting,
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw error;
  return data as JobPosting;
}

/**
 * Update a job posting.
 */
export async function updateJobPosting(
  id: string,
  updates: Partial<Omit<JobPosting, "id" | "company_id" | "created_by" | "created_at">>
): Promise<JobPosting> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("job_postings")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as JobPosting;
}

/**
 * Publish a posting (set status to active + published_at timestamp).
 */
export async function publishPosting(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("job_postings")
    .update({
      status: "active",
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Close a posting.
 */
export async function closePosting(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("job_postings")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Get all postings for a company (admin view).
 */
export async function getCompanyPostings(companyId: string): Promise<JobPosting[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("job_postings")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as JobPosting[];
}

/**
 * Get active postings for a company (public careers page).
 */
export async function getActivePostings(companyId: string): Promise<JobPosting[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("job_postings")
    .select("*")
    .eq("company_id", companyId)
    .eq("status", "active")
    .order("published_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as JobPosting[];
}

/**
 * Get active postings by company slug (public careers page).
 */
export async function getActivePostingsBySlug(slug: string): Promise<{
  company: { id: string; name: string; logo_url: string | null; brand_color: string; slug: string };
  postings: JobPosting[];
} | null> {
  const supabase = createClient();

  // Look up company by slug
  const { data: company } = await supabase
    .from("companies")
    .select("id, name, logo_url, brand_color, slug")
    .eq("slug", slug)
    .maybeSingle();

  if (!company) return null;

  const { data: postings } = await supabase
    .from("job_postings")
    .select("*")
    .eq("company_id", company.id)
    .eq("status", "active")
    .order("published_at", { ascending: false });

  return {
    company: company as { id: string; name: string; logo_url: string | null; brand_color: string; slug: string },
    postings: (postings ?? []) as JobPosting[],
  };
}

/**
 * Get a single posting by ID.
 */
export async function getPosting(id: string): Promise<JobPosting | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("job_postings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as JobPosting | null;
}

/**
 * Delete a posting.
 */
export async function deletePosting(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("job_postings")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/**
 * Get applicant count per posting.
 */
export async function getPostingApplicantCounts(companyId: string): Promise<Record<string, number>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("applicants")
    .select("posting_id")
    .eq("company_id", companyId)
    .not("posting_id", "is", null);

  if (error) { logDbReadError("posting applicant counts", error); return {}; }

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const pid = (row as { posting_id: string }).posting_id;
    counts[pid] = (counts[pid] ?? 0) + 1;
  }
  return counts;
}

/**
 * Generate XML job feed for Indeed/Google indexing.
 */
export function generateJobFeedXML(
  postings: JobPosting[],
  company: { name: string; slug: string },
  baseUrl: string
): string {
  const items = postings.map((p) => `
    <job>
      <title><![CDATA[${p.title}]]></title>
      <date>${p.published_at || p.created_at}</date>
      <referencenumber>${p.id}</referencenumber>
      <url>${baseUrl}/overwatch/careers/${company.slug}/${p.id}</url>
      <company><![CDATA[${company.name}]]></company>
      ${p.location ? `<city><![CDATA[${p.location}]]></city>` : ""}
      ${p.employment_type ? `<jobtype>${p.employment_type}</jobtype>` : ""}
      ${p.compensation_range && p.show_compensation ? `<salary><![CDATA[${p.compensation_range}]]></salary>` : ""}
      <description><![CDATA[${p.description_html.replace(/<[^>]*>/g, "")}]]></description>
    </job>`).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<source>
  <publisher>${company.name}</publisher>
  <publisherurl>${baseUrl}/overwatch/careers/${company.slug}</publisherurl>
  ${items}
</source>`;
}
