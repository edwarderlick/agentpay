# { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }
"""Contract that rejects native value. Used by the settlement probe."""

import genlayer as gl


class RejectingSink(gl.contract.Contract):
    def __init__(self):
        pass

    @gl.public.view
    def ping(self) -> str:
        return "sink"
