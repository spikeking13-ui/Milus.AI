/**
 * Shared design tokens and Tailwind class constants for Milus.AI
 */

export const STYLES = {
  // Layout & Containers
  pageWrapper: "milus-warm-gradient flex min-h-screen flex-col font-sans text-stone-900",
  mainContent: "flex-1 overflow-y-auto p-6 space-y-6",
  containerMaxWidth: "max-w-4xl mx-auto",
  
  // Headers & Footers
  header: "p-6 border-b border-stone-200/80 bg-white/85 backdrop-blur-sm flex justify-between items-center",
  footer: "p-6 bg-white/88 border-t border-stone-200/80 backdrop-blur-sm",
  
  // Typography
  title: "text-2xl font-semibold tracking-tight text-stone-900",
  subtitle: "text-sm text-stone-600",
  
  // Chat Bubbles
  bubbleUser: "max-w-[80%] p-4 rounded-2xl shadow-sm bg-emerald-700 text-white ml-auto",
  bubbleAgent: "max-w-[80%] p-4 rounded-2xl shadow-sm bg-white border border-stone-200",
  
  // Inputs & Buttons
  input: "flex-1 p-4 rounded-xl border border-stone-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300",
  buttonPrimary: "px-8 py-4 rounded-xl font-medium text-white bg-amber-600 hover:bg-amber-700 transition-colors disabled:opacity-50",
  buttonSecondary: "px-4 py-2 bg-white text-stone-700 border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors",
  
  // Status Indicators
  thinking: "text-stone-500 animate-pulse italic",
  
  // Cards (Caregiver View)
  card: "rounded-2xl border border-stone-200 bg-white p-6 shadow-sm",
  cardTitle: "text-xs font-semibold uppercase tracking-wide text-stone-500 mb-4",
  
  // Grid
  gridTwoCol: "grid gap-4 sm:grid-cols-2",
};
