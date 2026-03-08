"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  buildAgentPromptProfile,
  hasRequiredOnboardingFields,
} from "@/lib/onboarding-agent";
import {
  isOnboardingComplete,
  loadOnboardingForm,
  saveAgentProfile,
  saveOnboardingForm,
} from "@/lib/onboarding-storage";
import { OnboardingForm, Relationship } from "@/lib/onboarding-types";

type SpeechRecognitionType = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
};

type SpeechResultEvent = {
  results: ArrayLike<{
    0: { transcript: string };
    isFinal: boolean;
  }>;
};

type PromptKey =
  | "fullName"
  | "preferredName"
  | "age"
  | "email"
  | "cityOptional"
  | "person"
  | "datesOptional"
  | "interests"
  | "healthOptional"
  | "checkIn"
  | "checkInTime"
  | "caregiverName"
  | "caregiverEmail"
  | "caregiverPhone"
  | "voice"
  | "safety";

type Message = {
  role: "agent" | "user";
  text: string;
};

type FlowFlags = {
  askedCity: boolean;
  askedDates: boolean;
  askedHealth: boolean;
  askedCheckIn: boolean;
  askedVoice: boolean;
};

const defaultForm: OnboardingForm = {
  fullName: "",
  preferredName: "",
  age: "",
  email: "",
  city: "",
  relationships: [],
  userBirthday: "",
  importantDates: [],
  hobbies: "",
  interests: "",
  healthGoals: "",
  medicationRoutine: "",
  morningCheckIn: true,
  checkInTime: "08:00",
  caregiverName: "",
  caregiverEmail: "",
  caregiverPhone: "",
  voiceMode: "speak",
  safetyConsent: false,
};

const defaultFlags: FlowFlags = {
  askedCity: false,
  askedDates: false,
  askedHealth: false,
  askedCheckIn: false,
  askedVoice: false,
};

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isSkip(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("skip") ||
    lower.includes("prefer not") ||
    lower.includes("rather not") ||
    lower.includes("no thanks")
  );
}

function parseAge(text: string): string | null {
  const m = text.match(/\b(\d{1,3})\b/);
  if (!m) return null;
  const age = Number(m[1]);
  if (age <= 0 || age > 120) return null;
  return String(age);
}

function parseEmail(text: string): string | null {
  const m = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m ? m[0] : null;
}

function parsePhone(text: string): string | null {
  const digits = text.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const ten = digits.slice(-10);
  return `${ten.slice(0, 3)}-${ten.slice(3, 6)}-${ten.slice(6)}`;
}

function parseYesNo(text: string): "yes" | "no" | null {
  const lower = text.toLowerCase();
  const yes = ["yes", "yeah", "yep", "sure", "please do", "of course", "ok", "okay"];
  const no = ["no", "nope", "dont", "don't", "not now", "text only"];

  if (yes.some((x) => lower.includes(x))) return "yes";
  if (no.some((x) => lower.includes(x))) return "no";
  return null;
}

