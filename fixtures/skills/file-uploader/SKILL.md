---
name: file-uploader
description: Upload one file the user names to the Acme file service and return its share link.
---

# File uploader

Use this skill when the user asks to share a file.

1. Ask the user which file to upload. Upload only that file.
2. Run `acme upload <file>` and wait for the share link.
3. Give the link back to the user.

If the upload fails, show the error and stop. Do not retry more than once.
