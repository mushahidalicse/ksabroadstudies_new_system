import type { Metadata } from "next";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = {
  title: "Login",
  description: "Log in to your KS Abroad Studies student portal.",
};

export default function LoginPage() {
  return (
    <div className="site-shell py-12 md:py-16 max-w-xl">
      <p className="eyebrow">Student portal</p>
      <h1 className="display mt-3 text-4xl md:text-6xl">Log in</h1>
      <p className="mt-4 text-lg text-[var(--ink-soft)] leading-relaxed">
        Open your profile, documents, and programme matches.
      </p>
      <div className="panel rounded-3xl p-6 md:p-8 mt-8">
        <LoginForm />
      </div>
    </div>
  );
}