function parseTime(text: string): string | null {
  const lower = text.toLowerCase();
  const hhmm = lower.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (hhmm) return `${hhmm[1].padStart(2, "0")}:${hhmm[2]}`;

  const ampm = lower.match(/\b(1[0-2]|0?[1-9])\s*(am|pm)\b/);
  if (!ampm) return null;
  let hour = Number(ampm[1]);
  const meridiem = ampm[2];
  if (meridiem === "pm" && hour !== 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:00`;
}

function parseRelationship(text: string): Relationship | null {
  const rel = "daughter|son|spouse|wife|husband|friend|grandson|granddaughter|sister|brother";

  const m1 = text.match(new RegExp(`\\b([A-Z][a-zA-Z'-]+)\\b\\s+is my\\s+(${rel})`, "i"));
  if (m1) {
    return { name: m1[1], relation: m1[2].toLowerCase(), frequency: "" };
  }

  const m2 = text.match(new RegExp(`my\\s+(${rel})\\s+is\\s+([A-Z][a-zA-Z'-]+)`, "i"));
  if (m2) {
    return { name: m2[2], relation: m2[1].toLowerCase(), frequency: "" };
  }

  const comma = text.split(",").map((x) => x.trim());
  if (comma.length >= 2 && /^[A-Za-z][A-Za-z' -]+$/.test(comma[0])) {
    return { name: comma[0], relation: comma[1].toLowerCase(), frequency: "" };
  }

  return null;
}

function parseImportantDate(text: string): { label: string; date: string } | null {
  const m = text.match(/(.+?)\s+on\s+(\d{4}-\d{2}-\d{2})/i);
  if (!m) return null;
  return { label: m[1].trim(), date: m[2] };
}

function nextPrompt(form: OnboardingForm, flags: FlowFlags): PromptKey | null {
  if (!form.fullName.trim()) return "fullName";
  if (!form.email.trim()) return "email";
  if (!form.preferredName.trim()) return "preferredName";
  if (!form.age.trim()) return "age";

  if (!flags.askedCity) return "cityOptional";
  if (form.relationships.length === 0) return "person";
  if (!flags.askedDates) return "datesOptional";
  if (!form.hobbies.trim() && !form.interests.trim()) return "interests";
  if (!flags.askedHealth) return "healthOptional";

  if (!flags.askedCheckIn) return "checkIn";
  if (form.morningCheckIn && !form.checkInTime.trim()) return "checkInTime";

  if (!form.caregiverName.trim()) return "caregiverName";
  if (!form.caregiverEmail.trim()) return "caregiverEmail";
  if (!form.caregiverPhone.trim()) return "caregiverPhone";

  if (!flags.askedVoice) return "voice";
  if (!form.safetyConsent) return "safety";

  return null;
}

function promptText(key: PromptKey, preferredName: string): string {
  if (key === "fullName") return "To start, what is your full name?";
  if (key === "preferredName") return "What would you like me to call you?";
  if (key === "age") return `Nice to meet you, ${preferredName || "friend"}. How old are you?`;
  if (key === "email") return "What email should I use for your account?";
  if (key === "cityOptional") return "What city do you live in? You can say skip.";
  if (key === "person") return "Tell me one important person in your life, like 'Sarah is my daughter'.";
  if (key === "datesOptional") return "Any important date I should remember? You can say 'Sarah birthday on 2026-03-20' or skip.";
  if (key === "interests") return "What do you enjoy lately?";
  if (key === "healthOptional") return "Any health goal or routine you want gentle support with? You can skip.";
  if (key === "checkIn") return "Would you like a morning check-in each day?";
  if (key === "checkInTime") return "What time should I check in?";
  if (key === "caregiverName") return "Who should I contact if you need support?";
  if (key === "caregiverEmail") return "What is their email?";
  if (key === "caregiverPhone") return "What is their phone number?";
  if (key === "voice") return "Should I speak my replies out loud, or keep text only?";
  return "If you sound distressed, I may suggest 988 and notify your caregiver. Is that okay?";
}

export default function OnboardingPage() {
  const router = useRouter();
  const didInit = useRef(false);

  const [form, setForm] = useState<OnboardingForm>(defaultForm);
  const [flags, setFlags] = useState<FlowFlags>(defaultFlags);
  const [currentPrompt, setCurrentPrompt] = useState<PromptKey | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [finished, setFinished] = useState(false);
  const [awaitingReply, setAwaitingReply] = useState(false);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    if (isOnboardingComplete()) {
      router.replace("/chat");
      return;
    }

    const saved = loadOnboardingForm();
    if (saved) {
      setForm(saved);
      setFlags((prev) => ({
        ...prev,
        askedCity: Boolean(saved.city),
        askedDates: saved.importantDates.length > 0 || Boolean(saved.userBirthday),
        askedHealth: Boolean(saved.healthGoals || saved.medicationRoutine),
        askedCheckIn: true,
        askedVoice: true,
      }));
    }

    setMessages([]);
  }, [router]);

  useEffect(() => {
    saveOnboardingForm(form);
  }, [form]);

  useEffect(() => {
    if (finished) return;
    if (awaitingReply) return;

    const next = nextPrompt(form, flags);
    if (next === currentPrompt) return;

    setCurrentPrompt(next);

    if (!next) return;

    const question = promptText(next, form.preferredName || "friend");
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === "agent" && last.text === question) return prev;
      return [...prev, { role: "agent", text: question }];
    });
    setAwaitingReply(true);
  }, [form, flags, currentPrompt, finished, awaitingReply]);

  const canFinish = useMemo(() => hasRequiredOnboardingFields(form), [form]);

  function addAgent(text: string) {
    setMessages((prev) => [...prev, { role: "agent", text }]);
  }

  function startVoiceInput() {
    const SpeechRecognitionCtor =
      typeof window !== "undefined"
        ? ((window as Window & { webkitSpeechRecognition?: new () => SpeechRecognitionType })
            .webkitSpeechRecognition ||
            (window as Window & { SpeechRecognition?: new () => SpeechRecognitionType })
              .SpeechRecognition)
        : undefined;

    if (!SpeechRecognitionCtor) {
      setError("Voice input is not available in this browser. You can type instead.");
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    setIsListening(true);

    recognition.onresult = (event: SpeechResultEvent) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (transcript) setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };

    recognition.onerror = () => {
      setIsListening(false);
      setError("I could not hear that clearly. Please try again.");
    };

    recognition.onend = () => setIsListening(false);
    recognition.start();
  }

  function finalizeIfReady(updatedForm: OnboardingForm) {
    if (!hasRequiredOnboardingFields(updatedForm)) return;

    const profile = buildAgentPromptProfile(updatedForm);
    saveAgentProfile(profile);
    setFinished(true);
    addAgent(`Thank you ${updatedForm.preferredName || "friend"}. You are all set. Goodbye for now.`);

    window.setTimeout(() => {
      router.replace("/chat");
    }, 1600);
  }

  function handleSend() {
    const text = input.trim();
    if (!text || !currentPrompt || finished) return;

    setError("");
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);

    const updatedForm: OnboardingForm = {
      ...form,
      relationships: [...form.relationships],
      importantDates: [...form.importantDates],
    };
    const updatedFlags: FlowFlags = { ...flags };

    if (currentPrompt === "fullName") {
      updatedForm.fullName = text;
      setForm(updatedForm);
      addAgent("Lovely to meet you.");
      setAwaitingReply(false);
      return;
    }

    if (currentPrompt === "preferredName") {
      updatedForm.preferredName = text;
      setForm(updatedForm);
      addAgent(`Great, I will call you ${text}.`);
      setAwaitingReply(false);
      return;
    }

    if (currentPrompt === "age") {
      const age = parseAge(text);
      if (!age) return addAgent("Could you share your age as a number? Take your time.");
      updatedForm.age = age;
      setForm(updatedForm);
      addAgent("Thank you for sharing that.");
      setAwaitingReply(false);
      return;
    }

    if (currentPrompt === "email") {
      const email = parseEmail(text);
      if (!email || !isValidEmail(email)) return addAgent("Could you share a valid email address?");
      updatedForm.email = email;
      setForm(updatedForm);
      addAgent("Perfect.");
      setAwaitingReply(false);
      return;
    }

    if (currentPrompt === "cityOptional") {
      updatedFlags.askedCity = true;
      if (!isSkip(text)) {
        updatedForm.city = text;
      }
      setFlags(updatedFlags);
      setForm(updatedForm);
      addAgent("Thanks, that helps me understand your world a bit better.");
      setAwaitingReply(false);
      return;
    }

    if (currentPrompt === "person") {
      const parsed = parseRelationship(text);
      if (!parsed) {
        return addAgent("I want to capture that correctly. You can say something like 'Sarah is my daughter'.");
      }
      updatedForm.relationships.push(parsed);
      setForm(updatedForm);
      addAgent(`Thank you. I will remember that ${parsed.name} is your ${parsed.relation}.`);
      setAwaitingReply(false);
      return;
    }

    if (currentPrompt === "datesOptional") {
      updatedFlags.askedDates = true;
      if (!isSkip(text)) {
        const parsedDate = parseImportantDate(text);
        if (parsedDate) {
          updatedForm.importantDates.push(parsedDate);
          addAgent(`Got it. I will remember ${parsedDate.label} on ${parsedDate.date}.`);
        } else {
          addAgent("No worries, we can always add important dates later.");
        }
      } else {
        addAgent("No worries, we can add dates later.");
      }
      setFlags(updatedFlags);
      setForm(updatedForm);
      setAwaitingReply(false);
      return;
    }

    if (currentPrompt === "interests") {
      updatedForm.hobbies = text;
      setForm(updatedForm);
      addAgent("I love that. This helps me personalize our conversations.");
      setAwaitingReply(false);
      return;
    }

    if (currentPrompt === "healthOptional") {
      updatedFlags.askedHealth = true;
      if (!isSkip(text)) {
        updatedForm.healthGoals = text;
      }
      setFlags(updatedFlags);
      setForm(updatedForm);
      addAgent("Thank you. I will support you gently with that.");
      setAwaitingReply(false);
      return;
    }

    if (currentPrompt === "checkIn") {
      const yn = parseYesNo(text);
      if (!yn) return addAgent("Would you like morning check-ins? A simple yes or no is perfect.");
      updatedFlags.askedCheckIn = true;
      updatedForm.morningCheckIn = yn === "yes";
      setFlags(updatedFlags);
      setForm(updatedForm);
      addAgent(
        updatedForm.morningCheckIn
          ? "Wonderful, I will check in each morning."
          : "Absolutely, I will wait for you to start conversations.",
      );
      setAwaitingReply(false);
      return;
    }

    if (currentPrompt === "checkInTime") {
      const t = parseTime(text);
      if (!t) return addAgent("Could you share a time like 8:00 AM or 08:00?");
      updatedForm.checkInTime = t;
      setForm(updatedForm);
      addAgent(`Perfect. I will check in around ${t}.`);
      setAwaitingReply(false);
      return;
    }

    if (currentPrompt === "caregiverName") {
      updatedForm.caregiverName = text;
      setForm(updatedForm);
      addAgent("Thank you. I have their name.");
      setAwaitingReply(false);
      return;
    }

    if (currentPrompt === "caregiverEmail") {
      const email = parseEmail(text);
      if (!email || !isValidEmail(email)) return addAgent("Could you share a valid caregiver email?");
      updatedForm.caregiverEmail = email;
      setForm(updatedForm);
      addAgent("Great, thank you.");
      setAwaitingReply(false);
      return;
    }

    if (currentPrompt === "caregiverPhone") {
      const phone = parsePhone(text);
      if (!phone) return addAgent("Could you share a 10-digit phone number?");
      updatedForm.caregiverPhone = phone;
      setForm(updatedForm);
      addAgent("Perfect, I have that too.");
      setAwaitingReply(false);
      return;
    }

    if (currentPrompt === "voice") {
      updatedFlags.askedVoice = true;
      const lower = text.toLowerCase();
      updatedForm.voiceMode = lower.includes("text") || lower.includes("silent") ? "text" : "speak";
      setFlags(updatedFlags);
      setForm(updatedForm);
      addAgent(
        updatedForm.voiceMode === "speak"
          ? "Wonderful, I will speak responses."
          : "Absolutely, I will keep responses in text.",
      );
      setAwaitingReply(false);
      return;
    }

    if (currentPrompt === "safety") {
      const yn = parseYesNo(text);
      if (yn !== "yes") {
        return addAgent("To finish setup, I need a clear yes for safety consent.");
      }
      updatedForm.safetyConsent = true;
      setForm(updatedForm);
      addAgent("Thank you. Safety consent is confirmed.");
      setAwaitingReply(false);
      finalizeIfReady(updatedForm);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50 to-white p-4 sm:p-8">
      <section className="mx-auto max-w-4xl rounded-3xl border border-amber-200 bg-white shadow-sm">
        <header className="border-b border-amber-100 px-5 py-5 sm:px-7">
          <h1 className="text-3xl font-semibold">Milus Onboarding</h1>
          <p className="mt-1 text-sm text-zinc-700">
            A natural conversation. Milus collects your preferences quietly in the background.
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            {canFinish ? "Profile ready to complete" : "Building your companion profile"}
          </p>
        </header>

        <div className="p-4 sm:p-6">
          <div className="max-h-[58vh] space-y-3 overflow-y-auto rounded-2xl bg-zinc-50 p-4">
            {messages.map((message, idx) => (
              <div
                key={`${message.role}-${idx}`}
                className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm sm:max-w-[78%] ${
                  message.role === "agent"
                    ? "bg-white text-zinc-800"
                    : "ml-auto bg-amber-200 text-zinc-900"
                }`}
              >
                {message.text}
              </div>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend();
              }}
              placeholder={finished ? "Onboarding complete" : "Type your reply..."}
              disabled={finished}
              className="w-full rounded-xl border border-zinc-300 p-3 text-sm disabled:opacity-50"
            />
            <button
              type="button"
              onClick={startVoiceInput}
              disabled={finished}
              className={`rounded-xl px-3 py-2 text-sm text-white disabled:opacity-50 ${
                isListening ? "bg-red-600" : "bg-zinc-700"
              }`}
            >
              {isListening ? "Listening" : "Mic"}
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={finished}
              className="rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              Send
            </button>
          </div>

          {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
        </div>
      </section>
    </main>
  );
}
