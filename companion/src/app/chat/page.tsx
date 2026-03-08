"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadAgentProfile } from "@/lib/onboarding-storage";

type ChatMode = "companion" | "cooking" | "creative" | "language";
type VoiceState = "idle" | "listening" | "thinking" | "speaking";

type ChatMessage = {
  id: number;
  role: "milus" | "user";
  text: string;
  pending?: boolean;
};

type SpeechRecognitionType = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechResultEvent = {
  results: ArrayLike<{
    0: { transcript: string };
    isFinal: boolean;
  }>;
};

const modeMeta: Record<ChatMode, { label: string; emoji: string; bg: string }> = {
  companion: { label: "Companion", emoji: "🧠", bg: "bg-emerald-100 text-emerald-900" },
  cooking: { label: "Cooking", emoji: "🍳", bg: "bg-amber-100 text-amber-900" },
  creative: { label: "Creative", emoji: "🎨", bg: "bg-pink-100 text-pink-900" },
  language: { label: "Language", emoji: "🗣", bg: "bg-sky-100 text-sky-900" },
};

function inferMode(text: string): ChatMode {
  const lower = text.toLowerCase();

  if (["cook", "recipe", "dinner", "pasta", "kitchen", "meal"].some((k) => lower.includes(k))) {
    return "cooking";
  }

  if (["italian", "spanish", "french", "language", "phrase", "translate", "vocabulary"].some((k) => lower.includes(k))) {
    return "language";
  }

  if (["poem", "story", "creative", "paint", "draw", "art", "write"].some((k) => lower.includes(k))) {
    return "creative";
  }

  return "companion";
}

