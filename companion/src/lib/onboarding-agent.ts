import { AgentPromptProfile, ImportantDate, OnboardingForm } from "@/lib/onboarding-types";

const DEMO_DATE_LABEL = "Sarah birthday";

function splitCommaList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function nextWeekIsoDate(): string {
  const now = new Date();
  now.setDate(now.getDate() + 7);
  return now.toISOString().slice(0, 10);
}

export function hasRequiredOnboardingFields(form: OnboardingForm): boolean {
  const hasIdentity = Boolean(
    form.fullName.trim() &&
      form.preferredName.trim() &&
      form.age.trim() &&
      form.email.trim(),
  );

  const hasRelationship = form.relationships.some(
    (person) => person.name.trim() && person.relation.trim(),
  );

  const hasCaregiver = Boolean(
    form.caregiverName.trim() &&
      form.caregiverEmail.trim() &&
      form.caregiverPhone.trim(),
  );

  return (
    hasIdentity &&
    hasRelationship &&
    hasCaregiver &&
    Boolean(form.voiceMode) &&
    form.safetyConsent
  );
}

export function buildAgentPromptProfile(form: OnboardingForm): AgentPromptProfile {
  const topics = [...splitCommaList(form.hobbies), ...splitCommaList(form.interests)];

  const importantDates: ImportantDate[] = [...form.importantDates];
  if (form.userBirthday) {
    importantDates.push({ label: "User birthday", date: form.userBirthday });
  }

  const hasSarahDate = importantDates.some(
    (item) => item.label.toLowerCase() === DEMO_DATE_LABEL.toLowerCase(),
  );
  if (!hasSarahDate) {
    importantDates.push({ label: DEMO_DATE_LABEL, date: nextWeekIsoDate() });
  }

  return {
    schema_version: "milus.onboarding.v1",
    completed_at: new Date().toISOString(),
    onboarding_complete: true,
    user_profile: {
      identity: {
        full_name: form.fullName.trim(),
        preferred_name: form.preferredName.trim(),
        age: Number(form.age),
        email: form.email.trim(),
        city: form.city.trim() || undefined,
      },
      important_people: form.relationships,
      important_dates: importantDates,
      interests: topics,
      health_context: {
        goals: form.healthGoals.trim(),
        routines: form.medicationRoutine.trim(),
      },
      check_in_preferences: {
        morning_check_in: form.morningCheckIn,
        time: form.checkInTime,
      },
      caregiver: {
        name: form.caregiverName.trim(),
        email: form.caregiverEmail.trim(),
        phone: form.caregiverPhone.trim(),
      },
      voice_preferences: {
        response_mode: form.voiceMode,
      },
      safety: {
        consent_given: form.safetyConsent,
        crisis_protocol: "suggest_988_and_notify_caregiver",
      },
    },
    personality_signals: {
      communication_style: "warm",
      topics_user_likes: topics,
      social_orientation: form.relationships.length > 0 ? "family_focused" : "general",
    },
    memory_seeds: [
      ...form.relationships.map((item) => ({
        type: "important_person",
        value: `${item.name} - ${item.relation}${item.frequency ? ` - ${item.frequency}` : ""}`,
        priority: "high" as const,
      })),
      ...topics.map((topic) => ({
        type: "interest",
        value: topic,
        priority: "medium" as const,
      })),
      {
        type: "demo_hook",
        value: "Sarah birthday is next week",
        priority: "high",
      },
    ],
    system_prompt_template:
      "You are Milus, a warm voice-first companion for an elderly user. Use memory naturally and proactively. Always reference known people, interests, and important dates when context fits. If distress is detected, respond empathetically, suggest calling 988, and trigger caregiver notification.",
  };
}
