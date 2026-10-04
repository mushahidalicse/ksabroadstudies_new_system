"use client";

import { useState } from "react";
import { IeltsMoiFilter } from "@/components/IeltsMoiFilter";
import { ProgramExplorer } from "@/components/program-explorer";
import type { EnglishFilter } from "@/lib/english-band";
import type { CatalogueCard } from "@/lib/programme-catalogue";

export function MasterProgrammeList({
  programs,
  initialField,
  initialRegion,
  initialStatus,
  initialFee,
}: {
  programs: CatalogueCard[];
  initialField?: string;
  initialRegion?: string;
  initialStatus?: string;
  initialFee?: string;
}) {
  const [englishFilter, setEnglishFilter] = useState<EnglishFilter>("all");

  return (
    <div className="space-y-4">
      <IeltsMoiFilter value={englishFilter} onFilterChange={setEnglishFilter} />
        <ProgramExplorer
          key={`${initialField}-${initialRegion}-${initialStatus}-${initialFee}`}
          programs={programs}
          levelLabel="Master's"
          initialField={initialField}
          initialRegion={initialRegion}
          initialStatus={initialStatus}
          initialFee={initialFee}
          englishFilter={englishFilter}
        />
    </div>
  );
}
