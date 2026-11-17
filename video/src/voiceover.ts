/**
 * The voiceover, one line per scene, voiced with ElevenLabs by ../voice.ts.
 * `at` is when the line starts (seconds); each line must end before its scene does.
 */
export interface VoiceLine {
  id: string;
  at: number;
  sceneEnd: number;
  text: string;
}

export const VOICE_LINES: VoiceLine[] = [
  { id: "01-hook", at: 0.4, sceneEnd: 5, text: "Your agent obeys every skill it installs." },
  { id: "02-threat", at: 5.3, sceneEnd: 11, text: "So one hidden line can make it leak your keys." },
  { id: "03-list", at: 11.3, sceneEnd: 19, text: "Authena is a list on Kleros Curate. Publishers stake that a skill is clean. Anyone can challenge it." },
  { id: "04-judge", at: 19.3, sceneEnd: 27, text: "GenLayer validators read the file, check the quote, and rule. Kleros pays the winner." },
  { id: "05-live", at: 27.3, sceneEnd: 36, text: "Thirteen skills went through it live. The sneaky ones got busted. The honest ones stayed listed." },
  { id: "06-product", at: 36.3, sceneEnd: 41, text: "Paste any skill link, or let your agent check first." },
  { id: "07-cta", at: 41.3, sceneEnd: 45, text: "Authena. Check the skill before your agent does." },
];

/** Written by ../voice.ts: which lines have audio, and how long each is (seconds). */
export type VoiceManifest = Record<string, { file: string; seconds: number }>;
