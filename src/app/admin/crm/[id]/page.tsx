"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AdminCrm } from "@/components/admin-crm";

export default function CrmStudentPage() {
  const params = useParams<{ id: string }>();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setReady(Boolean(localStorage.getItem("ks-admin-password"))), 0);
    return () => clearTimeout(timer);
  }, []);
  if (!ready) {
    return (
      <main className="wrap page-pad">
        <h1>Student case</h1>
        <p>Open the admin desk and save the password first.</p>
        <a className="btn btn-sea" href="/admin">Open admin</a>
      </main>
    );
  }
  return (
    <main className="wrap page-pad">
      <AdminCrm studentId={params.id} />
    </main>
  );
}
