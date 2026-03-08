"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { STYLES } from "@/lib/styles";

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
    const fetchProfile = async () => {
      const res = await fetch("/api/usr_data?type=profile");
      const profile = await res.json();
      
      if (!profile) {
        router.replace("/onboarding");
        return;
      }

      const preferredName = profile.preferredName || "User";
      const fullName = profile.fullName || preferredName;
      setUserName(fullName);

      const caregiverSeed: CaregiverContact = {
        name: profile.caregiverName || "Not provided",
        email: profile.caregiverEmail || "Not provided",
        phone: profile.caregiverPhone || "Not provided",
      };

      setCaregivers([caregiverSeed]);

      const baseTopics = (profile.interests || "")
        .split(",")
        .map((item: string) => item.trim())
        .filter(Boolean)
        .slice(0, 4)
        .map((item: string) => item[0].toUpperCase() + item.slice(1));

      if (baseTopics.length > 0) {
        setTopics(baseTopics);
      }

      setWeeklySummary(
        `${preferredName} had a positive week. They discussed ${
          baseTopics[0]?.toLowerCase() || "family plans"
        } and stayed engaged in daily conversations.`,
      );
    };

    fetchProfile();
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
    <div className={STYLES.pageWrapper}>
      <header className={STYLES.header}>
        <h1 className={STYLES.title}>Caregiver Dashboard</h1>
        <div className="flex items-center gap-4">
          <p className={STYLES.subtitle}>Last active: {lastActive}</p>
          <button onClick={() => router.push("/chat")} className={STYLES.buttonSecondary}>Back to Chat</button>
        </div>
      </header>

      <main className={STYLES.mainContent}>
        <div className={STYLES.containerMaxWidth}>
          <div className={STYLES.gridTwoCol}>
            {/* Summary Card */}
            <div className={STYLES.card}>
              <p className={STYLES.cardTitle}>Weekly Summary</p>
              <p className="text-stone-700 leading-relaxed">{weeklySummary}</p>
            </div>

            {/* Mood Card */}
            <div className={STYLES.card}>
              <p className={STYLES.cardTitle}>Mood Today: {moodTodayLabel}</p>
              <div className="h-32 w-full bg-stone-50 rounded-xl flex items-end p-2 gap-1">
                {mood.map((p, i) => (
                  <div 
                    key={i} 
                    className="flex-1 bg-emerald-500 rounded-t-sm transition-all" 
                    style={{ height: `${p.score}%` }}
                    title={`${p.day}: ${p.score}`}
                  />
                ))}
              </div>
            </div>

            {/* Topics Card */}
            <div className={STYLES.card}>
              <p className={STYLES.cardTitle}>Recent Topics</p>
              <div className="flex flex-wrap gap-2">
                {topics.map((t, i) => (
                  <span key={i} className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-sm font-medium">
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* Alerts Card */}
            <div className={STYLES.card}>
              <p className={STYLES.cardTitle}>Alerts</p>
              <div className="space-y-2">
                {alerts.map((a, i) => (
                  <div key={i} className="p-3 bg-red-50 border border-red-100 text-red-700 rounded-xl text-sm flex items-center gap-2">
                    <span className="h-2 w-2 bg-red-500 rounded-full animate-pulse" />
                    {a}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Caregiver Contact Card */}
          <div className={STYLES.card + " mt-6"}>
            <p className={STYLES.cardTitle}>Caregiver Contact</p>
            {caregivers.map((c, i) => (
              <div key={i} className="flex flex-wrap gap-6 text-stone-700">
                <div><span className="text-stone-400 text-xs block uppercase">Name</span> {c.name}</div>
                <div><span className="text-stone-400 text-xs block uppercase">Email</span> {c.email}</div>
                <div><span className="text-stone-400 text-xs block uppercase">Phone</span> {c.phone}</div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
