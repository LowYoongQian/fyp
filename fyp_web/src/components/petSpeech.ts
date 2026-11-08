// What the pet says when it waves. One short line each: the bubble above the pet has room for exactly one.
export const PET_LINES = [
  'Hi there!',
  'Hello! Nice to see you.',
  'Need a hand? Tap me.',
  'Got a question? Just ask.',
  'I can look up attendance.',
  'Ask me about your timetable.',
  'Drag me anywhere you like.',
  'Tap me to start a chat.',
  'Have a great day!',
  'Time for a quick stretch?',
  'Remember to drink some water.',
  "I'm here if you need me.",
  'Stuck on something? Ask me.',
  'Looking good today!',
  'All quiet here. Need anything?',
] as const;

/** A random line that is never the one just said. `random` is a parameter so a test can steer it. */
export const pickLine = (previous?: string, random: () => number = Math.random): string => {
  const options = PET_LINES.filter(line => line !== previous);
  return options[Math.min(options.length - 1, Math.floor(random() * options.length))];
};

/** How long a line stays up: long enough to read it unhurried, never more than a few seconds. */
export const speechMs = (line: string) => Math.min(7000, 2600 + line.length * 70);
