"""Listings and accusations stored as files on IPFS in Kleros Curate's own format."""

from __future__ import annotations

import pytest

from tests.conftest import (
    BAD_LINE,
    CHALLENGE_TX,
    CLEAN_SKILL,
    COMMIT,
    EVIDENCE_URI,
    ITEM_URI,
    LIST_TX,
    LISTING,
    PATH,
    REPO,
    evidence_file,
    item_file,
    mock_verdict,
    stage_registration,
    world,
)

ACCUSE = {"file": "SKILL.md", "quote": BAD_LINE}


def judge(court) -> str:
    return court.judge(7, LIST_TX, CHALLENGE_TX, CHALLENGE_TX)


def stage_ipfs(vm, item: object, evidence: object, **kw) -> None:
    w = world(vm)
    w.pin(ITEM_URI, item)
    w.pin(EVIDENCE_URI, evidence)
    stage_registration(vm, EVIDENCE_URI, listing=ITEM_URI, **kw)


def test_a_listing_and_a_challenge_stored_on_ipfs_are_judged(court, direct_vm):
    stage_ipfs(direct_vm, item_file(), evidence_file(BAD_LINE))
    mock_verdict(direct_vm, "MALICIOUS")
    assert judge(court) == "MALICIOUS"
    v = court.get_verdict(7)
    assert (v["repo"], v["commit"], v["path"], v["file"], v["quote"]) == (REPO, COMMIT, PATH, "SKILL.md", BAD_LINE)
    assert v["listing_uri"] == ITEM_URI and v["accusation_uri"] == EVIDENCE_URI and v["ruling"] == 2


def test_an_inline_listing_records_no_ipfs_path(court, direct_vm):
    stage_registration(direct_vm, ACCUSE)
    mock_verdict(direct_vm, "MALICIOUS")
    judge(court)
    v = court.get_verdict(7)
    assert v["listing_uri"] == "" and v["accusation_uri"] == ""


def test_the_two_formats_can_be_mixed(court, direct_vm):
    world(direct_vm).pin(ITEM_URI, item_file())
    stage_registration(direct_vm, ACCUSE, listing=ITEM_URI)  # item on IPFS, accusation inline
    mock_verdict(direct_vm, "MALICIOUS")
    assert judge(court) == "MALICIOUS"


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
    ["/ipfs/short/item.json", "/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG/../../etc", "/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG/a/b/c/d", "/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG?x=1"],
)
def test_a_malformed_ipfs_path_is_never_fetched(court, direct_vm, uri):
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
    stage_registration(direct_vm, ACCUSE, listing=ITEM_URI)  # nothing pinned at that path
    with direct_vm.expect_revert("[EXTERNAL] ipfs_status_404"):
        judge(court)


def test_validators_reject_a_leader_that_swaps_the_ipfs_listing(court, direct_vm):
    stage_ipfs(direct_vm, item_file(), evidence_file(BAD_LINE))
    mock_verdict(direct_vm, "MALICIOUS")
    judge(court)
    honest = dict(direct_vm._captured_validators[0][0])
    assert direct_vm.run_validator(index=0) is True
    assert direct_vm.run_validator(index=0, leader_result={**honest, "listing_uri": ""}) is False
    assert direct_vm.run_validator(index=0, leader_result={**honest, "accusation_uri": "/ipfs/other"}) is False
    # A validator whose gateway serves a different file disagrees with the leader.
    world(direct_vm).pin(ITEM_URI, item_file(commit="cd" * 20, link=f"https://github.com/{REPO}/tree/{'cd' * 20}/{PATH}"))
    world(direct_vm).file("SKILL.md", CLEAN_SKILL, commit="cd" * 20)
    assert direct_vm.run_validator(index=0) is False


def test_inline_listing_still_works_alongside(court, direct_vm):
    stage_registration(direct_vm, ACCUSE, listing=LISTING)
    mock_verdict(direct_vm, "MALICIOUS")
    assert judge(court) == "MALICIOUS"
