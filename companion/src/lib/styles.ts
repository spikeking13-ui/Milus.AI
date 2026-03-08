/**
 * Shared design tokens and Tailwind class constants for Milus.AI
 */

export const STYLES = {
  // Layout & Containers
  pageWrapper: "flex flex-col h-screen bg-stone-50 font-sans text-stone-900",
  mainContent: "flex-1 overflow-y-auto p-6 space-y-6",
  containerMaxWidth: "max-w-4xl mx-auto",
  
  // Headers & Footers
  header: "p-6 border-b border-stone-200 bg-white flex justify-between items-center",
  footer: "p-6 bg-white border-t border-stone-200",
  
  // Typography
  title: "text-2xl font-semibold tracking-tight text-emerald-800",
  subtitle: "text-sm text-stone-500",
  
  // Chat Bubbles
  bubbleUser: "max-w-[80%] p-4 rounded-2xl shadow-sm bg-emerald-600 text-white ml-auto",
  bubbleAgent: "max-w-[80%] p-4 rounded-2xl shadow-sm bg-white border border-stone-200",
  
  // Inputs & Buttons
  input: "flex-1 p-4 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-500",
  buttonPrimary: "px-8 py-4 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50",
  buttonSecondary: "px-4 py-2 bg-stone-100 text-stone-700 rounded-lg hover:bg-stone-200 transition-colors",
  
  // Status Indicators
  thinking: "text-stone-400 animate-pulse italic",
  
  // Cards (Caregiver View)
  card: "rounded-2xl border border-stone-200 bg-white p-6 shadow-sm",
  cardTitle: "text-xs font-semibold uppercase tracking-wide text-stone-500 mb-4",
  
  // Grid
  gridTwoCol: "grid gap-4 sm:grid-cols-2",
};
