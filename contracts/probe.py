# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""Probe: can validators reach a public Sepolia node and GitHub's raw files, and agree on them?"""
import hashlib
import json
from typing import Any

from genlayer import *


class Probe(gl.Contract):
    last: str

    def __init__(self) -> None:
        self.last = ""

    @gl.public.write
    def probe(self, rpc_url: str, contract: Any, raw_url: str) -> str:
        # The CLI encodes 0x-addresses as the calldata Address type.
        if isinstance(contract, Address):
            contract = contract.as_hex
        def fetch() -> dict[str, Any]:
            payload = [{"jsonrpc": "2.0", "id": 1, "method": "eth_getCode", "params": [contract, "latest"]}]
            rpc = gl.nondet.web.post(rpc_url, body=json.dumps(payload), headers={"Content-Type": "application/json"})
            code = ""
            if rpc.status == 200:
                code = str(json.loads((rpc.body or b"[]").decode("utf-8"))[0].get("result") or "")
            raw = gl.nondet.web.get(raw_url)
            body = raw.body or b""
            return {
                "rpc_status": rpc.status,
                "code_sha256": hashlib.sha256(code.encode()).hexdigest(),
                "code_chars": len(code),
                "raw_status": raw.status,
                "raw_bytes": len(body),
                "raw_sha256": hashlib.sha256(body).hexdigest(),
            }

        def validator(leader: gl.vm.Result) -> bool:
            if not isinstance(leader, gl.vm.Return):
                return False
            try:
                return fetch() == leader.calldata
            except Exception:
                return False

        result = gl.vm.run_nondet_unsafe(fetch, validator)
        self.last = json.dumps(result, sort_keys=True)
        return self.last

    @gl.public.view
    def get_last(self) -> str:
        return self.last
