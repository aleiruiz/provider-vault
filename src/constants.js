export const CATEGORIES = [
  "Hosting",
  "Database",
  "Auth",
  "Storage",
  "Email",
  "Payments",
  "Maps / APIs",
  "Mobile build",
  "Source control",
  "Domain / DNS",
  "Other",
];

export const STATUSES = ["active", "planned", "trial", "cancelled"];
export const PERIODS = ["monthly", "yearly", "usage-based", "free"];

/** Provider record with defaults for every field. */
export const provider = (o) => ({
  category: "Other",
  projects: [],
  purpose: "",
  plan: "",
  cost: "",
  currency: "USD",
  period: "monthly",
  renewal: "",
  url: "",
  account: "",
  keysLocation: "",
  status: "active",
  notes: "",
  ...o,
});

/** Secret record with defaults for every field. `provider` is a provider id. */
export const secret = (o) => ({
  provider: "",
  projects: [],
  envs: "",
  value: "",
  rotated: "",
  rotateDays: "",
  notes: "",
  ...o,
});
