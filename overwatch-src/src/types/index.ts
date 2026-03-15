export type NavItem = {
  title: string;
  href: string;
  icon: string;
  badge?: number;
  roles?: string[];
  section?: string;
};

export type CompanyContext = {
  companyId: string;
  companyName: string;
  companySlug: string;
  companyLogo: string | null;
  brandColor: string;
  role: string;
  membership: {
    id: string;
    nickname: string | null;
    status: string;
  };
};

export type SessionUser = {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  isPlatformAdmin: boolean;
  companies: CompanyContext[];
  activeCompanyId: string | null;
};
