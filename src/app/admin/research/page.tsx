"use client";

import { useEffect, useState } from "react";
import { AdminResearch } from "@/components/admin-research";

export default function ResearchPage() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setReady(Boolean(localStorage.getItem("ks-admin-password"))), 0);
    return () => clearTimeout(timer);
  }, []);
  if (!ready) {
    return (
      <main className="wrap page-pad">
        <h1>Programme research</h1>
        <p>Open the admin desk and save the password first. This page uses the same admin password.</p>
        <a className="btn btn-sea" href="/admin">Open admin</a>
      </main>
    );
  }
  return <main className="wrap page-pad"><AdminResearch /></main>;
}
