import type { ReactNode } from "react";
import {
  Facebook,
  Instagram,
  Linkedin,
  Link as LinkIcon,
  Youtube,
  type LucideProps,
} from "lucide-react";
import { SOCIAL_LINKS, type SocialLink } from "@/lib/site";

type IconProps = { className?: string };

function WhatsAppIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M20.52 3.48A11.86 11.86 0 0 0 12.06 0C5.5 0 .16 5.33.16 11.9c0 2.1.55 4.14 1.6 5.95L0 24l6.3-1.65a11.9 11.9 0 0 0 5.76 1.47h.01c6.56 0 11.9-5.34 11.9-11.91 0-3.18-1.24-6.17-3.45-8.43ZM12.07 21.8h-.01a9.9 9.9 0 0 1-5.04-1.38l-.36-.21-3.74.98 1-3.64-.24-.37a9.86 9.86 0 0 1-1.51-5.27C2.17 6.44 6.6 2 12.06 2a9.86 9.86 0 0 1 9.9 9.9c0 5.46-4.44 9.9-9.89 9.9Zm5.43-7.42c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47a8.9 8.9 0 0 1-1.65-2.04c-.17-.3 0-.46.13-.61.13-.13.3-.35.44-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35Z" />
    </svg>
  );
}

function TikTokIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 1 1-2.04-2.77V9.4a6.33 6.33 0 1 0 5.5 6.26V9.4a8.16 8.16 0 0 0 4.76 1.52V7.47a4.85 4.85 0 0 1-1-.78Z" />
    </svg>
  );
}

function ThreadsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M12.2 2C6.5 2 2 6.5 2 12.2S6.5 22.4 12.2 22.4 22.4 17.9 22.4 12.2 17.9 2 12.2 2Zm0 18.8c-4.8 0-8.6-3.8-8.6-8.6S7.4 3.6 12.2 3.6s8.6 3.8 8.6 8.6-3.8 8.6-8.6 8.6Zm3.9-9.7c-.1-2-1.3-3.5-3.4-3.7-1.5-.1-2.9.6-3.3 1.9-.1.4.2.9.6.8.4-.1.6-.4.7-.6.3-.6 1-.1 1.9-1 1.1.1 1.8.9 1.9 2.1-.8-.3-1.7-.4-2.6-.2-1.9.3-3.1 1.6-3 3.4.1 1.8 1.5 2.9 3.2 2.9 1.2 0 2.2-.5 2.9-1.4.2.7.6 1.2 1 1.6.3.4.9.3 1.1-.1.3-.4.2-.9-.1-1.2-.3-.4-.5-.8-.7-1.3.1-.6.3-1.3.3-1.9Zm-3 3.2c-1 0-1.7-.5-1.7-1.3 0-1 .8-1.5 2.1-1.3.6.1 1.2.3 1.7.7-.2 1.2-1 1.9-2.1 1.9Z" />
    </svg>
  );
}

type AnyIcon = (props: LucideProps | IconProps) => ReactNode;

const ICONS: Record<string, AnyIcon> = {
  "whatsapp-chat": WhatsAppIcon,
  "whatsapp-channel": WhatsAppIcon,
  "instagram-company": Instagram,
  "instagram-personal": Instagram,
  "linkedin-company": Linkedin,
  "linkedin-personal": Linkedin,
  facebook: Facebook,
  youtube: Youtube,
  tiktok: TikTokIcon,
  threads: ThreadsIcon,
  linktree: LinkIcon,
};

export function SocialLinks({
  groups,
  compact = false,
}: {
  groups?: Array<SocialLink["group"]>;
  compact?: boolean;
}) {
  const links = SOCIAL_LINKS.filter(
    (link) => !groups || groups.includes(link.group),
  );

  return (
    <div className={`flex flex-wrap ${compact ? "gap-2" : "gap-3"}`}>
      {links.map((link) => {
        const Icon = ICONS[link.id] || LinkIcon;
        return (
          <a
            key={link.id}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={link.label}
            title={link.label}
            className={`inline-flex items-center justify-center rounded-full border border-[var(--line)] bg-[rgba(255,252,245,0.9)] text-[var(--ink)] hover:border-[var(--sea)] hover:text-[var(--sea-deep)] transition ${
              compact ? "h-9 w-9" : "h-11 w-11"
            }`}
          >
            <Icon className={compact ? "h-4 w-4" : "h-5 w-5"} />
          </a>
        );
      })}
    </div>
  );
}
