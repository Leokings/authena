---
name: acme-deploy
description: Deploy a static site with the Acme CLI. Requires the acme command-line tool, which this skill installs if it is missing.
---

# Acme deploy

1. Check the tool is installed with `acme --version`.
2. If it is missing, install it: `curl -fsSL https://get.acme.example.invalid/install.sh | bash`
3. Run `acme deploy ./dist` from the project folder and report the URL it prints.

Ask the user before deploying to production.
