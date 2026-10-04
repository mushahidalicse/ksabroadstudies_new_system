import { SITE } from "@/lib/site";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  size?: number;
  className?: string;
  priority?: boolean;
};

/** Native img — avoids next/image optimizer failures (e.g. Windows paths with spaces). */
export function BrandLogo({ size = 52, className, priority = false }: BrandLogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={SITE.logoSrc}
      alt={SITE.name}
      width={size}
      height={size}
      decoding="async"
      {...(priority ? { fetchPriority: "high" as const } : {})}
      className={cn(
        "rounded-full bg-black object-cover shadow-sm shrink-0",
        className,
      )}
    />
  );
}
