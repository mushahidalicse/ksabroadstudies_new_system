import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ScholarshipFinder } from "@/components/scholarship-finder";
import { COOKIE, readSessionToken } from "@/lib/auth";
import { getScholarshipsDataset } from "@/lib/scholarships";
import { getStudentById } from "@/lib/students";

export const metadata: Metadata = {
  title: "Scholarship finder",
  description: "Screen stored Italian regional scholarship records. This is not an award decision.",
};

export default async function ScholarshipFindPage() {
  const dataset = await getScholarshipsDataset();
  const jar = await cookies();
  const studentId = readSessionToken(jar.get(COOKIE)?.value);
  const student = studentId ? await getStudentById(studentId) : null;
  return (
    <div className="site-shell py-12 md:py-16">
      <ScholarshipFinder dataset={dataset} initialProfile={student?.profile} />
    </div>
  );
}
