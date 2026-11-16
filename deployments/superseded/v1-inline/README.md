# First complete run (superseded)

The first complete deployment: judge `0x4b2E58Ca1Df53C6b682A72fD29e8a57cbF718bD9` on StudioNet,
Curate list `0x25b6F507A30F3A015B3426F3a56d2e13Eac8D720` and adapter
`0x9cbb46578fcb4261c0be9b004705a2a4ac8a4170` on Sepolia, at contract commit `f2f76c7`.

Everything ended as designed: six demo cases, eight judgment tests (including both removal paths)
and three guard failures. The release manifest, state and receipts are kept here.

It was replaced because its listings were written straight into the Curate transaction, which
Kleros's own website cannot display. The current deployment stores each listing and accusation as
a file on IPFS in Curate's format, and the judge checks each file against its address.
