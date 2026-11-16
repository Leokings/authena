# Authena

A public list of AI-agent skills that are safe to install, with money behind every entry.

- The list is a **Kleros Curate** registry on Sepolia. A publisher lists a skill at one exact
  commit and locks a deposit. Anyone can challenge by quoting the passage they say is malicious.
- The judge is a **GenLayer** Intelligent Contract. Validators fetch the file at that commit, check
  the quote is in it, and answer one question about the passage. Code turns the answer into
  Curate's ruling, and Curate pays the winner.

Built for the Internet Court Partner Demo Lab. Status: in development.

- Design: [docs/DESIGN.md](docs/DESIGN.md)
- List policy: [docs/POLICY.md](docs/POLICY.md)
- Judge contract: [contracts/skill_court.py](contracts/skill_court.py)
- Sepolia adapter: [evm/GenLayerArbitrator.sol](evm/GenLayerArbitrator.sol)

`fixtures/skills/poisoned-do-not-install` is a test fixture with planted malicious lines. Do not
install it.

## Tests

```bash
npm install
npm test
```
