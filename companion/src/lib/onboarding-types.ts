export type VoiceMode = "speak" | "text";

export type Relationship = {
  name: string;
  relation: string;
  frequency: string;
};

export type ImportantDate = {
  label: string;
  date: string;
};

export type OnboardingForm = {
  fullName: string;
  preferredName: string;
  age: string;
  email: string;
  city: string;
  relationships: Relationship[];
  userBirthday: string;
  importantDates: ImportantDate[];
  hobbies: string;
  interests: string;
  healthGoals: string;
  medicationRoutine: string;
  morningCheckIn: boolean;
  checkInTime: string;
  caregiverName: string;
  caregiverEmail: string;
  caregiverPhone: string;
  voiceMode: VoiceMode;
  safetyConsent: boolean;
};

export type AgentPromptProfile = {
  schema_version: string;
  completed_at: string;
  onboarding_complete: boolean;
  user_profile: {
    identity: {
      full_name: string;
      preferred_name: string;
      age: number;
      email: string;
      city?: string;
    };
    important_people: Relationship[];
    important_dates: ImportantDate[];
    interests: string[];
    health_context: {
      goals: string;
      routines: string;
    };
    check_in_preferences: {
      morning_check_in: boolean;
      time: string;
    };
    caregiver: {
      name: string;
      email: string;
      phone: string;
    };
    voice_preferences: {
      response_mode: VoiceMode;
    };
    safety: {
      consent_given: boolean;
      crisis_protocol: "suggest_988_and_notify_caregiver";
    };
  };
  personality_signals: {
    communication_style: "warm";
    topics_user_likes: string[];
    social_orientation: "family_focused" | "general";
  };
  memory_seeds: Array<{
    type: string;
    value: string;
    priority: "high" | "medium";
  }>;
  system_prompt_template: string;
};
