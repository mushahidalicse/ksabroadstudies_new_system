import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Consultancy Agreement",
  description:
    "KS Abroad Studies educational consultancy agreement, payment terms, refund policy, visa disclaimer, and liability limits for students.",
};

const consultantDuties = [
  "Manage, compile, and organise university application documents against admission requirements.",
  "Guide the file so it follows relevant academic and portal rules, reducing avoidable rejection risk.",
  "Submit or assist submission of the university application and related identification/reference numbers where required.",
  "Support extra requirements such as language tests, portfolios, or interviews as specified by the university.",
  "Help complete application forms, logistics, and scheduling of appointments or interviews.",
  "Advise on document attestation workflows; university application fees and third-party costs are paid by the student (or from agreed advance funds with proof).",
  "Keep the student informed of application status and material procedure changes known to the consultancy.",
];

const studentDuties = [
  "Settle invoices within five (5) working days of receipt.",
  "Provide complete, accurate academic and identity documents on time.",
  "Register for and complete any required language or admission tests promptly.",
  "Remain solely responsible for the authenticity of all documents; the student bears consequences of forged, altered, or misleading documents.",
  "Follow embassy, BLS, Universitaly, and university instructions personally when a physical presence or account ownership is required.",
  "Inform the consultancy immediately of passport, contact, or plan changes.",
];

const paymentTerms = [
  "Initial payment: 25% of the agreed consultancy fee within five (5) working days.",
  "Second instalment: 50% of the remaining agreed amount after admission confirmation.",
  "Third instalment: 25% of the remaining agreed amount after scholarship confirmation (where scholarship support is part of the agreed package).",
  "Additional third-party costs (university fees, CIMEA, translation, courier, visa fees, etc.) are charged separately with proof.",
];

const refunds = [
  "If the consultancy materially fails its obligations under this agreement, the student may seek a refund for unused consultancy services as agreed in writing.",
  "If the university denies admission despite a complete, authentic file submitted on time under the agreed plan, the consultancy fee paid for that application package is refundable except university application fees and other third-party costs already spent (proof shared with the student).",
  "No refund if fraudulent, incomplete, or late documents are provided, or if the student fails Section II duties.",
  "No refund if the student withdraws the application or stops responding at any stage.",
  "Scholarship denial, housing denial, or delayed DSU payments do not by themselves create a refund of consultancy fees when admission support was delivered as agreed.",
];

const liability = [
  "Visa appointments, visa outcomes, and embassy/consulate decisions are outside the consultancy’s control. KS Abroad Studies does not guarantee a visa, appointment date, or entry to Italy.",
  "Universities, MUR, Universitaly, CISIA, regional scholarship agencies, and Italian missions may change deadlines, seats, fees, and document rules without notice. The consultancy is not liable for losses caused by such official changes.",
  "The consultancy provides guidance and filing support; final decisions rest with universities and Italian authorities.",
  "The student is solely liable for document authenticity and for any legal consequence of false statements to universities or consulates.",
  "To the fullest extent permitted by law, the consultancy’s total liability under this agreement is limited to the consultancy fees actually paid by the student for the specific service package in dispute — excluding third-party fees.",
  "Neither party is liable for indirect, incidental, or consequential losses (including lost scholarships, delayed travel, or alternative study plans), except in cases of proven fraud by that party.",
  "Force majeure (strikes, portal outages, pandemic measures, war, natural disasters, sudden regulatory bans) suspends timelines without creating refund rights beyond unused prepaid third-party costs that can still be recovered.",
];

