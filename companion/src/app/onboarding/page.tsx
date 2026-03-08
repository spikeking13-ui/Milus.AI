"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { STYLES } from "@/lib/styles";

type Message = {
  role: "agent" | "user";
  text: string;
};

export default function OnboardingPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length === 0) {
      handleSend("Hello! I'm Milus. I'd love to get to know you better so I can be a great companion. What's your full name?", true);
    }
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (text: string, isInitial = false) => {
    if (!text.trim() && !isInitial) return;

    const newMessages: Message[] = isInitial 
      ? [{ role: "agent", text }] 
      : [...messages, { role: "user", text }];
    
    if (!isInitial) {
      setMessages(newMessages);
      setInput("");
    }
    
    setIsThinking(true);

    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          messages: newMessages.map(m => ({ 
            role: m.role === "agent" ? "assistant" : "user", 
            content: m.text 
          })) 
        }),
      });

      if (!response.ok) throw new Error("Failed to fetch");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      setMessages(prev => [...prev, { role: "agent", text: "" }]);

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;
        const chunk = decoder.decode(value);
        assistantText += chunk;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          return [...prev.slice(0, -1), { ...last, text: assistantText }];
        });
      }

      // Check for onboarding end and JSON
      if (assistantText.includes("<ONBOARDING_END>")) {
        const jsonMatch = assistantText.match(/<USR_JSON>(.*?)<\/USR_JSON>/s);
        if (jsonMatch?.[1]) {
          const userData = JSON.parse(jsonMatch[1]);
          await fetch("/api/usr_data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "profile", data: userData }),
          });
          
          // Save conversation
          const convName = newMessages[0]?.text.slice(0, 10) || "onboarding";
          await fetch("/api/usr_data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              type: "conversation", 
              name: convName, 
              data: { name: convName, messages: [...newMessages, { role: "agent", text: assistantText }] } 
            }),
          });

          setTimeout(() => router.push("/chat"), 3000);
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div className={STYLES.pageWrapper}>
      <header className={STYLES.header}>
        <h1 className={STYLES.title}>Milus Onboarding</h1>
      </header>

      <main className={STYLES.mainContent}>
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={m.role === "user" ? STYLES.bubbleUser : STYLES.bubbleAgent}>
              {m.text.replace(/<ONBOARDING_END>|<USR_JSON>[\s\S]*?<\/USR_JSON>/g, "").trim()}
            </div>
          </div>
        ))}
        {isThinking && <div className={STYLES.thinking}>Milus is thinking...</div>}
        <div ref={scrollRef} />
      </main>

      <footer className={STYLES.footer}>
        <div className={STYLES.containerMaxWidth + " flex gap-4"}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend(input)}
            placeholder="Type your message..."
            className={STYLES.input}
          />
          <button
            onClick={() => handleSend(input)}
            disabled={isThinking}
            className={STYLES.buttonPrimary}
          >
            Send
          </button>
        </div>
      </footer>
    </div>
  );
}
