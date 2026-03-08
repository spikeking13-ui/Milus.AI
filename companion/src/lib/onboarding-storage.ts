import { AgentPromptProfile, OnboardingForm } from "@/lib/onboarding-types";

export const ONBOARDING_FORM_KEY = "milus_onboarding_form_v1";
export const AGENT_PROFILE_KEY = "milus_agent_profile_v1";
export const ONBOARDING_COMPLETE_KEY = "milus_onboarding_complete_v1";

export function saveOnboardingForm(form: OnboardingForm): void {
  localStorage.setItem(ONBOARDING_FORM_KEY, JSON.stringify(form));
}

export function loadOnboardingForm(): OnboardingForm | null {
  const raw = localStorage.getItem(ONBOARDING_FORM_KEY);
  return raw ? (JSON.parse(raw) as OnboardingForm) : null;
}

export function saveAgentProfile(profile: AgentPromptProfile): void {
  localStorage.setItem(AGENT_PROFILE_KEY, JSON.stringify(profile));
  localStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
}

export function loadAgentProfile(): AgentPromptProfile | null {
  const raw = localStorage.getItem(AGENT_PROFILE_KEY);
  return raw ? (JSON.parse(raw) as AgentPromptProfile) : null;
}

export function isOnboardingComplete(): boolean {
  return localStorage.getItem(ONBOARDING_COMPLETE_KEY) === "true";
}
