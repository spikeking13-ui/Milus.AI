"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { loadAgentProfile } from "@/lib/onboarding-storage";

type MoodPoint = {
  day: string;
  score: number;
};

type CaregiverContact = {
  name: string;
  email: string;
  phone: string;
};

const demoMood: MoodPoint[] = [
  { day: "Mon", score: 61 },
  { day: "Tue", score: 65 },
  { day: "Wed", score: 58 },
  { day: "Thu", score: 69 },
  { day: "Fri", score: 74 },
  { day: "Sat", score: 71 },
  { day: "Sun", score: 78 },
];

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function buildLinePath(points: MoodPoint[]): string {
  if (points.length === 0) return "";

  const width = 320;
  const height = 110;
  const minY = 40;
  const maxY = 90;

  return points
    .map((point, idx) => {
      const x = (idx / Math.max(points.length - 1, 1)) * width;
      const normalized = (point.score - minY) / (maxY - minY);
      const y = height - normalized * height;
      return `${idx === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

export default function CaregiverPage() {
  const router = useRouter();
  const [userName, setUserName] = useState("User");
  const lastActive = "5 minutes ago";
  const [moodTodayLabel, setMoodTodayLabel] = useState("🙂 Positive");
  const [weeklySummary, setWeeklySummary] = useState(
    "Margaret had a good week. She talked about cooking for Sarah's visit and practiced Italian phrases.",
  );
  const [topics, setTopics] = useState<string[]>([
    "Cooking",
    "Family",
    "Italian Language",
    "Gardening",
  ]);
  const [alerts] = useState<string[]>(["Mood decline detected", "Low engagement yesterday"]);
  const [mood] = useState<MoodPoint[]>(demoMood);

  const [caregivers, setCaregivers] = useState<CaregiverContact[]>([]);
  const [draft, setDraft] = useState<CaregiverContact>({ name: "", email: "", phone: "" });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    const profile = loadAgentProfile();

    if (!profile?.onboarding_complete) {
      router.replace("/onboarding");
      return;
    }

    const preferredName = profile.user_profile.identity.preferred_name || "User";
    const fullName = profile.user_profile.identity.full_name || preferredName;
    setUserName(fullName);

    const caregiverSeed: CaregiverContact = {
      name: profile.user_profile.caregiver.name || "Not provided",
      email: profile.user_profile.caregiver.email || "Not provided",
      phone: profile.user_profile.caregiver.phone || "Not provided",
    };

    setCaregivers([caregiverSeed]);

    const baseTopics = profile.user_profile.interests
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 4)
      .map((item) => item[0].toUpperCase() + item.slice(1));

    if (baseTopics.length > 0) {
      setTopics(baseTopics);
    }

    setWeeklySummary(
      `${preferredName} had a positive week. They discussed ${
        baseTopics[0]?.toLowerCase() || "family plans"
      } and stayed engaged in daily conversations.`,
    );

    // Backend integration placeholders:
    // GET /api/caregiver/dashboard?userId=...
    // GET /api/caregiver/alerts?userId=...
    // GET /api/caregiver/topics?userId=...
    // GET /api/caregiver/weekly-summary?userId=...
  }, [router]);

  const moodTodayScore = mood[mood.length - 1]?.score ?? 70;
  const linePath = useMemo(() => buildLinePath(mood), [mood]);

  useEffect(() => {
    if (moodTodayScore >= 70) {
      setMoodTodayLabel("🙂 Positive");
      return;
    }
    if (moodTodayScore >= 55) {
      setMoodTodayLabel("😐 Stable");
      return;
    }
    setMoodTodayLabel("☹️ Concerning");
  }, [moodTodayScore]);

  function validateCaregiver(input: CaregiverContact): string {
    if (!input.name.trim()) return "Please provide caregiver name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
      return "Please provide a valid caregiver email.";
    }
    if (input.phone.replace(/\D/g, "").length < 10) {
      return "Please provide a valid 10-digit phone number.";
    }
    return "";
  }

  function handleSaveCaregiver() {
    const normalized: CaregiverContact = {
      name: draft.name.trim(),
      email: draft.email.trim(),
      phone: formatPhone(draft.phone),
    };

    const err = validateCaregiver(normalized);
    if (err) {
      setFormError(err);
      return;
    }

    setFormError("");

    if (editingIndex === null) {
      setCaregivers((prev) => [...prev, normalized]);
    } else {
      setCaregivers((prev) =>
        prev.map((item, idx) => (idx === editingIndex ? normalized : item)),
      );
    }

    setDraft({ name: "", email: "", phone: "" });
    setEditingIndex(null);

    // Backend integration placeholder:
    // POST /api/caregiver/contacts or PATCH /api/caregiver/contacts/:id
  }

  function handleEdit(index: number) {
    const item = caregivers[index];
    setDraft(item);
    setEditingIndex(index);
    setFormError("");
  }

  function handleRemove(index: number) {
    setCaregivers((prev) => prev.filter((_, idx) => idx !== index));

    if (editingIndex === index) {
      setDraft({ name: "", email: "", phone: "" });
      setEditingIndex(null);
      setFormError("");
    }

    // Backend integration placeholder:
    // DELETE /api/caregiver/contacts/:id
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50 to-white p-4 sm:p-8">
      <section className="mx-auto max-w-6xl rounded-3xl border border-zinc-200 bg-white shadow-sm">
        <header className="border-b border-zinc-200 px-5 py-5 sm:px-7">
          <h1 className="text-3xl font-semibold">Milus Care Dashboard 🌻</h1>
          <div className="mt-3 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-amber-50 p-4">
            <p className="text-lg font-medium">{userName}</p>
            <p className="text-sm text-zinc-600">Last active: {lastActive}</p>
            <p className="mt-2 text-base font-medium">Mood Today: {moodTodayLabel}</p>
          </div>
        </header>

        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6">
          <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-lg font-semibold">📈 Mood Trends (7 days)</h2>
            <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/40 p-3">
              <div className="mb-2 text-xs font-medium text-zinc-600">Mood Score (Y-Axis)</div>
              <svg viewBox="0 0 360 130" className="h-40 w-full" role="img" aria-label="Mood trend chart">
                <line x1="34" y1="10" x2="34" y2="112" stroke="#9ca3af" strokeWidth="1" />
                <line x1="34" y1="112" x2="350" y2="112" stroke="#e4e4e7" strokeWidth="1" />
                <text x="8" y="20" fontSize="10" fill="#6b7280">90</text>
                <text x="8" y="62" fontSize="10" fill="#6b7280">65</text>
                <text x="8" y="104" fontSize="10" fill="#6b7280">40</text>
                <line x1="34" y1="20" x2="350" y2="20" stroke="#f3f4f6" strokeWidth="1" />
                <line x1="34" y1="62" x2="350" y2="62" stroke="#f3f4f6" strokeWidth="1" />
                <line x1="34" y1="104" x2="350" y2="104" stroke="#f3f4f6" strokeWidth="1" />
                <g transform="translate(34,0)">
                  <path d={linePath} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" />
                </g>
                {mood.map((point, idx) => {
                  const x = 34 + (idx / Math.max(mood.length - 1, 1)) * 320;
                  const y = 110 - ((point.score - 40) / 50) * 110;
                  return <circle key={point.day} cx={x} cy={y} r="4" fill="#1d4ed8" />;
                })}
              </svg>
              <div className="mt-2 grid grid-cols-7 text-center text-xs text-zinc-500">
                {mood.map((point) => (
                  <span key={point.day}>{point.day}</span>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-lg font-semibold">📝 AI Weekly Summary</h2>
            <p className="mt-3 rounded-xl border border-blue-100 bg-blue-50/40 p-4 text-sm leading-relaxed text-zinc-800">
              {weeklySummary}
            </p>
          </section>

          <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-lg font-semibold">💡 Topic Insights</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {topics.map((topic) => (
                <li key={topic} className="rounded-xl border border-blue-100 bg-blue-50/40 px-3 py-2 text-sm">
                  • {topic}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-lg font-semibold">🚨 Alerts</h2>
            {alerts.length === 0 ? (
              <p className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">No active alerts.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {alerts.map((alert, idx) => (
                  <li key={`${alert}-${idx}`} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    ⚠ {alert}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="border-t border-amber-100 p-4 sm:p-6">
          <div className="rounded-2xl border border-blue-100 bg-white p-4 sm:p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Caregiver Settings</h2>

            <div className="mt-3 grid gap-2">
              {caregivers.length === 0 && (
                <p className="rounded-xl bg-white p-3 text-sm text-zinc-700">No caregiver saved.</p>
              )}

              {caregivers.map((item, idx) => (
                <div key={`${item.email}-${idx}`} className="rounded-xl border border-blue-100 bg-blue-50/40 p-3">
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-sm text-zinc-700">{item.email}</p>
                  <p className="text-sm text-zinc-700">{item.phone}</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleEdit(idx)}
                      className="rounded-lg border border-zinc-300 px-2 py-1 text-xs"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(idx)}
                      className="rounded-lg border border-zinc-300 px-2 py-1 text-xs"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <input
                className="rounded-xl border border-zinc-300 p-3 text-sm"
                placeholder="Caregiver name"
                value={draft.name}
                onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
              />
              <input
                className="rounded-xl border border-zinc-300 p-3 text-sm"
                placeholder="Caregiver email"
                value={draft.email}
                onChange={(e) => setDraft((prev) => ({ ...prev, email: e.target.value }))}
              />
              <input
                className="rounded-xl border border-zinc-300 p-3 text-sm"
                placeholder="Caregiver phone"
                value={draft.phone}
                onChange={(e) => setDraft((prev) => ({ ...prev, phone: e.target.value }))}
              />
            </div>

            {formError && <p className="mt-2 text-sm text-red-700">{formError}</p>}

            <button
              type="button"
              onClick={handleSaveCaregiver}
              className="mt-4 rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white"
            >
              {editingIndex === null ? "+ Add Caregiver" : "Save Caregiver"}
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}
