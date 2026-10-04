import type { StudentProfile } from "@/lib/student-types";

export type CompletenessSection = {
  id: "academic" | "english" | "preferences" | "budget" | "scholarship";
  label: string;
  complete: boolean;
  prompt: string;
};

export type ProfileCompleteness = {
  percent: number;
  sections: CompletenessSection[];
  prompts: string[];
};

function filled(value: string | undefined) {
  return Boolean(value?.trim());
}

export function profileCompleteness(profile: StudentProfile): ProfileCompleteness {
  const academic = Boolean(
    profile.studyLevel && filled(profile.field) && (filled(profile.cgpa) || filled(profile.percentage)),
  );
  const english = filled(profile.englishProof);
  const preferences = Boolean(profile.regionPreference || filled(profile.cityPreference) || filled(profile.preferredFields));
  const budget = filled(profile.maxApplicationFeeEuro) || filled(profile.annualBudgetEuro);
  const scholarship = profile.scholarshipInterest === "yes" || profile.scholarshipInterest === "no";
  const sections: CompletenessSection[] = [
    {
      id: "academic",
      label: "Academic profile",
      complete: academic,
      prompt: "Add your current education, field, and CGPA or percentage.",
    },
    {
      id: "english",
      label: "English qualification",
      complete: english,
      prompt: "Add your English qualification to improve programme matching.",
    },
    {
      id: "preferences",
      label: "Study preferences",
      complete: preferences,
      prompt: "Add your preferred field or region to improve recommendations.",
    },
    {
      id: "budget",
      label: "Budget",
      complete: budget,
      prompt: "Add a maximum application fee or yearly budget to screen costs.",
    },
    {
      id: "scholarship",
      label: "Scholarship preference",
      complete: scholarship,
      prompt: "Say whether you want scholarship screening.",
    },
  ];
  const weights = [30, 20, 20, 15, 15];
  const percent = sections.reduce((sum, section, index) => sum + (section.complete ? weights[index] : 0), 0);
  return {
    percent,
    sections,
    prompts: sections.filter((section) => !section.complete).map((section) => section.prompt),
  };
}
