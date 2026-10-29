export const DEFAULT_CHAT_SUGGESTIONS = [
  'Show students below 80% attendance',
  'Show average attendance across my courses',
  'List all enrolled students',
  'Show my timetable',
];

const topics = (text: string) => [
  /risk|below|failing/i.test(text), /average|rate|percentage/i.test(text),
  /enrol|courses|students/i.test(text), /session|history|timetable/i.test(text),
];

/** Visit-only frequency ranking; names come from server suggestions, never prompt parsing. */
export function rankChatSuggestions(candidates: string[], questions: string[], latest = '') {
  const unique = new Map<string, string>();
  for (const text of [...candidates, ...DEFAULT_CHAT_SUGGESTIONS]) {
    const trimmed = text.trim();
    if (trimmed && !unique.has(trimmed.toLowerCase())) unique.set(trimmed.toLowerCase(), trimmed);
  }
  const serverQuestions = new Set(candidates.map(s => s.trim().toLowerCase()));
  const scored = [...unique.values()]
    .filter(s => s.toLowerCase() !== latest.trim().toLowerCase())
    .map((text, index) => ({ text, index, score: questions.slice(-40).reduce((sum, question, position) => {
      const matches = topics(text).some((topic, i) => topic && topics(question)[i]);
      return sum + (matches ? 1 + position / 40 : 0);
    }, 0) + (serverQuestions.has(text.toLowerCase()) ? 2 : 0) }));
  return scored.sort((a, b) => b.score - a.score || a.index - b.index).slice(0, 4).map(s => s.text);
}
