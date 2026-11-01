/** Shown only before a chat has any context, labelled as starters. Never appended to follow-ups. */
export const CHAT_STARTERS = [
  'Show students below 80% attendance',
  'Show average attendance across my courses',
  'List all enrolled students',
  'Show my timetable',
];

const topics = (text: string) => [
  /risk|below|failing/i.test(text), /average|rate|percentage/i.test(text),
  /enrol|courses|students/i.test(text), /session|history|timetable/i.test(text),
];

/**
 * Orders the candidates for one chat. `questions` is that chat's own history: a question already asked is never
 * offered again, and topics it keeps returning to rank first. Candidates come from the server's answer context
 * (resolved entities only) and nothing is added here, so identical contexts give identical chips.
 */
export function rankChatSuggestions(candidates: string[], questions: string[]) {
  const asked = new Set(questions.map(question => question.trim().toLowerCase()));
  const unique = new Map<string, string>();
  for (const text of candidates) {
    const trimmed = text.trim();
    if (trimmed && !asked.has(trimmed.toLowerCase()) && !unique.has(trimmed.toLowerCase())) unique.set(trimmed.toLowerCase(), trimmed);
  }
  const recent = questions.slice(-40);
  return [...unique.values()]
    .map((text, index) => ({ text, index, score: recent.reduce((sum, question, position) =>
      sum + (topics(text).some((topic, i) => topic && topics(question)[i]) ? 1 + position / 40 : 0), 0) }))
    .sort((a, b) => b.score - a.score || a.index - b.index).slice(0, 4).map(s => s.text);
}
