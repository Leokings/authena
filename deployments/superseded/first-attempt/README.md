# First attempt (superseded)

The first live run stopped early on an operator mistake. The relay sent transaction hashes to the
judge through the GenLayer CLI, which turns a `0x…` argument into a number. The first judge
contract (`0x67e6dCAA2593eB6EA3FBF6261bB93B621A78A91e`) only accepted text or bytes, so it rejected
them with `[EXPECTED] invalid_tx_hash`. No dispute was judged and no ruling was relayed.

The contract now also accepts a number-encoded hash. Because the Sepolia adapter records its
judge's address once, the adapter and the Curate list were redeployed too. The files here are the
first attempt's addresses, state and receipts, kept for the record.
