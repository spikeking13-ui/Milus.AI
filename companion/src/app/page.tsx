"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isOnboardingComplete, loadAgentProfile } from "@/lib/onboarding-storage";

export default function Home() {
  const [ready, setReady] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [preferredName, setPreferredName] = useState("");

  useEffect(() => {
    const done = isOnboardingComplete();
    const profile = loadAgentProfile();
    setCompleted(done);
    setPreferredName(profile?.user_profile.identity.preferred_name ?? "");
    setReady(true);
  }, []);

  if (!ready) {
    return <main className="p-8">Loading...</main>;
  }

  return (
    <main className="milus-warm-gradient min-h-screen p-6 sm:p-10">
      <div className="mx-auto max-w-3xl rounded-2xl border border-stone-200 bg-white/92 p-6 shadow-sm sm:p-10">
        <h1 className="text-3xl font-semibold text-stone-900">Milus.AI Companion</h1>
        <p className="mt-2 text-stone-700">
          Personalized companion onboarding and demo shell.
        </p>

        {!completed ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-stone-700">
              Onboarding is required before chat and caregiver dashboard.
            </p>
            <Link
              href="/onboarding"
              className="inline-block rounded-xl bg-amber-600 px-4 py-2 text-white hover:bg-amber-700"
            >
              Start Onboarding
            </Link>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-stone-700">
              Welcome back{preferredName ? `, ${preferredName}` : ""}. Your onboarding profile is ready.
            </p>
            <div className="flex gap-3">
              <Link href="/chat" className="rounded-xl bg-emerald-700 px-4 py-2 text-white hover:bg-emerald-800">
                Open Chat
              </Link>
              <Link href="/caregiver" className="rounded-xl bg-amber-600 px-4 py-2 text-white hover:bg-amber-700">
                Open Caregiver Dashboard
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
