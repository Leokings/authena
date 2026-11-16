"""Listings and accusations stored as files on IPFS in Kleros Curate's own format."""

from __future__ import annotations

import json

import pytest

from tests.conftest import (
    BAD_LINE,
    CHALLENGE_TX,
    CLEAN_SKILL,
    COMMIT,
    EMPTY_URI,
    ITEM,
    LIST_TX,
    LISTING,
    PATH,
    REMOVE_TX,
    REPO,
    dispute_log,
    evidence_file,
    evidence_log,
    ipfs_address,
    item_file,
    mock_verdict,
    request_log,
    stage_registration,
    world,
)

ACCUSE = {"file": "SKILL.md", "quote": BAD_LINE}
OTHER = "cd" * 20


def judge(court) -> str:
    return court.judge(7, LIST_TX, CHALLENGE_TX, CHALLENGE_TX)


def stage_ipfs(vm, item: object, evidence: object, **kw) -> tuple[str, str]:
    """Pins both files and stages a listing and a challenge that point at them."""
    w = world(vm)
    item_uri, evidence_uri = w.pin(item), w.pin(evidence)
    stage_registration(vm, evidence_uri, listing=item_uri, **kw)
    return item_uri, evidence_uri


def test_a_listing_and_a_challenge_stored_on_ipfs_are_judged(court, direct_vm):
    item_uri, evidence_uri = stage_ipfs(direct_vm, item_file(), evidence_file(BAD_LINE))
    mock_verdict(direct_vm, "MALICIOUS")
    assert judge(court) == "MALICIOUS"
    v = court.get_verdict(7)
    assert (v["repo"], v["commit"], v["path"], v["file"], v["quote"]) == (REPO, COMMIT, PATH, "SKILL.md", BAD_LINE)
    assert v["listing_uri"] == item_uri and v["accusation_uri"] == evidence_uri and v["ruling"] == 2


def test_the_address_matches_a_file_uploaded_through_kleros():
    # A real upload: these bytes were pinned by Kleros's gateway at this address.
    data = b'{\n  "title": "Unsafe passage in SKILL.md",\n  "description": "Quoted passage: \\"2. Run `acme upload <file>` and wait for the share link.\\"",\n  "file": "SKILL.md",\n  "quote": "2. Run `acme upload <file>` and wait for the share link."\n}\n'
    assert ipfs_address(data).startswith("/ipfs/Qm") and len(ipfs_address(data)) == 52
    assert ipfs_address(b"hello\n") == "/ipfs/QmZULkCELmmk5XNfCgTnCyFgAVxBRBXyDHGGMVoLFLiXEN"  # the well-known address of this file


def test_an_inline_listing_records_no_ipfs_path(court, direct_vm):
    stage_registration(direct_vm, ACCUSE)
    mock_verdict(direct_vm, "MALICIOUS")
    judge(court)
    v = court.get_verdict(7)
    assert v["listing_uri"] == "" and v["accusation_uri"] == ""


def test_the_two_formats_can_be_mixed(court, direct_vm):
    uri = world(direct_vm).pin(item_file())
    stage_registration(direct_vm, ACCUSE, listing=uri)  # item on IPFS, accusation inline
    mock_verdict(direct_vm, "MALICIOUS")
    assert judge(court) == "MALICIOUS"


def test_a_gateway_serving_other_bytes_for_the_address_is_rejected(court, direct_vm):
    # The gateway answers the listing's address with a different (attacker-friendly) file.
    w = world(direct_vm)
    real = w.pin(item_file())
    w.pin(item_file(commit=OTHER, link=f"https://github.com/{REPO}/tree/{OTHER}/{PATH}"), at=real)
    stage_registration(direct_vm, ACCUSE, listing=real)
    with direct_vm.expect_revert("[EXTERNAL] ipfs_content_mismatch"):
        judge(court)
    assert court.get_verdict(7) == {"judged": False}


def test_an_item_file_whose_link_points_at_another_version_is_not_pinned(court, direct_vm):
    # The link is what a person clicks on Curate's website, so it must be the version being judged.
    stage_ipfs(direct_vm, item_file(link=f"https://github.com/{REPO}/tree/main/{PATH}"), evidence_file(BAD_LINE))
    assert judge(court) == "LISTING_NOT_PINNED"
    assert court.get_verdict(7)["ruling"] == 2


@pytest.mark.parametrize(
    "item",
    [
        b"not json at all",
        ["a", "list"],
        {"columns": [], "values": "nope"},
        {"columns": [], "values": {"Repository": REPO, "Folder": PATH}},  # no commit
        {"columns": [], "values": {"Repository": REPO, "Commit": "main", "Folder": PATH}},
        {"columns": [], "values": {"Repository": REPO, "Commit": COMMIT, "Folder": "../x"}},
        b"x" * 20_001,
    ],
)
def test_a_bad_item_file_is_not_a_pinned_listing(court, direct_vm, item):
    stage_ipfs(direct_vm, item, evidence_file(BAD_LINE))
    assert judge(court) == "LISTING_NOT_PINNED"
    assert court.get_verdict(7)["judged_by"] == "code"


def test_an_item_file_without_the_link_column_is_accepted(court, direct_vm):
    stage_ipfs(direct_vm, {"columns": [], "values": {"Repository": REPO, "Commit": COMMIT, "Folder": PATH}}, evidence_file(BAD_LINE))
    mock_verdict(direct_vm, "MALICIOUS")
    assert judge(court) == "MALICIOUS"


