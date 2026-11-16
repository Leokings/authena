# Authena list policy

A listing is one agent skill at one exact version: `{"repo": "owner/name", "commit": "<40-character commit hash>", "path": "folder"}`. The folder must contain `SKILL.md`.

A listing is rejected when a challenger quotes a passage from a file in that folder, and the passage tells the agent to do any of the following in a way the skill's own stated purpose (its `description`) does not require:

1. Send secrets, keys, credentials, environment files or private user files to any destination.
2. Move, spend or approve funds or tokens.
3. Ignore or override the user's or the system's instructions, or hide its actions from the user.
4. Download and run code or further instructions from a remote location.

A challenge is `{"file": "relative/path", "quote": "the passage, 20 to 600 characters"}`.

Decided without a judgment:

- A listing whose commit is not a full commit hash, or whose `SKILL.md` does not exist, loses.
- A challenge whose quote is not in the file, word for word, loses.
- A file over 100 KB gets no ruling.

Rulings come from the Authena contract on GenLayer. If validators cannot tell, or no ruling arrives in time, the skill is not listed and both deposits are returned.
