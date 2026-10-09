# { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }
"""Isolated native-transfer probe for Studio Next.

This contract is not the AgentPay product. It exists to prove whether
`gl.chain.Account.emit_transfer(..., on='finalized')` delivers test-GEN
to a named wallet, and what happens when delivery cannot complete.

Runner note: v2-dev boilerplate pin
`py-genlayer:9b8kjyda2ycxyq4ea6g4yfpnydxhd52gqba5rb8dw7krkh5mn9p0` is
rejected by Studio Next as `invalid_contract runner malformed`
(tx 0x5cbe7fd9fd1e99c18ffd99519a7b56e9593db06fabc61aa2ef6edc2da356d3f5).
This file uses the SDK current py-genlayer hash from
https://sdk.genlayer.com/main/_static/ai/available-runners.txt .
"""

import genlayer as gl


class SettlementProbe(gl.contract.Contract):
    credits: gl.storage.TreeMap[gl.Address, gl.u256]
    unused: gl.storage.TreeMap[gl.Address, gl.u256]
    in_flight: gl.storage.TreeMap[gl.Address, gl.u256]
    total_credits: gl.u256
    total_unused: gl.u256
    total_in_flight: gl.u256

    def __init__(self):
        self.total_credits = 0
        self.total_unused = 0
        self.total_in_flight = 0

    def _as_address(self, value: str) -> gl.Address:
        try:
            return gl.Address(value)
        except Exception:
            raise gl.vm.UserError("invalid address")

    def _move_to_in_flight(self, owner: gl.Address, amount: int) -> None:
        inflight = int(self.in_flight.get(owner, 0))
        self.in_flight[owner] = inflight + amount
        self.total_in_flight = int(self.total_in_flight) + amount

    def _require_native(self, amount: int) -> None:
        if amount <= 0:
            raise gl.vm.UserError("transfer amount must be positive")
        if int(self.balance) < amount:
            raise gl.vm.UserError("insufficient contract balance")

    def _emit_native(self, dest: gl.Address, amount: int) -> None:
        self._require_native(amount)
        # Studio Next 61997: emit_transfer(..., on="finalized") produced a
        # parent FINALIZED receipt with pending_transactions and message fees,
        # but triggered_transactions stayed empty, value_credited was false,
        # and recipient native GEN did not increase
        # (tx 0x521e36525c59583835c5213cb479e8e71f3cbd04eb461b699e63575fd38422cd).
        # Retry the same native path at the decided stage.
        gl.chain.Account(dest).emit_transfer(amount, on="decided")

    @gl.public.write.payable
    def deposit_credit(self, recipient: str) -> None:
        amount = int(gl.message.value)
        if amount <= 0:
            raise gl.vm.UserError("deposit must be positive")
        dest = self._as_address(recipient)
        self.credits[dest] = int(self.credits.get(dest, 0)) + amount
        self.total_credits = int(self.total_credits) + amount

    @gl.public.write.payable
    def deposit_unused(self) -> None:
        amount = int(gl.message.value)
        if amount <= 0:
            raise gl.vm.UserError("deposit must be positive")
        sender = gl.message.sender_address
        self.unused[sender] = int(self.unused.get(sender, 0)) + amount
        self.total_unused = int(self.total_unused) + amount

    @gl.public.write
    def withdraw(self) -> None:
        sender = gl.message.sender_address
        amount = int(self.credits.get(sender, 0))
        if amount <= 0:
            raise gl.vm.UserError("no withdrawable credit")
        self._require_native(amount)
        self.credits[sender] = 0
        self.total_credits = int(self.total_credits) - amount
        self._move_to_in_flight(sender, amount)
        self._emit_native(sender, amount)

    @gl.public.write
    def attempt_withdraw_to(self, destination: str) -> None:
        """Same credit check as withdraw, sending to a caller-chosen destination.

        Used to demonstrate a transfer that cannot complete (for example a
        contract that rejects `__receive__`). Credit is not cleared if
        `emit_transfer` raises; the whole call rolls back.
        """
        sender = gl.message.sender_address
        amount = int(self.credits.get(sender, 0))
        if amount <= 0:
            raise gl.vm.UserError("no withdrawable credit")
        dest = self._as_address(destination)
        self._require_native(amount)
        self.credits[sender] = 0
        self.total_credits = int(self.total_credits) - amount
        self._move_to_in_flight(sender, amount)
        self._emit_native(dest, amount)

    @gl.public.write
    def reclaim(self) -> None:
        sender = gl.message.sender_address
        amount = int(self.unused.get(sender, 0))
        if amount <= 0:
            raise gl.vm.UserError("no unused amount")
        self._require_native(amount)
        self.unused[sender] = 0
        self.total_unused = int(self.total_unused) - amount
        self._move_to_in_flight(sender, amount)
        self._emit_native(sender, amount)

    @gl.public.view
    def get_credit(self, account: str) -> int:
        return int(self.credits.get(self._as_address(account), 0))

    @gl.public.view
    def get_unused(self, account: str) -> int:
        return int(self.unused.get(self._as_address(account), 0))

    @gl.public.view
    def get_in_flight(self, account: str) -> int:
        return int(self.in_flight.get(self._as_address(account), 0))

    @gl.public.view
    def get_wallet(self, account: str) -> dict:
        addr = self._as_address(account)
        return {
            "credit": int(self.credits.get(addr, 0)),
            "unused": int(self.unused.get(addr, 0)),
            "in_flight": int(self.in_flight.get(addr, 0)),
        }

    @gl.public.view
    def get_accounting(self) -> dict:
        credits = int(self.total_credits)
        unused = int(self.total_unused)
        inflight = int(self.total_in_flight)
        held = int(self.balance)
        return {
            "contract_balance": held,
            "total_credits": credits,
            "total_unused": unused,
            "total_in_flight": inflight,
            "uncommitted": credits + unused,
        }

    @gl.public.view
    def get_contract_balance(self) -> int:
        return int(self.balance)
