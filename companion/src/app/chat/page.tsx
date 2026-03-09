"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { STYLES } from "@/lib/styles";

type ChatMode = "companion" | "cooking" | "creative" | "language";
type VoiceState = "idle" | "listening" | "thinking" | "speaking";

type Message = {
  id: string;
  role: "milus" | "user";
  text: string;
  pending?: boolean;
};

type ChatSession = {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
};

type SpeechRecognitionType = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
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

const THINKING_MESSAGES = ["Thinking...", "Ruminating...", "Pondering...", "Reflecting..."];

export default function ChatPage() {
  const router = useRouter();
  const recognitionRef = useRef<SpeechRecognitionType | null>(null);
  const transcriptRef = useRef("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const [preferredName, setPreferredName] = useState("friend");
  const [voiceMode, setVoiceMode] = useState<"speak" | "text">("speak");
  const [mode, setMode] = useState<ChatMode>("companion");
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingText, setThinkingText] = useState("Thinking...");
  const [voiceError, setVoiceError] = useState("");
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Summary states
  const [summaryName, setSummaryName] = useState("Not set");
  const [summaryPerson, setSummaryPerson] = useState("Not set");
  const [summaryInterest, setSummaryInterest] = useState("Not set");
  const [summaryCheckIn, setSummaryCheckIn] = useState("08:00");
  const [summaryCaregiver, setSummaryCaregiver] = useState("Not set");

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const checkProfile = async () => {
      // Try local storage first
      let profile = null;
      const localProfile = localStorage.getItem("milus_user_profile");
      if (localProfile) {
        profile = JSON.parse(localProfile);
      } else {
        const res = await fetch("/api/usr_data?type=profile");
        profile = await res.json();
        if (profile) {
          localStorage.setItem("milus_user_profile", JSON.stringify(profile));
        }
      }

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

      // Load sessions
      const savedSessions = localStorage.getItem("milus_chat_sessions");
      if (savedSessions) {
        const parsed = JSON.parse(savedSessions);
        setSessions(parsed);
        if (parsed.length > 0) {
          // Load the most recent session instead of starting a new one
          loadSession(parsed[0]);
          return;
        }
      }
      
      startNewChat(name, profile.hobbies);
    };
    checkProfile();
  }, [router]);

  const startNewChat = (name: string, hobbies: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const newId = crypto.randomUUID();
    setCurrentSessionId(newId);
    const initialMessage: Message = {
      id: crypto.randomUUID(),
      role: "milus",
      text: "",
      pending: true,
    };
    setMessages([initialMessage]);
    handleConversationStarter(name, hobbies, newId);
  };

  const saveSession = (sessionId: string, msgs: Message[]) => {
    setSessions(prev => {
      const existing = prev.find(s => s.id === sessionId);
      let updated;
      if (existing) {
        updated = prev.map(s => s.id === sessionId ? { ...s, messages: msgs } : s);
      } else {
        const firstUserMsg = msgs.find(m => m.role === "user")?.text || "New Chat";
        const title = firstUserMsg.slice(0, 30) + (firstUserMsg.length > 30 ? "..." : "");
        updated = [{ id: sessionId, title, messages: msgs, createdAt: new Date().toISOString() }, ...prev];
      }
      localStorage.setItem("milus_chat_sessions", JSON.stringify(updated));
      return updated;
    });
  };

  const loadSession = (session: ChatSession) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setCurrentSessionId(session.id);
    setMessages(session.messages);
    setIsHistoryOpen(false);
  };

  const handleConversationStarter = async (name: string, hobbies: string, sessionId: string) => {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsThinking(true);
    setThinkingText(THINKING_MESSAGES[Math.floor(Math.random() * THINKING_MESSAGES.length)]);
    setVoiceState("thinking");
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content: `You are Milus, a warm, human-like companion. 
              The user ${name} just opened the chat. Their hobbies: ${hobbies}.
              
              Task: Start with a very brief, warm greeting and one thoughtful, open-ended question or suggestion based on their interests or how they might be feeling. 
              Be concise, natural, and present. Avoid sounding like an AI or a script.`
            }
          ]
        }),
      });

      if (!response.ok) throw new Error("Failed to fetch starter");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";
      
      while (true) {
        const { done, value } = await reader!.read();
        const chunk = decoder.decode(value, { stream: !done });
        assistantText += chunk;
        
        setMessages(prev => {
          const updated = prev.map(m => m.pending ? { ...m, text: assistantText, pending: done ? false : true } : m);
          if (done) saveSession(sessionId, updated);
          return updated;
        });

        if (done) break;
      }
      speak(assistantText);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Conversation starter aborted');
        return;
      }
      console.error(error);
      const fallback = `Hi ${name}. I am here with you. What would you like to talk through today?`;
      setMessages(prev => {
        const updated = prev.map(m => m.pending ? { ...m, text: fallback, pending: false } : m);
        saveSession(sessionId, updated);
        return updated;
      });
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

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", text };
    const pendingId = crypto.randomUUID();
    const newMessages: Message[] = [...messages, userMsg, { id: pendingId, role: "milus", text: "", pending: true }];
    setMessages(newMessages);
    
    setIsThinking(true);
    setThinkingText(THINKING_MESSAGES[Math.floor(Math.random() * THINKING_MESSAGES.length)]);
    setVoiceState("thinking");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          messages: newMessages.filter(m => !m.pending).map(m => ({ 
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
        const chunk = decoder.decode(value, { stream: !done });
        assistantText += chunk;
        
        setMessages(prev => {
          const updated = prev.map(m => m.id === pendingId ? { ...m, text: assistantText, pending: done ? false : true } : m);
          if (done && currentSessionId) saveSession(currentSessionId, updated);
          return updated;
        });

        if (done) break;
      }

      speak(assistantText);
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
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }

    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current!.continuous = true;
    recognitionRef.current!.interimResults = true;
    recognitionRef.current!.lang = 'en-US';

    transcriptRef.current = "";

    recognitionRef.current!.onresult = (e: any) => {
      let current = "";
      for (let i = 0; i < e.results.length; i++) {
        current += e.results[i][0].transcript;
      }
      transcriptRef.current = current;
      setInput(current); // Show live transcript in input
    };

    recognitionRef.current!.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      if (event.error !== 'aborted') {
        setVoiceError(`Error: ${event.error}`);
        setVoiceState("idle");
      }
    };

    recognitionRef.current!.onend = () => {
      // Only reset if we're not in the middle of a send
      if (voiceState === "listening") {
        setVoiceState("idle");
      }
    };

    setVoiceState("listening");
    try {
      recognitionRef.current!.start();
    } catch (e) {
      console.error("Failed to start recognition", e);
      setVoiceState("idle");
    }
  };

  const stopHoldToSpeak = () => {
    if (recognitionRef.current && voiceState === "listening") {
      setVoiceState("idle");
      recognitionRef.current.stop();
      const finalTranscript = transcriptRef.current;
      if (finalTranscript.trim()) {
        handleSend(finalTranscript);
      }
      transcriptRef.current = "";
    }
  };

  const modeConfig = useMemo(() => modeMeta[mode], [mode]);

  return (
    <div className="flex h-screen bg-white overflow-hidden font-sans text-slate-900">
      {/* History Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-80 bg-slate-50 border-r border-slate-200 transform transition-transform duration-300 ease-in-out ${isHistoryOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0`}>
        <div className="flex flex-col h-full p-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-slate-800">History</h2>
            <button 
              onClick={() => startNewChat(preferredName, summaryInterest)}
              className="p-2 bg-emerald-500 text-white rounded-full hover:bg-emerald-600 transition-colors"
              title="New Chat"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2">
            {sessions.map(session => (
              <button
                key={session.id}
                onClick={() => loadSession(session)}
                className={`w-full text-left p-3 rounded-xl transition-colors ${currentSessionId === session.id ? 'bg-emerald-100 text-emerald-900' : 'hover:bg-slate-200 text-slate-600'}`}
              >
                <div className="font-medium truncate">{session.title}</div>
                <div className="text-xs opacity-60">{new Date(session.createdAt).toLocaleDateString()}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative">
        <header className={STYLES.header}>
          <div className="flex items-center gap-3">
            <button onClick={() => setIsHistoryOpen(!isHistoryOpen)} className="lg:hidden p-2 -ml-2 text-slate-500">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <h1 className={STYLES.title}>Milus Chat 🌻</h1>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${modeConfig.bg}`}>
              {modeConfig.emoji} {modeConfig.label}
            </span>
          </div>
          <div className="flex items-center gap-4">
            {/* <p className={STYLES.subtitle}>{voiceStatusText(voiceState)}</p> */}
            <button onClick={() => router.push("/caregiver")} className={STYLES.buttonSecondary}>Caregiver View</button>
          </div>
        </header>

      <main className={STYLES.mainContent}>
        <div className={STYLES.containerMaxWidth}>
          {/* <div className={STYLES.card}>
            <p className={STYLES.cardTitle}>Your Companion Summary</p>
            <div className={STYLES.gridTwoCol}>
              <div className="rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-800">Name: <span className="font-medium">{summaryName}</span></div>
              <div className="rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-800">Key Person: <span className="font-medium">{summaryPerson}</span></div>
              <div className="rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-800">Interest: <span className="font-medium">{summaryInterest}</span></div>
              <div className="rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-800">Daily Check-In: <span className="font-medium">{summaryCheckIn}</span></div>
              <div className="rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-800 sm:col-span-2">Caregiver: <span className="font-medium">{summaryCaregiver}</span></div>
            </div>
          </div> */}

          <div className="mt-6 flex flex-col gap-4">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={m.role === "user" ? STYLES.bubbleUser : STYLES.bubbleAgent}>
                  {m.pending && !m.text ? (
                    <span className="italic text-stone-500">{thinkingText}</span>
                  ) : (
                    m.text
                  )}
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
              onTouchStart={(e) => { e.preventDefault(); startHoldToSpeak(); }}
              onTouchEnd={(e) => { e.preventDefault(); stopHoldToSpeak(); }}
              className={`flex h-12 w-12 items-center justify-center rounded-full text-white shadow-sm transition-all active:scale-95 ${voiceState === "listening" ? "bg-red-600 animate-pulse" : "bg-stone-900"}`}
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
    </div>
  );
}
