// ============================================================
// Page Builder Types - For Visual UI Editor
// ============================================================
// These types define the config structure for visual page editing
// Only UI settings - no page content, no HTML, no duplication

export type PageId =
  | "client-home"
  | "professional-home"
  | "for-clients"
  | "for-professionals"
  | "how-it-works"
  | "services"
  | "pricing"
  | "about-us";

export type SectionId = string;

// ========================
// Section Config Types
// ========================

export interface HeroSectionConfig {
  sectionId: "hero";
  visible: boolean;
  title: string;
  subtitle: string;
  buttonText: string;
  buttonLink: string;
  secondaryButtonText?: string;
  secondaryButtonLink?: string;
  backgroundImage?: string;
  backgroundColor?: string;
  textColor?: string;
  layoutStyle?: "left" | "center" | "split";
  spacing?: "compact" | "normal" | "spacious";
}

export interface StatsSectionConfig {
  sectionId: "stats";
  visible: boolean;
  title?: string;
  items?: Array<{ value: string; label: string }>;
  backgroundColor?: string;
  spacing?: "compact" | "normal" | "spacious";
}

export interface BenefitsSectionConfig {
  sectionId: "benefits";
  visible: boolean;
  title: string;
  subtitle?: string;
  items?: Array<{
    title: string;
    description: string;
    iconName?: string;
  }>;
  columns?: 2 | 3 | 4;
  backgroundColor?: string;
  spacing?: "compact" | "normal" | "spacious";
}

export interface FeaturesSectionConfig {
  sectionId: "features";
  visible: boolean;
  title: string;
  subtitle?: string;
  items?: Array<{
    title: string;
    description: string;
  }>;
  columns?: 2 | 3;
  backgroundColor?: string;
  spacing?: "compact" | "normal" | "spacious";
}

export interface CTASectionConfig {
  sectionId: "cta";
  visible: boolean;
  title: string;
  description?: string;
  buttonText: string;
  buttonLink: string;
  secondaryButtonText?: string;
  secondaryButtonLink?: string;
  backgroundColor?: string;
  textColor?: string;
  spacing?: "compact" | "normal" | "spacious";
}

export interface JobsSectionConfig {
  sectionId: "jobs";
  visible: boolean;
  title: string;
  subtitle?: string;
  showSearch?: boolean;
  showMap?: boolean;
  backgroundColor?: string;
  spacing?: "compact" | "normal" | "spacious";
}

export interface ProfessionalsSectionConfig {
  sectionId: "professionals";
  visible: boolean;
  title: string;
  subtitle?: string;
  showSearch?: boolean;
  backgroundColor?: string;
  spacing?: "compact" | "normal" | "spacious";
}

export interface PricingSectionConfig {
  sectionId: "pricing";
  visible: boolean;
  title: string;
  subtitle?: string;
  showToggle?: boolean;
  backgroundColor?: string;
  spacing?: "compact" | "normal" | "spacious";
}

export interface ServicesSectionConfig {
  sectionId: "services";
  visible: boolean;
  title: string;
  subtitle?: string;
  showFilters?: boolean;
  columns?: 2 | 3 | 4;
  backgroundColor?: string;
  spacing?: "compact" | "normal" | "spacious";
}

// ========================
// General Section Config (union type)
// ========================

export type SectionConfig =
  | HeroSectionConfig
  | StatsSectionConfig
  | BenefitsSectionConfig
  | FeaturesSectionConfig
  | CTASectionConfig
  | JobsSectionConfig
  | ProfessionalsSectionConfig
  | PricingSectionConfig
  | ServicesSectionConfig;

// ========================
// Page Configuration
// ========================

export interface PageConfig {
  pageId: PageId;
  sectionOrder: string[];
  sections: Record<string, SectionConfig>;
  globalSettings?: {
    primaryColor?: string;
    fontFamily?: string;
  };
  updatedAt?: string;
  publishedAt?: string;
}

// ========================
// Page Builder State (used in admin UI)
// ========================

export interface PageBuilderDraft {
  pageId: PageId;
  config: PageConfig;
  isDirty: boolean;
  lastSaved?: string;
}

// ========================
// Default Configurations
// ========================

export const DEFAULT_SECTION_ORDER: Record<PageId, string[]> = {
  "client-home": ["hero", "stats", "jobs", "professionals", "cta"],
  "professional-home": ["hero", "benefits", "features", "jobs", "cta"],
  "for-clients": ["hero", "benefits", "cta"],
  "for-professionals": ["hero", "benefits", "features", "jobs", "cta"],
  "how-it-works": ["hero", "steps", "steps-pro", "cta"],
  services: ["hero", "services", "cta"],
  pricing: ["hero", "pricing", "cta"],
  "about-us": ["hero", "content", "cta"],
};

// ========================
// Helper to create default config for a page
// ========================