function extractMemorySeeds(text: string): string[] {
  const lower = text.toLowerCase();
  const next: string[] = [];

  const enjoyPatterns = [/i love ([^.!?,]+)/, /i like ([^.!?,]+)/, /i enjoy ([^.!?,]+)/];
  for (const pattern of enjoyPatterns) {
    const m = lower.match(pattern);
    if (m?.[1]) next.push(`Enjoys ${m[1].trim()}`);
  }

  const learningMatch = lower.match(/i am learning ([^.!?,]+)/);
  if (learningMatch?.[1]) next.push(`Learning ${learningMatch[1].trim()}`);

  const personMatch = text.match(
    /my (daughter|son|friend|grandson|granddaughter|wife|husband|sister|brother) is ([A-Za-z][A-Za-z\-']+)/i,
  );
  if (personMatch?.[1] && personMatch?.[2]) {
    next.push(`${personMatch[2]} - ${personMatch[1].toLowerCase()}`);
  }

  return next;
}

function voiceStatusText(state: VoiceState): string {
  if (state === "listening") return "Listening...";
  if (state === "thinking") return "Thinking...";
  if (state === "speaking") return "Milus is speaking...";
  return "Hold to Speak";
}

function buildMeaningfulReply(
  userText: string,
  mode: ChatMode,
  memories: string[],
  recentUserTurns: string[],
): string {
  const lower = userText.toLowerCase();
  const memoryPerson = memories.find((item) => item.includes("-"));
  const isQuestion =
    userText.trim().endsWith("?") ||
    /^(what|how|why|when|where|can|could|should|would|is|are|do|did)\b/i.test(userText.trim());

  const distressTerms = ["hopeless", "hurt myself", "end it", "suicide", "alone", "panic"];
  if (distressTerms.some((term) => lower.includes(term))) {
    return "Thank you for telling me. You are not alone, and your safety matters. If you might act on these feelings, call 911 now. You can also call or text 988. I can notify your caregiver immediately.";
  }

  const anxiousTerms = ["anxious", "worried", "overwhelmed", "stressed", "sad", "down"];
  if (anxiousTerms.some((term) => lower.includes(term))) {
    return "I hear you, and I am with you. Let us make this easier right now: take one slow breath, then pick one tiny next step. If you want, I can suggest three gentle options.";
  }

  if (mode === "cooking") {
    if (lower.includes("pasta")) {
      return "Great choice. Quick pasta plan: 1) boil salted water and cook pasta, 2) sauté garlic with olive oil, 3) add tomatoes and a splash of pasta water, 4) toss and finish with herbs. Want a version for two people or for a family dinner?";
    }

    return memoryPerson
      ? `Love this. Since ${memoryPerson.replace("-", "is your")}, I can help you build a simple menu, a shopping list, and timing plan. Which one do you want first?`
      : "Love this. I can help with a simple menu, a shopping list, or a step-by-step recipe. Which one do you want first?";
  }

  if (mode === "language") {
    if (lower.includes("italian")) {
      return "Perfect. Let us do a short Italian set: Buongiorno (good morning), Come stai? (how are you?), Grazie mille (thank you very much). Want to practice by repeating after me with one mini quiz?";
    }

    return "Great direction. I can start with daily phrases, pronunciation, or a short practice dialogue. Which style feels best today?";
  }

  if (mode === "creative") {
    if (lower.includes("story")) {
      return "I love that. Give me a mood and a setting, and I will craft a strong opening paragraph. Then we can build the next scene together.";
    }

    return "Beautiful idea. We can create something in short steps so it feels easy and fun. Do you want a poem, a story, or a visual concept first?";
  }

  if (lower.includes("family") || lower.includes("daughter") || lower.includes("son")) {
    return memoryPerson
      ? `Thank you for sharing that. I remember ${memoryPerson.replace("-", "is your")}. Would you like help planning a thoughtful message, a call, or a visit?`
      : "Family sounds important today. I can help you plan a message, a call, or a visit. Which would feel best right now?";
  }

  if (isQuestion) {
    const topic = userText
      .replace(/[!?]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .slice(0, 5)
      .join(" ");

    return topic
      ? `Great question. On ${topic}, here is the simplest answer first, then I can personalize it for your situation. Do you want the short version or full step-by-step?`
      : "Great question. I can give you a short answer first, then personalize it. Do you want the quick version or detailed version?";
  }

  const recentContext = recentUserTurns.slice(-2).join(" ").toLowerCase();
  if (recentContext && recentContext !== lower) {
    return "That connects with what you shared earlier. A good next step is to choose one concrete action for today. Want me to suggest the best one based on your last two messages?";
  }

  return memoryPerson
    ? `I hear you. Since ${memoryPerson.replace("-", "is your")}, would you like to focus on family, your routine, or something just for you right now?`
    : "I hear you. I can help you move forward with one small next step. Do you want support with planning, learning, or just talking it through?";
}

export default function ChatPage() {
  const router = useRouter();
  const recognitionRef = useRef<SpeechRecognitionType | null>(null);
  const transcriptRef = useRef("");
  const messageIdRef = useRef(1);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const [preferredName, setPreferredName] = useState("friend");
  const [voiceMode, setVoiceMode] = useState<"speak" | "text">("speak");
  const [mode, setMode] = useState<ChatMode>("companion");
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [memories, setMemories] = useState<string[]>([]);
  const [summaryName, setSummaryName] = useState("Not set");
  const [summaryPerson, setSummaryPerson] = useState("Not set");
  const [summaryInterest, setSummaryInterest] = useState("Not set");
  const [summaryCheckIn, setSummaryCheckIn] = useState("08:00");
  const [summaryCaregiver, setSummaryCaregiver] = useState("Not set");
  const [voiceError, setVoiceError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const profile = loadAgentProfile();

    if (!profile?.onboarding_complete) {
      router.replace("/onboarding");
      return;
    }

    const seedMemories: string[] = [];
    profile.user_profile.important_people.forEach((person) => {
      seedMemories.push(`${person.name} - ${person.relation}`);
    });
    profile.user_profile.interests.forEach((interest) => {
      const trimmed = interest.trim();
      if (trimmed) seedMemories.push(`Enjoys ${trimmed}`);
    });

    const uniqueSeeds = Array.from(new Set(seedMemories)).slice(0, 8);
    const name = profile.user_profile.identity.preferred_name || "friend";

    setPreferredName(name);
    setVoiceMode(profile.user_profile.voice_preferences.response_mode);
    setMemories(uniqueSeeds);
    setSummaryName(profile.user_profile.identity.preferred_name || profile.user_profile.identity.full_name || "Not set");
    setSummaryPerson(
      profile.user_profile.important_people[0]
        ? `${profile.user_profile.important_people[0].name} - ${profile.user_profile.important_people[0].relation}`
        : "Not set",
    );
    setSummaryInterest(profile.user_profile.interests[0] || "Not set");
    setSummaryCheckIn(profile.user_profile.check_in_preferences.time || "08:00");
    setSummaryCaregiver(profile.user_profile.caregiver.name || "Not set");
    setMessages([
      {
        id: messageIdRef.current++,
        role: "milus",
        text: `Hi ${name}. I am here with you. What would you like to talk through today?`,
      },
    ]);
  }, [router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
      recognitionRef.current?.stop();
    };
  }, []);

  const modeConfig = useMemo(() => modeMeta[mode], [mode]);
  function speak(text: string) {
    if (voiceMode !== "speak" || typeof window === "undefined" || !window.speechSynthesis) {
      setVoiceState("idle");
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.94;
    utterance.pitch = 1;
    utterance.onend = () => setVoiceState("idle");
    utterance.onerror = () => setVoiceState("idle");

    setVoiceState("speaking");
    window.speechSynthesis.speak(utterance);
  }

  function streamAssistantReply(messageId: number, fullText: string) {
    let index = 0;

    const tick = () => {
      index += 3;
      const partial = fullText.slice(0, index);

      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, text: partial, pending: index < fullText.length } : msg)),
      );

      if (index < fullText.length) {
        window.setTimeout(tick, 16);
        return;
      }

      setIsGenerating(false);
      speak(fullText);
    };

    tick();
  }

  function handleSend(rawText?: string) {
    const text = (rawText ?? input).trim();
    if (!text || isGenerating) return;

    setVoiceError("");
    setInput("");

    const nextMode = inferMode(text);
    setMode(nextMode);

    const userMessage: ChatMessage = {
      id: messageIdRef.current++,
      role: "user",
      text,
    };

    const pendingId = messageIdRef.current++;
    const pendingMessage: ChatMessage = {
      id: pendingId,
      role: "milus",
      text: "",
      pending: true,
    };

    setMessages((prev) => [...prev, userMessage, pendingMessage]);
    setVoiceState("thinking");
    setIsGenerating(true);

    const learned = extractMemorySeeds(text);
    let memorySnapshot = memories;

    if (learned.length > 0) {
      const merged = Array.from(new Set([...memories, ...learned])).slice(0, 10);
      memorySnapshot = merged;
      setMemories(merged);
    }

    const recentUserTurns = messages
      .filter((m) => m.role === "user")
      .slice(-3)
      .map((m) => m.text);

    const reply = buildMeaningfulReply(text, nextMode, memorySnapshot, recentUserTurns);

    window.setTimeout(() => {
      streamAssistantReply(pendingId, reply);
    }, 280);

    // Backend integration placeholder:
    // await fetch('/api/conversation', { method: 'POST', body: JSON.stringify({ text, mode: nextMode }) });
  }

  function handleQuickPrompt(prompt: string) {
    handleSend(prompt);
  }

  function startHoldToSpeak() {
    if (isGenerating) return;
    setVoiceError("");

    const SpeechRecognitionCtor =
      typeof window !== "undefined"
        ? ((window as Window & { webkitSpeechRecognition?: new () => SpeechRecognitionType })
            .webkitSpeechRecognition ||
            (window as Window & { SpeechRecognition?: new () => SpeechRecognitionType })
              .SpeechRecognition)
        : undefined;

    if (!SpeechRecognitionCtor) {
      setVoiceError("Voice input is not available in this browser. Please type your message.");
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    transcriptRef.current = "";

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechResultEvent) => {
      const joined = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();
      transcriptRef.current = joined;
    };

    recognition.onerror = () => {
      setVoiceError("I could not hear that clearly. Please try again.");
      setVoiceState("idle");
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setVoiceState((prev) => (prev === "listening" ? "idle" : prev));
    };

    recognitionRef.current = recognition;
    setVoiceState("listening");
    recognition.start();
  }

  function stopHoldToSpeak() {
    const active = recognitionRef.current;
    if (!active) return;

    active.stop();
    recognitionRef.current = null;
    const transcript = transcriptRef.current.trim();

    if (transcript) {
      handleSend(transcript);
    } else {
      setVoiceState("idle");
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50 to-white px-3 py-4 sm:px-6 sm:py-8">
      <section className="mx-auto flex h-[calc(100vh-2rem)] max-w-5xl flex-col overflow-hidden rounded-3xl border border-amber-200 bg-white shadow-sm sm:h-[calc(100vh-4rem)]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-100 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold sm:text-2xl">Milus 🌻</h1>
            <span className={`rounded-full px-3 py-1 text-xs font-medium sm:text-sm ${modeConfig.bg}`}>
              {modeConfig.emoji} {modeConfig.label}
            </span>
          </div>
          <p className="text-xs text-zinc-600 sm:text-sm">{voiceStatusText(voiceState)}</p>
        </header>

        <div className="flex-1 overflow-y-auto bg-zinc-50 px-3 py-4 sm:px-6 sm:py-6">
          <div className="mx-auto max-w-3xl">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Your Companion Summary
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl bg-zinc-50 px-3 py-2 text-sm text-zinc-800">
                  Name: <span className="font-medium">{summaryName}</span>
                </div>
                <div className="rounded-xl bg-zinc-50 px-3 py-2 text-sm text-zinc-800">
                  Key Person: <span className="font-medium">{summaryPerson}</span>
                </div>
                <div className="rounded-xl bg-zinc-50 px-3 py-2 text-sm text-zinc-800">
                  Interest: <span className="font-medium">{summaryInterest}</span>
                </div>
                <div className="rounded-xl bg-zinc-50 px-3 py-2 text-sm text-zinc-800">
                  Daily Check-In: <span className="font-medium">{summaryCheckIn}</span>
                </div>
                <div className="rounded-xl bg-zinc-50 px-3 py-2 text-sm text-zinc-800 sm:col-span-2">
                  Caregiver: <span className="font-medium">{summaryCaregiver}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-4 font-default-ui">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed sm:text-base ${
                      message.role === "user"
                        ? "bg-zinc-900 text-white"
                        : "border border-zinc-200 bg-white text-zinc-900"
                    }`}
                  >
                    {message.pending && !message.text ? (
                      <span className="inline-flex items-center gap-1 text-zinc-500">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-zinc-400" />
                        <span className="h-2 w-2 animate-pulse rounded-full bg-zinc-400 [animation-delay:120ms]" />
                        <span className="h-2 w-2 animate-pulse rounded-full bg-zinc-400 [animation-delay:240ms]" />
                      </span>
                    ) : (
                      message.text
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div ref={messagesEndRef} />
          </div>
        </div>

        <footer className="border-t border-amber-100 bg-white px-3 py-4 sm:px-6 sm:py-5">
          <div className="mx-auto max-w-3xl font-default-ui">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onMouseDown={startHoldToSpeak}
                onMouseUp={stopHoldToSpeak}
                onMouseLeave={stopHoldToSpeak}
                onTouchStart={startHoldToSpeak}
                onTouchEnd={stopHoldToSpeak}
                disabled={isGenerating}
                className={`flex h-12 w-12 items-center justify-center rounded-full text-lg text-white shadow-sm disabled:opacity-50 ${
                  voiceState === "listening" ? "bg-red-600" : "bg-zinc-900"
                }`}
                aria-label="Hold to speak"
              >
                🎤
              </button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSend();
                }}
                placeholder={`Message Milus, ${preferredName}...`}
                disabled={isGenerating}
                className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none focus:border-zinc-400 disabled:opacity-50 sm:text-base"
              />
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={isGenerating}
                className="rounded-xl bg-zinc-900 px-4 py-3 text-sm text-white disabled:opacity-50"
              >
                Send
              </button>
            </div>

            {voiceError && <p className="mt-2 text-sm text-red-700">{voiceError}</p>}

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleQuickPrompt("Let us talk about my family today.")}
                className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs sm:text-sm"
              >
                💬 Family
              </button>
              <button
                type="button"
                onClick={() => handleQuickPrompt("How do I cook pasta for dinner?")}
                className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs sm:text-sm"
              >
                🍳 Cooking
              </button>
              <button
                type="button"
                onClick={() => handleQuickPrompt("Can we practice simple Italian phrases?")}
                className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs sm:text-sm"
              >
                📚 Language
              </button>
              <button
                type="button"
                onClick={() => handleQuickPrompt("I love jazz music.")}
                className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs sm:text-sm"
              >
                🧠 Memory
              </button>
            </div>
          </div>
        </footer>
      </section>
    </main>
  );
}
