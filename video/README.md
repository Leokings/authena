# The Authena video

45 seconds, 1920×1080. Made from the live product with AI tools:

- **Footage:** real screen captures of the live site, the list on Kleros Curate and the GenLayer
  explorer, taken by `capture.ts` in a headless browser (`public/shots`).
- **Voice:** ElevenLabs (`voice.ts`, script in `src/voiceover.ts`).
- **Music:** ElevenLabs sound generation (`music.ts`).
- **Motion and edit:** Remotion (`src/Authena.tsx`).

```bash
cd video && npm install
npx tsx capture.ts
npx tsx --env-file=<file with ELEVENLABS_API_KEY> voice.ts
npx tsx --env-file=<file with ELEVENLABS_API_KEY> music.ts
npm run render
```

The rendered file is at `../site/video/authena.mp4`.