export function createDefaultPageConfig(pageId: PageId): PageConfig {
  const commonHero: HeroSectionConfig = {
    sectionId: "hero",
    visible: true,
    title: getDefaultTitle(pageId),
    subtitle: getDefaultSubtitle(pageId),
    buttonText: "Get Started",
    buttonLink: "/signup",
    layoutStyle: "center",
    spacing: "normal",
  };

  const commonCTA: CTASectionConfig = {
    sectionId: "cta",
    visible: true,
    title: "Ready to get started?",
    description: "Join thousands of professionals and clients already using Servio.",
    buttonText: "Get Started Today",
    buttonLink: "/signup",
    spacing: "normal",
  };

  const sections: Record<string, SectionConfig> = {
    hero: commonHero,
    cta: commonCTA,
  };

  // Add page-specific sections
  if (pageId === "client-home") {
    sections.stats = {
      sectionId: "stats",
      visible: true,
      spacing: "normal",
    };
    sections.jobs = {
      sectionId: "jobs",
      visible: true,
      title: "Active job posts",
      subtitle: "Browse available jobs from clients.",
      showSearch: true,
      showMap: true,
      spacing: "normal",
    };
    sections.professionals = {
      sectionId: "professionals",
      visible: true,
      title: "Professionals",
      subtitle: "Find verified professionals near you.",
      showSearch: true,
      spacing: "normal",
    };
  }

  if (pageId === "professional-home" || pageId === "for-professionals") {
    sections.benefits = {
      sectionId: "benefits",
      visible: true,
      title: "Why join Servio?",
      subtitle: "Everything you need to grow your business.",
      columns: 3,
      spacing: "normal",
    };
    sections.features = {
      sectionId: "features",
      visible: true,
      title: "Built for professionals",
      subtitle: "Tools and features to help you succeed.",
      columns: 3,
      spacing: "normal",
    };
    sections.jobs = {
      sectionId: "jobs",
      visible: true,
      title: "Jobs posted by clients",
      subtitle: "Browse open jobs and find your next project.",
      showSearch: true,
      showMap: true,
      spacing: "normal",
    };
  }

  if (pageId === "for-clients") {
    sections.benefits = {
      sectionId: "benefits",
      visible: true,
      title: "Why clients choose Servio",
      subtitle: "Hire with confidence.",
      columns: 4,
      spacing: "normal",
    };
  }

  if (pageId === "how-it-works") {
    sections["steps"] = {
      sectionId: "services" as any,
      visible: true,
      title: "For Clients - How It Works",
      subtitle: "Get great work done in 4 steps.",
    } as any;
    sections["steps-pro"] = {
      sectionId: "services" as any,
      visible: true,
      title: "For Professionals",
      subtitle: "Earn more with less hassle.",
    } as any;
  }

  if (pageId === "services") {
    sections.services = {
      sectionId: "services",
      visible: true,
      title: "Browse all services",
      subtitle: "Find exactly the type of pro you need.",
      showFilters: true,
      columns: 3,
      spacing: "normal",
    };
  }

  if (pageId === "pricing") {
    sections.pricing = {
      sectionId: "pricing",
      visible: true,
      title: "Simple, transparent pricing",
      subtitle: "Free for clients. Pros pay only when they get paid.",
      showToggle: true,
      spacing: "normal",
    };
  }

  if (pageId === "about-us") {
    sections["content"] = {
      sectionId: "hero" as any,
      visible: true,
      title: "About Servio",
    } as any;
  }

  return {
    pageId,
    sectionOrder: DEFAULT_SECTION_ORDER[pageId] || ["hero", "cta"],
    sections,
  };
}

function getDefaultTitle(pageId: PageId): string {
  const titles: Record<PageId, string> = {
    "client-home": "Find Trusted Professionals Near You",
    "professional-home": "Find Quality Jobs. Get Paid Safely.",
    "for-clients": "Hire Trusted Pros — Without the Back-and-Forth",
    "for-professionals": "Find Quality Jobs. Get Paid Safely. Grow Your Business.",
    "how-it-works": "A Simpler Way to Hire & Get Hired",
    services: "Browse All Services",
    pricing: "Simple, Transparent Pricing",
    "about-us": "About Servio",
  };
  return titles[pageId] || "";
}

function getDefaultSubtitle(pageId: PageId): string {
  const subtitles: Record<PageId, string> = {
    "client-home": "Post jobs, hire experts, track work, and manage projects in one platform.",
    "professional-home": "No more chasing leads or waiting on payments.",
    "for-clients": "Post once. Get qualified proposals fast. Pay only when work is done.",
    "for-professionals": "Servio brings nearby and remote jobs straight to you.",
    "how-it-works": "Servio handles the busywork so you can focus on the work.",
    services: "From plumbing to web design — explore every category.",
    pricing: "No hidden fees. Pay only when you get paid.",
    "about-us": "Learn about our mission and story.",
  };
  return subtitles[pageId] || "";
}

export const SUPPORTED_PAGES: Array<{
  id: PageId;
  label: string;
  path: string;
  description: string;
}> = [
  {
    id: "client-home",
    label: "Home Page (Client)",
    path: "/",
    description: "Main client-facing landing page",
  },
  {
    id: "professional-home",
    label: "Home Page (Professional)",
    path: "/for-professionals",
    description: "Professional landing page",
  },
  {
    id: "for-clients",
    label: "For Clients Page",
    path: "/for-clients",
    description: "Client experience page",
  },
  {
    id: "for-professionals",
    label: "For Professionals Page",
    path: "/for-professionals",
    description: "Professional experience page",
  },
  {
    id: "how-it-works",
    label: "How It Works",
    path: "/how-it-works",
    description: "How the platform works",
  },
  {
    id: "services",
    label: "Services / Categories",
    path: "/services",
    description: "Browse service categories",
  },
  {
    id: "pricing",
    label: "Pricing / Fees / Commission",
    path: "/pricing",
    description: "Pricing plans and fees",
  },
  { id: "about-us", label: "About Us", path: "/about-us", description: "About the company" },
];
