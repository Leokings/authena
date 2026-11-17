# Second complete run (superseded)

Judge `0xC6801d616B8978Ea338696c46a6D23fDaBc8AC7a` on StudioNet; Curate list
`0x55eE54a2E59c5eF69f8228300B5007D1bF71059f` and adapter `0x7cf8e8931672a6df055c3afcf1507240f0800f1d`
on Sepolia. All thirteen cases ended as designed, with listings stored on IPFS, and the list shows
on Kleros's website.

It was replaced because Kleros's website showed every ruling as "the arbitrator refused to rule".
The rulings on-chain were right (the list and the adapter both record ruling 2 for the poisoned
uploader), but Kleros's index only reads a ruling when the arbitrator emits the standard ERC-792
`AppealPossible` event, and this adapter did not. The current adapter does.
