export type SocialLink = {
  id: string;
  label: string;
  href: string;
  group: "company" | "founder" | "channels";
};

export const SITE = {
  legalName: "KS Abroad Studies (Private) Limited",
  cuin: "0241969",
  name: "KS Abroad Studies",
  tagline: "Book your Career, Fly into the Future",
  founder: "Faizan Ali Qureshi",
  founderHandle: "@Faqineurope",
  whatsappE164: "923131365614",
  whatsappDisplay: "+92 313 1365614",
  whatsappUrl: "https://wa.me/923131365614",
  whatsappChannelUrl: "https://whatsapp.com/channel/0029VaDBhoTDJ6GxndNLXk3q",
  email: "ksabroadstudies@gmail.com",
  emailUrl: "mailto:ksabroadstudies@gmail.com",
  logoSrc: "/ks-abroad-logo.png",
  linktreeUrl: "https://linktr.ee/Faqineurope",
  linkedinCompanyUrl: "https://www.linkedin.com/company/ks-abroad-studies",
  linkedinPersonalUrl: "https://www.linkedin.com/in/faizanaq19/",
  instagramCompanyUrl: "https://www.instagram.com/ksabroadstudies/",
  instagramPersonalUrl: "https://www.instagram.com/faqineurope/",
  facebookUrl: "https://www.facebook.com/Faizanali1999",
  tiktokUrl: "https://www.tiktok.com/@faqineurope",
  threadsUrl: "https://www.threads.net/@faqineurope",
  youtubeUrl: "https://www.youtube.com/@faqineurope",
} as const;

export const SOCIAL_LINKS: SocialLink[] = [
  {
    id: "whatsapp-chat",
    label: "WhatsApp chat",
    href: SITE.whatsappUrl,
    group: "channels",
  },
  {
    id: "whatsapp-channel",
    label: "WhatsApp channel",
    href: SITE.whatsappChannelUrl,
    group: "channels",
  },
  {
    id: "instagram-company",
    label: "Instagram · KS Abroad",
    href: SITE.instagramCompanyUrl,
    group: "company",
  },
  {
    id: "linkedin-company",
    label: "LinkedIn · KS Abroad",
    href: SITE.linkedinCompanyUrl,
    group: "company",
  },
  {
    id: "instagram-personal",
    label: "Instagram · Faqineurope",
    href: SITE.instagramPersonalUrl,
    group: "founder",
  },
  {
    id: "linkedin-personal",
    label: "LinkedIn · Faizan Ali Qureshi",
    href: SITE.linkedinPersonalUrl,
    group: "founder",
  },
  {
    id: "tiktok",
    label: "TikTok · @faqineurope",
    href: SITE.tiktokUrl,
    group: "founder",
  },
  {
    id: "youtube",
    label: "YouTube · @faqineurope",
    href: SITE.youtubeUrl,
    group: "founder",
  },
  {
    id: "threads",
    label: "Threads · @faqineurope",
    href: SITE.threadsUrl,
    group: "founder",
  },
  {
    id: "facebook",
    label: "Facebook · Faizan Ali",
    href: SITE.facebookUrl,
    group: "founder",
  },
  {
    id: "linktree",
    label: "All links · Linktree",
    href: SITE.linktreeUrl,
    group: "channels",
  },
];