export default function AgreementPage() {
  return (
    <div className="site-shell page-hero pb-16">
      <p className="eyebrow">KS Abroad Studies · Educational consultancy</p>
      <h1 className="display mt-3 text-4xl md:text-6xl max-w-4xl">
        Consultancy agreement & terms
      </h1>
      <p className="mt-5 max-w-3xl text-lg text-[var(--ink-soft)] leading-relaxed">
        This page summarises the service agreement between{" "}
        <strong>{SITE.name}</strong> (the Consultancy) and the student (Client).
        A signed PDF copy is used for each client file. Download the template
        below and complete it with the authorised person before work starts.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <a
          href="/guides/consultancy-agreement.pdf"
          target="_blank"
          rel="noreferrer"
          className="btn btn-sea"
        >
          Download agreement PDF
        </a>
        <Link href="/guides" className="btn btn-outline">
          Pakistan student guides
        </Link>
        <a href={SITE.whatsappUrl} target="_blank" rel="noreferrer" className="btn btn-outline">
          WhatsApp {SITE.whatsappDisplay}
        </a>
      </div>

      <section className="mt-12 panel rounded-3xl p-6 md:p-8">
        <h2 className="display text-3xl">Parties</h2>
        <p className="mt-4 text-[var(--ink-soft)] leading-relaxed">
          Agreement between <strong>{SITE.name}</strong>, authorised person{" "}
          <strong>{SITE.founder}</strong> ({SITE.founderHandle}), WhatsApp{" "}
          {SITE.whatsappDisplay}, email {SITE.email}, and the Student named on
          the signed form (full name, passport number, email, phone, effective
          date).
        </p>
      </section>

      <section className="mt-8 panel rounded-3xl p-6 md:p-8">
        <h2 className="display text-3xl">I. Consultancy responsibilities</h2>
        <ul className="mt-5 space-y-2 text-[var(--ink-soft)] leading-relaxed">
          {consultantDuties.map((item) => (
            <li key={item.slice(0, 40)}>· {item}</li>
          ))}
        </ul>
      </section>

      <section className="mt-8 panel rounded-3xl p-6 md:p-8">
        <h2 className="display text-3xl">II. Student responsibilities</h2>
        <ul className="mt-5 space-y-2 text-[var(--ink-soft)] leading-relaxed">
          {studentDuties.map((item) => (
            <li key={item.slice(0, 40)}>· {item}</li>
          ))}
        </ul>
      </section>

      <section className="mt-8 panel rounded-3xl p-6 md:p-8">
        <h2 className="display text-3xl">III. Payment terms</h2>
        <ul className="mt-5 space-y-2 text-[var(--ink-soft)] leading-relaxed">
          {paymentTerms.map((item) => (
            <li key={item.slice(0, 40)}>· {item}</li>
          ))}
        </ul>
      </section>

      <section className="mt-8 panel rounded-3xl p-6 md:p-8">
        <h2 className="display text-3xl">IV. Refund policy</h2>
        <ul className="mt-5 space-y-2 text-[var(--ink-soft)] leading-relaxed">
          {refunds.map((item) => (
            <li key={item.slice(0, 40)}>· {item}</li>
          ))}
        </ul>
      </section>

      <section className="mt-8 panel rounded-3xl p-6 md:p-8 border-[var(--coral)]/25">
        <h2 className="display text-3xl">V. Visa, liability & safe harbour</h2>
        <p className="mt-4 text-[var(--ink-soft)] leading-relaxed">
          As an educational consultancy we do not take responsibility for visa
          appointments, visa guarantees, or sudden changes in official
          application procedures and requirements during the process.
        </p>
        <ul className="mt-5 space-y-2 text-[var(--ink-soft)] leading-relaxed">
          {liability.map((item) => (
            <li key={item.slice(0, 48)}>· {item}</li>
          ))}
        </ul>
      </section>

      <section className="mt-8 grid gap-5 md:grid-cols-2">
        <div className="panel rounded-3xl p-6">
          <h2 className="display text-2xl">VI. Confidentiality</h2>
          <p className="mt-3 text-sm text-[var(--ink-soft)] leading-relaxed">
            Terms, personal data, and application materials stay confidential
            except where disclosure is required by law, universities, or Italian
            authorities for the student’s own file.
          </p>
        </div>
        <div className="panel rounded-3xl p-6">
          <h2 className="display text-2xl">VII. Amendments</h2>
          <p className="mt-3 text-sm text-[var(--ink-soft)] leading-relaxed">
            Changes must be in writing (signed paper or confirmed email/WhatsApp
            from both parties). This web summary does not replace a signed
            client agreement for paid packages.
          </p>
        </div>
      </section>

      <section className="mt-8 panel rounded-3xl p-6 md:p-8">
        <h2 className="display text-3xl">Signature block (for PDF / print)</h2>
        <div className="mt-6 grid gap-8 md:grid-cols-2 text-sm">
          <div className="space-y-3 text-[var(--ink-soft)]">
            <p className="font-bold text-[var(--ink)]">For the Consultancy</p>
            <p>Name: {SITE.founder}</p>
            <p>Role: Authorised person, {SITE.name}</p>
            <p>Email: {SITE.email}</p>
            <p>Cell: {SITE.whatsappDisplay}</p>
            <p>Date: ________________</p>
            <p>Signature: ________________</p>
          </div>
          <div className="space-y-3 text-[var(--ink-soft)]">
            <p className="font-bold text-[var(--ink)]">Student (Client)</p>
            <p>Full name: ________________</p>
            <p>Passport No.: ________________</p>
            <p>Email: ________________</p>
            <p>Cell: ________________</p>
            <p>Date: ________________</p>
            <p>Signature: ________________</p>
          </div>
        </div>
      </section>

      <p className="mt-8 text-sm text-[var(--ink-soft)] max-w-3xl leading-relaxed">
        Website information is general guidance and is not a visa or admission
        guarantee. Official rules of Italian universities and missions prevail.
        Questions?{" "}
        <Link href="/contact" className="font-semibold text-[var(--sea-deep)] hover:underline">
          Contact page
        </Link>
        .
      </p>
    </div>
  );
}
