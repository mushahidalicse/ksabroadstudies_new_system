import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  BookMarked,
  BookOpen,
  Check,
  GraduationCap,
  Landmark,
  MapPin,
  ScrollText,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { JsonLd } from "@/components/json-ld";
import { ProgrammeFinder } from "@/components/programme-finder";
import { ScholarshipEstimator } from "@/components/ScholarshipEstimator";
import { SocialLinks } from "@/components/social-links";
import { getMeta } from "@/lib/data";
import { SITE } from "@/lib/site";
import { faqJsonLd } from "@/lib/structured-data";
export const revalidate = 120;

export default async function HomePage() {
  const [meta] = await Promise.all([getMeta()]);
  const faq = faqJsonLd([
    {
      question: "When is Universitaly pre-enrolment for non-EU students?",
      answer: `Universitaly pre-enrolment deadline on this site is ${meta.universitalyPreEnrolmentDeadline}. Always confirm embassy and university steps.`,
    },
    {
      question: "Does KS Abroad Studies help Pakistani students apply to Italy?",
      answer: `${SITE.name} is a Pakistan-based consultancy for Italian public universities: English programmes, portals, regional scholarships, DOV, and study visa guidance.`,
    },
    {
      question: "Where can I browse English master's and bachelor's programmes?",
      answer:
        "Use /programs/master for master's, /programs/bachelor for bachelor's (including CEnT-S), and /programs/single-cycle for medicine and related single-cycle degrees.",
    },
    {
      question: "How do I contact KS Abroad?",
      answer: `WhatsApp ${SITE.whatsappDisplay}, email ${SITE.email}, or the contact form at /contact. On-site KS Buddy can answer common questions.`,
    },
  ]);

  const paths = [
    {
      href: "/universities",
      title: "Universities",
      body: "Portals, fees, open / soon / closed",
      badge: `${meta.openCount} open now`,
      icon: Landmark,
    },
    {
      href: "/programs/master",
      title: "Master's",
      body: `${meta.masterCount}+ English master's programmes`,
      badge: `${meta.masterCount}+ English Taught`,
      icon: GraduationCap,
    },
    {
      href: "/programs/bachelor",
      title: "Bachelor's",
      body: "English bachelor's + CEnT-S guide",
      badge: "CEnT-S / TOLC Ready",
      icon: BookOpen,
    },
    {
      href: "/programs/single-cycle",
      title: "Single-cycle (Medicine)",
      body: "MBBS · Dentistry · Veterinary + IMAT",
      badge: "IMAT & Single-Cycle",
      icon: Stethoscope,
    },
    {
      href: "/phd",
      title: "PhD",
      body: "Dottorato · PICA · English courses",
      badge: "English-friendly courses",
      icon: BookMarked,
    },
    {
      href: "/scholarships",
      title: "Scholarships",
      body: "Regional DSU agencies, windows, and documents",
      badge: "Tuition Waiver & Grants",
      icon: Award,
    },
    {
      href: "/guides",
      title: "Guides",
      body: "Docs · DOV · visa · scholarships",
      badge: "Embassy file steps",
      icon: ScrollText,
    },
  ];

  return (
    <>
      <JsonLd data={faq} />
      <section className="hero-plane">
        <div className="site-shell relative z-10 grid items-center gap-10 pb-20 pt-16 md:pb-24 md:pt-20 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="rise flex items-center gap-4">
              <BrandLogo size={64} priority className="shadow-lg ring-2 ring-white/15" />
            <p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-bold tracking-wide text-[#f7f4ed]">
              <GraduationCap size={14} /> {SITE.tagline}
            </p>
          </div>
          <h1 className="display mt-6 max-w-xl text-[clamp(2.4rem,5.4vw,4.2rem)] rise rise-delay-1">
            Study in Italy — made clear for Pakistani students
          </h1>
          <p className="mt-5 max-w-xl text-base md:text-lg text-[#e8e1d3] leading-relaxed rise rise-delay-2">
            Find universities, compare English-taught programmes, track deadlines, and build your shortlist.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3 rise rise-delay-3">
            <Link href="/programs/find" className="btn btn-glow">
              Find My Programme <ArrowRight size={18} />
            </Link>
            <Link href="/universities" className="btn btn-ghost">
              Explore Universities
            </Link>
            <Link href="/register" className="text-sm font-semibold text-[#f4efe4] underline-offset-4 hover:underline">
              Or open the student portal
            </Link>
          </div>
            <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-[#dcc7a4]">
              <Check size={16} /> No upfront registration fees · Lazio & South Italy specialist
            </p>
          </div>

          <aside className="rounded-2xl border border-white/15 bg-white/10 p-5 shadow-2xl backdrop-blur-xl rise rise-delay-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#dcc7a4]">
              <span className="live-dot inline-block h-2.5 w-2.5 rounded-full bg-[#8dbe74]" />
              Live Portal Engine
            </div>
            <p className="mt-4 text-sm font-semibold text-[#f7f4ed]">University of Padua</p>
            <h2 className="display mt-1 text-3xl text-white">Applied Economics</h2>
            <p className="mt-1 text-sm text-[#e8e1d3]">English-taught master&apos;s · Veneto</p>
            <p className="mt-4 inline-flex rounded-full border border-[#dcc7a4]/40 bg-[#dcc7a4]/15 px-3 py-1 text-xs font-bold text-[#f4efe4]">
              Veneto DSU · tuition waiver and stipend window
            </p>
            <p className="mt-3 text-sm font-semibold text-[#cfe7c4]">
              Open for international applicants · closes 15 Nov 2026
            </p>
            <Link href="/register" className="btn btn-primary mt-5 w-full">
              Run Your Match in 60s <ArrowRight size={16} />
            </Link>
            <Link href="/universities/university-of-padua" className="mt-3 block text-center text-xs font-semibold text-[#dcc7a4] underline-offset-4 hover:underline">
              See the Padua call
            </Link>
          </aside>
        </div>
      </section>

      <section className="site-shell relative z-20 -mt-8 pb-6">
        <ProgrammeFinder
          counts={{
            bachelor: meta.bachelorCount,
            master: meta.masterCount,
            singleCycle: meta.singleCycleCount,
          }}
        />
      </section>

      <section className="site-shell relative z-10 pb-6 pt-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {paths.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="panel rounded-2xl p-5 transition hover:-translate-y-0.5 hover:border-[rgba(15,106,111,0.5)] hover:shadow-[0_16px_36px_rgba(15,106,111,0.12)]"
            >
              <item.icon className="text-[var(--sea)]" size={22} />
              <div className="mt-3 font-bold text-lg">{item.title}</div>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">{item.body}</p>
              <span className="mt-3 inline-flex rounded-full bg-[rgba(15,106,111,0.1)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--sea-deep)]">
                {item.badge}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="site-shell py-12 md:py-16">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="ink-card rounded-2xl border border-white/10 p-6 shadow-lg">
            <div className="ink-sand text-xs font-bold uppercase tracking-wide">Universities</div>
            <div className="mt-3 text-3xl font-extrabold">{meta.universityCount}+</div>
            <p className="ink-muted mt-3 text-sm">
              {meta.openCount} open · {meta.soonCount} soon · {meta.closedCount} closed
            </p>
            <p className="ink-sand mt-2 text-xs">Updated for 2026/2027 intake</p>
          </div>
          <div className="ink-card rounded-2xl border border-white/10 p-6 shadow-lg">
            <div className="ink-sand text-xs font-bold uppercase tracking-wide">English programmes</div>
            <div className="mt-3 text-3xl font-extrabold">{meta.programCount}+</div>
            <p className="ink-muted mt-3 text-sm">
              {meta.bachelorCount} bachelor · {meta.masterCount} master · {meta.singleCycleCount} single-cycle
            </p>
            <p className="ink-sand mt-2 text-xs">Updated for 2026/2027 intake</p>
          </div>
          <div className="ink-card rounded-2xl border border-[#dcc7a4]/40 p-6 shadow-lg">
            <div className="ink-sand flex items-center gap-2 text-xs font-bold uppercase tracking-wide">
              <span className="live-dot inline-block h-2 w-2 rounded-full bg-[#dcc7a4]" />
              MUR Pre-Enrolment Cycle
            </div>
            <div className="mt-3 text-3xl font-extrabold">30 Nov</div>
            <p className="ink-muted mt-3 text-sm">
              Universitaly deadline {meta.universitalyPreEnrolmentDeadline}
            </p>
            <p className="ink-sand mt-2 text-xs">Updated for 2026/2027 intake</p>
          </div>
        </div>
      </section>

      <section className="site-shell pb-8">
        <ScholarshipEstimator />
      </section>

      <section className="site-shell pb-8">
        <p className="eyebrow">Why KS Abroad</p>
        <h2 className="display mt-3 max-w-2xl text-4xl">On-ground advantage</h2>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {[
            {
              title: "On-Ground Groundwork in Italy",
              body: "Direct guidance and continuous support based inside Italy, covering both university procedures and regional offices.",
              icon: MapPin,
            },
            {
              title: "Regional Scholarship Masterclass",
              body: "Full documentation roadmap for DiSCo Lazio, ADISU Puglia, and other regional agencies to secure tuition waivers and living stipends.",
              icon: Award,
            },
            {
              title: "Embassy & Universitaly Visa Desk",
              body: "Precise guidance for CIMEA Statements of Comparability, Universitaly pre-enrolment, and Pakistani embassy visa file structuring.",
              icon: ShieldCheck,
            },
          ].map((item) => (
            <div key={item.title} className="panel rounded-2xl p-5">
              <item.icon className="text-[var(--sea)]" size={22} />
              <h3 className="mt-3 font-bold text-lg">{item.title}</h3>
              <p className="mt-2 text-sm text-[var(--ink-soft)] leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="site-shell pb-20">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] items-stretch">
          <div className="panel rounded-3xl p-6 md:p-8">
            <p className="eyebrow">Student desk</p>
            <h2 className="display mt-3 text-4xl md:text-5xl max-w-xl">
              Find the portal. Check the deadline. Apply with confidence.
            </h2>
            <p className="mt-5 max-w-2xl text-[var(--ink-soft)] text-lg leading-relaxed">
              Official university links, region scholarships, and process steps
              in one place — built for Pakistani students targeting Italy.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/contact" className="btn btn-sea">
                Contact Us
              </Link>
              <a
                href={SITE.whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline"
              >
                WhatsApp {SITE.whatsappDisplay}
              </a>
            </div>
            <div className="mt-7">
              <p className="eyebrow mb-3">Follow · {SITE.founderHandle}</p>
              <SocialLinks compact groups={["company", "channels"]} />
            </div>
          </div>

          <div className="panel rounded-3xl p-6 md:p-8">
            <p className="eyebrow mb-2">Quick jumps</p>
            <Link href="/universities" className="link-row">
              Universities list <ArrowUpRight size={18} />
            </Link>
            <Link href="/programs/master" className="link-row">
              Master&apos;s in English <ArrowUpRight size={18} />
            </Link>
            <Link href="/programs/bachelor" className="link-row">
              Bachelor&apos;s + CEnT-S <ArrowUpRight size={18} />
            </Link>
            <Link href="/programs/single-cycle" className="link-row">
              Medicine · Dentistry · IMAT <ArrowUpRight size={18} />
            </Link>
            <Link href="/phd" className="link-row">
              PhD / Dottorato <ArrowUpRight size={18} />
            </Link>
            <Link href="/guides" className="link-row">
              Pakistan guides <ArrowUpRight size={18} />
            </Link>
            <Link href="/scholarships" className="link-row">
              Regional scholarships <ArrowUpRight size={18} />
            </Link>
            <Link href="/erasmus" className="link-row">
              Erasmus Mundus 2027 <ArrowUpRight size={18} />
            </Link>
            <Link href="/process" className="link-row">
              Full process · tests <ArrowUpRight size={18} />
            </Link>
            <Link href="/about" className="link-row">
              Company registration <ArrowUpRight size={18} />
            </Link>
            <Link href="/agreement" className="link-row">
              Consultancy agreement <ArrowUpRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
