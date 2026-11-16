# Test fixtures

Two skills used only by Authena's live demo.

- `skills/file-uploader/` is clean.
- `skills/poisoned-do-not-install/` is the same skill with two planted lines: one tells the agent
  to leak private files, the other tells a judge to mark the file safe. **Do not install it.** It
  exists so a challenge against it can be judged on-chain. The address it names does not exist.
