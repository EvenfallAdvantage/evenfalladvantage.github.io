"use client";

// Required for static export — slugs are dynamic, resolved client-side
export function generateStaticParams() { return []; }

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, Briefcase, MapPin, Clock, DollarSign, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getActivePostingsBySlug, type JobPosting } from "@/lib/supabase/db-postings";
import Image from "next/image";

export default function CareersPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<{ id: string; name: string; logo_url: string | null; brand_color: string; slug: string } | null>(null);
  const [postings, setPostings] = useState<JobPosting[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    getActivePostingsBySlug(slug).then((result) => {
      if (result) {
        setCompany(result.company);
        setPostings(result.postings);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
        <Briefcase className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <h1 className="text-lg font-semibold mb-2">Company Not Found</h1>
        <p className="text-sm text-muted-foreground">No careers page exists for this company.</p>
      </div>
    );
  }

  const brandColor = company.brand_color || "#d59b3c";
  const applyUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/overwatch/apply?c=${company.id}`;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/30" style={{ borderTopWidth: 4, borderTopColor: brandColor }}>
        <div className="max-w-3xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4">
            {company.logo_url && (
              <Image src={company.logo_url} alt="" width={56} height={56} className="rounded-xl" />
            )}
            <div>
              <h1 className="text-2xl font-bold">{company.name}</h1>
              <p className="text-sm text-muted-foreground">Careers & Open Positions</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {postings.length === 0 ? (
          <div className="text-center py-16">
            <Briefcase className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
            <h2 className="text-lg font-semibold mb-2">No Open Positions</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              We don&apos;t have any open positions right now, but check back soon! You can also submit a general application.
            </p>
            <Button className="mt-4" style={{ backgroundColor: brandColor }} onClick={() => window.open(applyUrl, "_blank")}>
              Submit General Application
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{postings.length} open position{postings.length !== 1 ? "s" : ""}</p>

            {postings.map((p) => (
              <div key={p.id} className="rounded-xl border border-border/30 overflow-hidden transition-shadow hover:shadow-md">
                {/* Summary row */}
                <button
                  className="w-full text-left px-5 py-4 flex items-start gap-4"
                  onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold">{p.title}</h3>
                    <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      {p.department && (
                        <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" />{p.department}</span>
                      )}
                      {p.location && (
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{p.location}</span>
                      )}
                      {p.employment_type && (
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{p.employment_type.replace("-", " ")}</span>
                      )}
                      {p.show_compensation && p.compensation_range && (
                        <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />{p.compensation_range}</span>
                      )}
                    </div>
                  </div>
                  {expanded === p.id ? <ChevronUp className="h-5 w-5 text-muted-foreground shrink-0 mt-1" /> : <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />}
                </button>

                {/* Expanded details */}
                {expanded === p.id && (
                  <div className="px-5 pb-5 space-y-4 border-t border-border/20 pt-4">
                    {p.description_html && (
                      <div className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{p.description_html}</div>
                    )}
                    {p.requirements && (
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Requirements</h4>
                        <div className="text-sm text-foreground/80 whitespace-pre-wrap">{p.requirements}</div>
                      </div>
                    )}
                    <Button
                      className="gap-2"
                      style={{ backgroundColor: brandColor }}
                      onClick={() => window.open(`${applyUrl}&posting=${p.id}`, "_blank")}
                    >
                      Apply Now <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))}

            {/* General application CTA */}
            <div className="text-center pt-8 border-t border-border/20">
              <p className="text-sm text-muted-foreground mb-3">
                Don&apos;t see a perfect fit? Submit a general application.
              </p>
              <Button variant="outline" onClick={() => window.open(applyUrl, "_blank")}>
                General Application <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border/20 py-6 text-center text-[11px] text-muted-foreground/50">
        Powered by <strong>OVERWATCH</strong> by {company.name}
      </div>

      {/* JSON-LD structured data for Google Jobs indexing */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            itemListElement: postings.map((p, i) => ({
              "@type": "ListItem",
              position: i + 1,
              item: {
                "@type": "JobPosting",
                title: p.title,
                description: p.description_html.replace(/<[^>]*>/g, ""),
                datePosted: p.published_at || p.created_at,
                hiringOrganization: {
                  "@type": "Organization",
                  name: company.name,
                  ...(company.logo_url ? { logo: company.logo_url } : {}),
                },
                ...(p.location ? { jobLocation: { "@type": "Place", address: p.location } } : {}),
                ...(p.employment_type ? { employmentType: p.employment_type.toUpperCase().replace("-", "_") } : {}),
              },
            })),
          }),
        }}
      />
    </div>
  );
}
