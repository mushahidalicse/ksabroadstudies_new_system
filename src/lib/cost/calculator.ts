export type CostSource = "official" | "catalogue" | "verified" | "user" | "estimate";

export type CostLineItem = {
  id: string;
  label: string;
  amountEuro: number;
  source: CostSource;
  monthly?: boolean;
};

export type CostInput = {
  applicationFeeEuro: number;
  testFeeEuro: number;
  documentsEuro: number;
  visaEuro: number;
  insuranceEuro: number;
  flightEuro: number;
  tuitionEuro: number;
  rentMonthlyEuro: number;
  foodMonthlyEuro: number;
  transportMonthlyEuro: number;
  utilitiesMonthlyEuro: number;
  personalMonthlyEuro: number;
  contingencyEuro: number;
  exchangeRate: number | null;
  scholarshipScenario: boolean;
  expectedScholarshipEuro: number;
};

export type CostEstimate = {
  lines: CostLineItem[];
  upfrontEuro: number;
  monthlyLivingEuro: number;
  firstYearEuro: number;
  withScholarshipEuro: number | null;
  pkr: number | null;
  exchangeRate: number | null;
  disclaimer: string;
};

export const EMPTY_COST: CostInput = {
  applicationFeeEuro: 0,
  testFeeEuro: 0,
  documentsEuro: 0,
  visaEuro: 0,
  insuranceEuro: 0,
  flightEuro: 0,
  tuitionEuro: 0,
  rentMonthlyEuro: 0,
  foodMonthlyEuro: 0,
  transportMonthlyEuro: 0,
  utilitiesMonthlyEuro: 0,
  personalMonthlyEuro: 0,
  contingencyEuro: 0,
  exchangeRate: null,
  scholarshipScenario: false,
  expectedScholarshipEuro: 0,
};

function line(id: string, label: string, amountEuro: number, source: CostSource, monthly = false): CostLineItem {
  return { id, label, amountEuro: Math.max(0, amountEuro || 0), source, monthly };
}

export function estimateCost(input: CostInput): CostEstimate {
  const lines: CostLineItem[] = [
    line("application", "University application", input.applicationFeeEuro, "user"),
    line("test", "Admission or test fee", input.testFeeEuro, "user"),
    line("documents", "Documents", input.documentsEuro, "user"),
    line("visa", "Visa-related fees", input.visaEuro, "user"),
    line("insurance", "Insurance", input.insuranceEuro, "user"),
    line("flight", "Flight", input.flightEuro, "user"),
    line("tuition", "Tuition", input.tuitionEuro, "user"),
    line("rent", "Rent", input.rentMonthlyEuro, "user", true),
    line("food", "Food", input.foodMonthlyEuro, "user", true),
    line("transport", "Local transport", input.transportMonthlyEuro, "user", true),
    line("utilities", "Utilities", input.utilitiesMonthlyEuro, "user", true),
    line("personal", "Personal expenses", input.personalMonthlyEuro, "user", true),
    line("contingency", "Contingency", input.contingencyEuro, "estimate"),
  ];
  const upfrontEuro = lines.filter((item) => !item.monthly).reduce((sum, item) => sum + item.amountEuro, 0);
  const monthlyLivingEuro = lines.filter((item) => item.monthly).reduce((sum, item) => sum + item.amountEuro, 0);
  const firstYearEuro = upfrontEuro + monthlyLivingEuro * 12;
  const withScholarshipEuro = input.scholarshipScenario
    ? Math.max(0, firstYearEuro - Math.max(0, input.expectedScholarshipEuro || 0))
    : null;
  const rate = input.exchangeRate && input.exchangeRate > 0 ? input.exchangeRate : null;
  return {
    lines,
    upfrontEuro,
    monthlyLivingEuro,
    firstYearEuro,
    withScholarshipEuro,
    pkr: rate ? Math.round(firstYearEuro * rate) : null,
    exchangeRate: rate,
    disclaimer: "ESTIMATE — NOT AN OFFICIAL QUOTE",
  };
}
