"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { User } from "lucide-react";
import { usePageHeader } from "@/stores/page-header-store";
import { getMemberProfile, getMyOnboardingProgress } from "@/lib/supabase/db";
import type { SessionUser } from "@/types";
import type { MemberProfile, OProgress } from "./components/types";

import { ProfileAvatarSection } from "./components/profile-avatar-section";
import { ProfileCompletenessBar } from "./components/profile-completeness-bar";
import { GuardCardWarning } from "./components/guard-card-warning";
import { OnboardingChecklist } from "./components/onboarding-checklist";
import { PersonalProfileCard } from "./components/personal-profile-card";
import { NotificationPreferencesCard } from "./components/notification-preferences-card";
import { EducationCard } from "./components/education-card";
import { WorkHistoryCard } from "./components/work-history-card";
import { ProfileActivityTabs } from "./components/profile-activity-tabs";
import { ProfileBadgeCard } from "./components/profile-badge-card";
import { PayStubCard } from "./components/pay-stub-card";
import CertificationsSection from "@/app/academy/components/certifications-section";
import { getUserCertifications } from "@/lib/supabase/db";
import { logger } from "@/lib/logger";

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);

  const [mp, setMp] = useState<MemberProfile>(null);
  const [mpLoaded, setMpLoaded] = useState(false);
  const [onboardingProgress, setOnboardingProgress] = useState<OProgress[]>([]);
  const [certs, setCerts] = useState<Record<string, unknown>[]>([]);
  const [legacyCerts, setLegacyCerts] = useState<Record<string, unknown>[]>([]);

  const isOnboarding = mp?.status === "onboarding" && !mp?.onboarding_complete;

  const setHeader = usePageHeader((s) => s.setHeader);
  const clearHeader = usePageHeader((s) => s.clearHeader);

  useEffect(() => {
    setHeader("PROFILE", `${user?.firstName ?? "Your"} ${user?.lastName ?? "Name"}`, <User className="h-5 w-5" />);
    return () => clearHeader();
  }, [setHeader, clearHeader, user?.firstName, user?.lastName]);

  // Load member profile + onboarding progress
  useEffect(() => {
    if (!activeCompanyId || mpLoaded) return;
    (async () => {
      try {
        const profile = await getMemberProfile(activeCompanyId);
        setMp(profile);
      } catch (e) { logger.swallow("profile:load-member", e, "warn"); }
      try { setOnboardingProgress(await getMyOnboardingProgress(activeCompanyId)); } catch (e) { logger.swallow("profile:load-onboarding", e, "debug"); }
      try {
        const [owCerts, legacy] = await Promise.all([
          getUserCertifications(),
          (async () => {
            const { getLegacyCertificates } = await import("@/lib/legacy-bridge");
            return await getLegacyCertificates(activeCompanyId);
          })()
        ]);
        setCerts(owCerts || []);
        setLegacyCerts(legacy || []);
      } catch (e) { logger.swallow("profile:load-certs", e, "debug"); }
      setMpLoaded(true);
    })();
  }, [activeCompanyId, mpLoaded]);

  function handleAvatarUpdated(url: string) {
    if (user) setUser({ ...user, avatarUrl: url });
  }

  function handleUserChange(updated: SessionUser) {
    setUser(updated);
  }

  return (
    <>
      <div className="space-y-6">
        <ProfileAvatarSection
          user={user}
          role={activeCompany?.role ?? "Staff"}
          isOnboarding={isOnboarding}
          onAvatarUpdated={handleAvatarUpdated}
        />

        <ProfileCompletenessBar user={user} mp={mp} mpLoaded={mpLoaded} />

        <GuardCardWarning mp={mp} />

        <OnboardingChecklist
          mp={mp}
          onMpChange={setMp}
          activeCompanyId={activeCompanyId ?? ""}
          onboardingProgress={onboardingProgress}
          onProgressChange={setOnboardingProgress}
        />

        <div className="grid gap-6 md:grid-cols-[280px_1fr]">
          {/* Sidebar: Personal + Company Details */}
          <div className="space-y-4">
            <PersonalProfileCard
              user={user}
              onUserChange={handleUserChange}
              mp={mp}
              onMpChange={setMp}
              mpLoaded={mpLoaded}
              activeCompanyId={activeCompanyId}
            />

            {mpLoaded && mp && (
              <CertificationsSection
                owCerts={certs}
                legacyCertificates={legacyCerts}
                onCertsChange={setCerts}
              />
            )}

            {mpLoaded && mp && (
              <NotificationPreferencesCard
                mp={mp}
                onMpChange={setMp}
                activeCompanyId={activeCompanyId}
              />
            )}

            {user && activeCompanyId && activeCompany && (
              <ProfileBadgeCard
                activeCompanyId={activeCompanyId}
                userId={user.id}
                firstName={user.firstName}
                lastName={user.lastName}
                avatarUrl={user.avatarUrl}
                companyName={activeCompany.companyName}
                companyLogo={activeCompany.companyLogo}
                brandColor={activeCompany.brandColor}
              />
            )}

            {activeCompanyId && (
              <PayStubCard activeCompanyId={activeCompanyId} />
            )}

            {mpLoaded && mp && (
              <EducationCard mp={mp} onMpChange={setMp} />
            )}

            {mpLoaded && mp && (
              <WorkHistoryCard mp={mp} onMpChange={setMp} />
            )}
          </div>

          {/* Activity Tabs */}
          <ProfileActivityTabs activeCompanyId={activeCompanyId} />
        </div>
      </div>
    </>
  );
}
