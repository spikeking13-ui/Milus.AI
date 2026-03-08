"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { STYLES } from "@/lib/styles";

type ChatMode = "companion" | "cooking" | "creative" | "language";
type VoiceState = "idle" | "listening" | "thinking" | "speaking";

type Message = {
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
  if (["cook", "recipe", "dinner", "pasta", "kitchen", "meal"].some((k) => lower.includes(k))) return "cooking";
  if (["italian", "spanish", "french", "language", "phrase", "translate", "vocabulary"].some((k) => lower.includes(k))) return "language";
  if (["poem", "story", "creative", "paint", "draw", "art", "write"].some((k) => lower.includes(k))) return "creative";
  return "companion";
}

function voiceStatusText(state: VoiceState): string {
  if (state === "listening") return "Listening...";
  if (state === "thinking") return "Thinking...";
  if (state === "speaking") return "Milus is speaking...";
  return "Hold to Speak";
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [voiceError, setVoiceError] = useState("");

  // Summary states
  const [summaryName, setSummaryName] = useState("Not set");
  const [summaryPerson, setSummaryPerson] = useState("Not set");
  const [summaryInterest, setSummaryInterest] = useState("Not set");
  const [summaryCheckIn, setSummaryCheckIn] = useState("08:00");
  const [summaryCaregiver, setSummaryCaregiver] = useState("Not set");

  useEffect(() => {
    const checkProfile = async () => {
      const res = await fetch("/api/usr_data?type=profile");
      const profile = await res.json();
      if (!profile) {
        router.replace("/onboarding");
        return;
      }

      const name = profile.preferredName || profile.fullName || "friend";
      setPreferredName(name);
      setSummaryName(name);
      setSummaryPerson(profile.relationships?.[0] ? `${profile.relationships[0].name} (${profile.relationships[0].relation})` : "Not set");
      setSummaryInterest(profile.interests || "Not set");
      setSummaryCheckIn(profile.checkInTime || "08:00");
      setSummaryCaregiver(profile.caregiverName || "Not set");
      setVoiceMode(profile.voiceMode || "speak");

      setMessages([
        {
          id: messageIdRef.current++,
          role: "milus",
          text: `Hi ${name}. I am here with you. What would you like to talk through today?`,
        },
      ]);

      // Trigger conversation starter
      handleConversationStarter(name, profile.hobbies);
    };
    checkProfile();
  }, [router]);

  const handleConversationStarter = async (name: string, hobbies: string) => {
    setIsThinking(true);
    setVoiceState("thinking");
      // TODO: Add customization to user JSON
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          messages: [
            { 
              role: "system", 
              content: `You are Milus. The user ${name} just opened the chat. Their hobbies are: ${hobbies}. 
              Start the conversation with a warm, personalized greeting and a question or suggestion related to their hobbies or how they are feeling.` 
            }
          ] 
        }),
      });

      if (!response.ok) throw new Error("Failed to fetch starter");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";
      const pendingId = messageIdRef.current++;
      setMessages(prev => [...prev, { id: pendingId, role: "milus", text: "", pending: true }]);

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;
        const chunk = decoder.decode(value);
        assistantText += chunk;
        setMessages(prev => prev.map(m => m.id === pendingId ? { ...m, text: assistantText, pending: false } : m));
      }
      speak(assistantText);
    } catch (error) {
      console.error(error);
    } finally {
      setIsThinking(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const speak = (text: string) => {
    if (voiceMode !== "speak" || typeof window === "undefined" || !window.speechSynthesis) {
      setVoiceState("idle");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/<[^>]*>/g, ""));
    utterance.onend = () => setVoiceState("idle");
    utterance.onerror = () => setVoiceState("idle");
    setVoiceState("speaking");
    window.speechSynthesis.speak(utterance);
  };

  const handleSend = async (rawText?: string) => {
    const text = (rawText ?? input).trim();
    if (!text || isThinking) return;

    setInput("");
    setVoiceError("");
    setMode(inferMode(text));

    const userMsg: Message = { id: messageIdRef.current++, role: "user", text };
    const pendingId = messageIdRef.current++;
    setMessages(prev => [...prev, userMsg, { id: pendingId, role: "milus", text: "", pending: true }]);
    
    setIsThinking(true);
    setVoiceState("thinking");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          messages: [...messages, userMsg].map(m => ({ 
            role: m.role === "milus" ? "assistant" : "user", 
            content: m.text 
          })) 
        }),
      });

      if (!response.ok) throw new Error("Failed to fetch");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;
        const chunk = decoder.decode(value);
        assistantText += chunk;
        setMessages(prev => prev.map(m => m.id === pendingId ? { ...m, text: assistantText, pending: false } : m));
      }

      speak(assistantText);

      // Save conversation
      const convName = text.slice(0, 10) || "chat";
      await fetch("/api/usr_data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          type: "conversation", 
          name: convName, 
          data: { name: convName, messages: [...messages, userMsg, { role: "milus", text: assistantText }] } 
        }),
      });

    } catch (error) {
      console.error(error);
      setVoiceError("Sorry, I had trouble connecting. Please try again.");
    } finally {
      setIsThinking(false);
    }
  };

  const startHoldToSpeak = () => {
    if (isThinking) return;
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError("Voice input not supported in this browser.");
      return;
    }
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current!.continuous = true;
    recognitionRef.current!.onresult = (e: any) => {
      transcriptRef.current = Array.from(e.results).map((r: any) => r[0].transcript).join("");
    };
    setVoiceState("listening");
    recognitionRef.current!.start();
  };

  const stopHoldToSpeak = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      if (transcriptRef.current) handleSend(transcriptRef.current);
      transcriptRef.current = "";
    }
  };

  const modeConfig = useMemo(() => modeMeta[mode], [mode]);

  return (
    <div className={STYLES.pageWrapper}>
      <header className={STYLES.header}>
        <div className="flex items-center gap-3">
          <h1 className={STYLES.title}>Milus Chat 🌻</h1>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${modeConfig.bg}`}>
            {modeConfig.emoji} {modeConfig.label}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <p className={STYLES.subtitle}>{voiceStatusText(voiceState)}</p>
          <button onClick={() => router.push("/caregiver")} className={STYLES.buttonSecondary}>Caregiver View</button>
        </div>
      </header>

      <main className={STYLES.mainContent}>
        <div className={STYLES.containerMaxWidth}>
          <div className={STYLES.card}>
            <p className={STYLES.cardTitle}>Your Companion Summary</p>
            <div className={STYLES.gridTwoCol}>
              <div className="rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-800">Name: <span className="font-medium">{summaryName}</span></div>
              <div className="rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-800">Key Person: <span className="font-medium">{summaryPerson}</span></div>
              <div className="rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-800">Interest: <span className="font-medium">{summaryInterest}</span></div>
              <div className="rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-800">Daily Check-In: <span className="font-medium">{summaryCheckIn}</span></div>
              <div className="rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-800 sm:col-span-2">Caregiver: <span className="font-medium">{summaryCaregiver}</span></div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-4">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={m.role === "user" ? STYLES.bubbleUser : STYLES.bubbleAgent}>
                  {m.pending && !m.text ? "..." : m.text}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </main>

      <footer className={STYLES.footer}>
        <div className={STYLES.containerMaxWidth}>
          <div className="flex items-center gap-2">
            <button
              onMouseDown={startHoldToSpeak}
              onMouseUp={stopHoldToSpeak}
              onMouseLeave={stopHoldToSpeak}
              className={`flex h-12 w-12 items-center justify-center rounded-full text-white shadow-sm ${voiceState === "listening" ? "bg-red-600" : "bg-stone-900"}`}
            >🎤</button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={`Message Milus, ${preferredName}...`}
              className={STYLES.input}
            />
            <button onClick={() => handleSend()} className={STYLES.buttonPrimary}>Send</button>
          </div>
          {voiceError && <p className="mt-2 text-sm text-red-700">{voiceError}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {["Family", "Cooking", "Language", "Memory"].map(t => (
              <button key={t} onClick={() => handleSend(`Let's talk about ${t.toLowerCase()}`)} className={STYLES.buttonSecondary + " text-xs"}>{t}</button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
