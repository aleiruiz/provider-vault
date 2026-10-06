// Fictional starter data used by the public repo and the screenshots. Nothing here is real:
// the projects, costs and "secret" values are made up.

import { provider as p, secret } from "../constants.js";

export const SEED_VERSION = 1;

export const PROJECTS = ["storefront", "mobile-app", "internal-tools"];

const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export const SEED = [
  p({
    id: "vercel",
    name: "Vercel",
    category: "Hosting",
    projects: ["storefront", "internal-tools"],
    purpose: "Hosting and preview deployments",
    plan: "Pro",
    cost: "20",
    renewal: day(12),
    url: "https://vercel.com/dashboard",
    keysLocation: "Vercel project env vars",
  }),
  p({
    id: "supabase",
    name: "Supabase",
    category: "Database",
    projects: ["mobile-app"],
    purpose: "Postgres, auth and file storage",
    plan: "Pro",
    cost: "25",
    url: "https://supabase.com/dashboard",
    keysLocation: "Local .env, server only",
  }),
  p({
    id: "stripe",
    name: "Stripe",
    category: "Payments",
    projects: ["storefront"],
    purpose: "Checkout and webhooks",
    period: "usage-based",
    url: "https://dashboard.stripe.com",
    notes: "Per-transaction fees, no monthly cost.",
  }),
  p({
    id: "resend",
    name: "Resend",
    category: "Email",
    projects: ["storefront", "mobile-app"],
    purpose: "Transactional email",
    plan: "Pro",
    cost: "20",
    url: "https://resend.com",
  }),
  p({
    id: "sentry",
    name: "Sentry",
    projects: ["storefront", "mobile-app"],
    purpose: "Error monitoring",
    plan: "Team",
    cost: "26",
    url: "https://sentry.io",
  }),
  p({
    id: "aws",
    name: "AWS",
    category: "Storage",
    projects: ["storefront", "internal-tools"],
    purpose: "S3 for uploads, SES for bulk email",
    period: "usage-based",
    cost: "35",
    url: "https://console.aws.amazon.com",
    notes: "Cost is a monthly estimate.",
  }),
  p({
    id: "github",
    name: "GitHub",
    category: "Source control",
    projects: ["storefront", "mobile-app", "internal-tools"],
    purpose: "Repos and CI",
    plan: "Free",
    period: "free",
    url: "https://github.com",
  }),
  p({
    id: "domain",
    name: "Domain registrar",
    category: "Domain / DNS",
    projects: ["storefront"],
    purpose: "example-shop.test",
    period: "yearly",
    cost: "12.99",
    renewal: day(300),
  }),
  p({
    id: "apple-developer",
    name: "Apple Developer Program",
    category: "Mobile build",
    projects: ["mobile-app"],
    purpose: "TestFlight and App Store",
    status: "planned",
    period: "yearly",
    cost: "99",
  }),
];

export const SECRETS_SEED = [
  secret({
    id: "stripe-key",
    name: "STRIPE_SECRET_KEY",
    provider: "stripe",
    projects: ["storefront"],
    envs: "local, vercel prod",
    value: "demo-not-a-real-secret-1",
    rotated: day(-100),
    rotateDays: "90",
    notes: "Overdue on purpose, to show the rotation reminder.",
  }),
  secret({
    id: "resend-key",
    name: "RESEND_API_KEY",
    provider: "resend",
    projects: ["storefront", "mobile-app"],
    envs: "local, vercel prod",
    value: "demo-not-a-real-secret-2",
    rotated: day(-20),
    rotateDays: "180",
  }),
  secret({
    id: "database-url",
    name: "DATABASE_URL",
    provider: "supabase",
    projects: ["mobile-app"],
    envs: "local",
    value: "demo-not-a-real-secret-3",
    rotated: day(-5),
    rotateDays: "365",
  }),
  secret({
    id: "aws-secret",
    name: "AWS_SECRET_ACCESS_KEY",
    provider: "aws",
    projects: ["storefront"],
    envs: "vercel prod",
    notes: "Not stored yet.",
  }),
];
