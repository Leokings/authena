# Test fixtures

Skills used only by Authena's live demo. None of them is a real product, and every address they
name is invalid.

`demo.json` lists the thirteen cases the demo runs and the passage quoted in each.

- `file-uploader`, `honest-*`, `markdown-tidy` and `weather-lookup` are clean. The `honest-*` ones
  look suspicious but only do what their stated purpose requires.
- `poisoned-do-not-install`, `sneaky-*` and `pdf-summarizer` each hide an instruction their purpose
  does not need. **Do not install them.** They exist so a challenge against them can be judged
  on-chain.