@pytest.mark.parametrize("evidence", [b"\xff\xfe", {"title": "no quote here"}, {"file": "SKILL.md", "quote": "short"}, ["x"]])
def test_a_bad_evidence_file_is_an_invalid_accusation(court, direct_vm, evidence):
    stage_ipfs(direct_vm, item_file(), evidence)
    assert judge(court) == "ACCUSATION_INVALID"
    assert court.get_verdict(7)["ruling"] == 1


@pytest.mark.parametrize(
    "uri",
    [
        "/ipfs/short",
        "/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG/item.json",  # a sub-path cannot be verified
        "/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG/../../etc",
        "/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG?x=1",
        "/ipfs/bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",  # version-1 address
        "/ipfs/Qm0OIlAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbd",  # characters outside base58
    ],
)
def test_an_address_that_cannot_be_verified_is_never_fetched(court, direct_vm, uri):
    stage_registration(direct_vm, ACCUSE, listing=uri)
    assert judge(court) == "LISTING_NOT_PINNED"
    assert not any("kleros.link" in u for u in world(direct_vm).requests)


@pytest.mark.parametrize("status,prefix", [(503, "[TRANSIENT] ipfs_status_503"), (429, "[TRANSIENT] ipfs_status_429"), (404, "[EXTERNAL] ipfs_status_404"), (403, "[EXTERNAL] ipfs_status_403")])
def test_a_gateway_that_cannot_serve_the_file_is_an_error_not_a_finding(court, direct_vm, status, prefix):
    stage_ipfs(direct_vm, item_file(), evidence_file(BAD_LINE))
    world(direct_vm).ipfs_status = status
    with direct_vm.expect_revert(prefix):
        judge(court)
    assert court.get_verdict(7) == {"judged": False}


def test_a_missing_item_file_is_an_error_not_a_finding(court, direct_vm):
    stage_registration(direct_vm, ACCUSE, listing=EMPTY_URI)  # nothing pinned at that address
    with direct_vm.expect_revert("[EXTERNAL] ipfs_status_404"):
        judge(court)


def test_validators_reject_a_leader_that_swaps_the_ipfs_listing(court, direct_vm):
    item_uri, _ = stage_ipfs(direct_vm, item_file(), evidence_file(BAD_LINE))
    mock_verdict(direct_vm, "MALICIOUS")
    judge(court)
    honest = dict(direct_vm._captured_validators[0][0])
    assert direct_vm.run_validator(index=0) is True
    assert direct_vm.run_validator(index=0, leader_result={**honest, "listing_uri": ""}) is False
    assert direct_vm.run_validator(index=0, leader_result={**honest, "accusation_uri": EMPTY_URI}) is False
    assert direct_vm.run_validator(index=0, leader_result={**honest, "commit": OTHER}) is False


def test_inline_listing_still_works_alongside(court, direct_vm):
    stage_registration(direct_vm, ACCUSE, listing=LISTING)
    mock_verdict(direct_vm, "MALICIOUS")
    assert judge(court) == "MALICIOUS"


# --- Asking by skill version ------------------------------------------------------------


def test_a_version_ruled_malicious_is_found_by_version(court, direct_vm):
    stage_ipfs(direct_vm, item_file(), evidence_file(BAD_LINE))
    mock_verdict(direct_vm, "MALICIOUS")
    judge(court)
    got = court.get_skill(REPO, COMMIT, PATH)
    assert got["malicious"] is True
    assert got["verdicts"] == [{"dispute_id": 7, "finding": "MALICIOUS", "request_type": "registration", "ruling": 2, "quote": BAD_LINE, "file": "SKILL.md"}]
    # The owner name is case-insensitive on GitHub, and slashes around the folder do not matter.
    assert court.get_skill(REPO.upper(), COMMIT, "/" + PATH + "/")["malicious"] is True


def test_a_cleared_version_is_not_malicious(court, direct_vm):
    stage_registration(direct_vm, {"file": "SKILL.md", "quote": "Run `acme upload <file>` and wait for the link."}, skill=CLEAN_SKILL)
    mock_verdict(direct_vm, "BENIGN")
    judge(court)
    got = court.get_skill(REPO, COMMIT, PATH)
    assert got["malicious"] is False and [v["finding"] for v in got["verdicts"]] == ["BENIGN"]


def test_an_unknown_version_has_no_verdicts(court, direct_vm):
    assert court.get_skill(REPO, COMMIT, PATH) == {"malicious": False, "verdicts": []}
    assert court.get_skill("someone/else", "ab" * 20, "") == {"malicious": False, "verdicts": []}


def test_a_listing_that_is_not_pinned_is_not_indexed_by_version(court, direct_vm):
    stage_registration(direct_vm, ACCUSE, listing='{"repo": "acme/skills", "commit": "main", "path": "x"}')
    judge(court)
    assert court.get_skill("acme/skills", "main", "x") == {"malicious": False, "verdicts": []}


def test_a_second_dispute_about_the_same_version_is_added(court, direct_vm):
    stage_ipfs(direct_vm, item_file(), evidence_file(BAD_LINE))
    mock_verdict(direct_vm, "BENIGN")
    judge(court)
    # A later removal request against the same version, judged malicious this time.
    second = "0x" + format(9, "064x")
    w = world(direct_vm)
    w.receipt(REMOVE_TX, [request_log(ITEM, 950), evidence_log(950, json.dumps(ACCUSE))])
    w.receipt(second, [dispute_log(11, 950, 1)])
    w.dispute_items[11] = ITEM
    direct_vm.clear_mocks()
    mock_verdict(direct_vm, "MALICIOUS")
    assert court.judge(11, LIST_TX, second, REMOVE_TX) == "MALICIOUS"
    got = court.get_skill(REPO, COMMIT, PATH)
    assert got["malicious"] is True and [v["dispute_id"] for v in got["verdicts"]] == [7, 11]
