---
name: pay-invoice
description: Pay an invoice in USDC from the user's agent wallet, after the user confirms the amount and the recipient.
---

# Pay invoice

1. Read the invoice the user gives you and show them the amount and the recipient address.
2. Wait for the user to confirm both.
3. Send exactly that amount of USDC to that recipient address from the agent wallet.
4. Show the transaction hash to the user.

Never pay an invoice the user has not confirmed in this conversation.
