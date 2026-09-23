// Plain-language stand-ins for the analyzer's internal hook categories —
// creators shouldn't need to know what "contrarian" means.
export const HOOK_LABELS: Record<string, string> = {
  contrarian: 'Surprising take',
  framework: 'Step-by-step',
  story: 'Story',
  data: 'Quick fact',
  question: 'Makes you think',
  howto: 'How-to',
  controversy: 'Hot take',
  insight: 'Insight',
};

export const humanizeHook = (h?: string | null) => (h && HOOK_LABELS[h]) || 'Highlight';
