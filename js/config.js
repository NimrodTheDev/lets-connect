// ---------------------------------------------------------------------------
// HandyHail configuration
// The anon key below is a public, RLS-protected key — safe to ship client-side.
// ---------------------------------------------------------------------------
export const SUPABASE_URL = "https://vogzjkdotepgrqcdabmu.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvZ3pqa2RvdGVwZ3JxY2RhYm11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5ODM1MDEsImV4cCI6MjEwMzU1OTUwMX0.gKIUJZcUorEYyMEBOZ4lKE0B7Vv0sx68GZ25f57vOd4";

export const APP_NAME = "At Your Service";
export const APP_SHORT_NAME = "At Your Service";
export const APP_TAGLINE = "Whatever you need. Whenever you need it.";

export const STORAGE_BUCKETS = {
  avatars: "avatars",
  portfolio: "portfolio",
  jobPhotos: "job-photos",
};
export const MAX_PHOTO_MB = 8;

export const SERVICE_CATEGORIES = [
  "Plumbing",
  "Electrical",
  "Carpentry",
  "Painting",
  "Cleaning / Maid Service",
  "AC & Appliance Repair",
  "Gardening & Landscaping",
  "Moving & Hauling",
  "Locksmith",
  "Pest Control",
  "Roofing",
  "Masonry & Tiling",
  "Auto Repair",
  "General Handyman",
  "Private Chef / Cooking",
  "Massage Therapy",
  "Barbering / Haircuts",
  "Beauty & Makeup",
  "Tutoring",
  "Childcare / Babysitting",
  "Pet Care",
  "Laundry & Ironing",
  "Event Planning & Catering",
  "Fitness Training",
  "Photography",
  "Tech Support",
  "Other",
];

export const RATE_UNITS = [
  { value: "hour", label: "per hour" },
  { value: "job", label: "per job" },
  { value: "day", label: "per day" },
  { value: "sqft", label: "per sq ft" },
];

// Default map center used before we know the user's location (fallback only).
export const DEFAULT_CENTER = { lat: 6.5244, lng: 3.3792 }; // Lagos — edit as needed
export const DEFAULT_ZOOM = 12;

// How far to look for pros / jobs, in kilometers, and the selectable options.
export const DEFAULT_RADIUS_KM = 15;
export const RADIUS_OPTIONS_KM = [2, 5, 10, 15, 25, 50, 100];

export const JOB_STATUS_LABELS = {
  open: "Open",
  accepted: "Accepted",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
  disputed: "Disputed",
};

export const DISPUTE_STATUS_LABELS = {
  open: "Open",
  under_review: "Under review",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

// Naira formatting — e.g. formatCurrency(15000) -> "₦15,000"
export function formatCurrency(amount) {
  if (amount === null || amount === undefined || amount === "") return "";
  const n = Number(amount);
  if (Number.isNaN(n)) return "";
  return "₦" + n.toLocaleString("en-NG", { maximumFractionDigits: 2 });
}
