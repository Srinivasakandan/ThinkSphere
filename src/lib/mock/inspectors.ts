import type { Inspector } from "@/types";

export const MOCK_INSPECTORS: Inspector[] = [
  {
    id: "usr-001",
    name: "Arjun Mehta",
    email: "arjun.mehta@legalmetrology.gov.in",
    role: "Inspector",
    badgeId: "LM-INS-1042",
  },
  {
    id: "usr-002",
    name: "Priya Nair",
    email: "priya.nair@legalmetrology.gov.in",
    role: "Inspector",
    badgeId: "LM-INS-1087",
  },
  {
    id: "usr-003",
    name: "Ramesh Iyer",
    email: "ramesh.iyer@legalmetrology.gov.in",
    role: "Supervisor",
    badgeId: "LM-SUP-0231",
  },
  {
    id: "usr-004",
    name: "Fatima Sheikh",
    email: "fatima.sheikh@legalmetrology.gov.in",
    role: "Administrator",
    badgeId: "LM-ADM-0009",
  },
];

export const CURRENT_INSPECTOR = MOCK_INSPECTORS[0];
