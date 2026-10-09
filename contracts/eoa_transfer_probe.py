# { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }
"""EOA external-message payout probe for Studio Next.

Uses the documented eth-interface transfer:

    @gl.evm.contract_interface
    class _Recipient:
        class View: pass
        class Write: pass
    _Recipient(address).emit_transfer(value=amount)

That host call is EmitExternalMessage with empty calldata. It is not
`gl.chain.Account.emit_transfer` and it does not take `on=`.

`gl.u256(...)` is not callable in this SDK; pass a plain int for value.

This contract is not AgentPay. SettlementProbe remains as evidence of the
failed Account path.
"""

import genlayer as gl


@gl.evm.contract_interface
class _Recipient:
    class View:
        pass

    class Write:
        pass


class EoaTransferProbe(gl.contract.Contract):
    credits: gl.storage.TreeMap[gl.Address, gl.u256]
    total_credits: gl.u256

    def __init__(self):
        self.total_credits = 0

    def _as_address(self, value: str) -> gl.Address:
        try:
            return gl.Address(value)
        except Exception:
            raise gl.vm.UserError("invalid address")

    def _emit_eoa(self, dest: gl.Address, amount: int) -> None:
        if amount <= 0:
            raise gl.vm.UserError("transfer amount must be positive")
        if int(self.balance) < amount:
            raise gl.vm.UserError("insufficient contract balance")
        _Recipient(dest).emit_transfer(value=amount)

    @gl.public.write.payable
    def deposit(self, recipient: str) -> None:
        amount = int(gl.message.value)
        if amount <= 0:
            raise gl.vm.UserError("deposit must be positive")
        dest = self._as_address(recipient)
        self.credits[dest] = int(self.credits.get(dest, 0)) + amount
        self.total_credits = int(self.total_credits) + amount

    @gl.public.write
    def withdraw(self) -> None:
        sender = gl.message.sender_address
        amount = int(self.credits.get(sender, 0))
        if amount <= 0:
            raise gl.vm.UserError("insufficient credit")
        self._emit_eoa(sender, amount)
        self.credits[sender] = 0
        self.total_credits = int(self.total_credits) - amount

    @gl.public.view
    def get_credit(self, account: str) -> int:
        return int(self.credits.get(self._as_address(account), 0))

    @gl.public.view
    def get_accounting(self) -> dict:
        credits = int(self.total_credits)
        held = int(self.balance)
        return {
            "contract_balance": held,
            "total_credits": credits,
        }

    @gl.public.view
    def get_contract_balance(self) -> int:
        return int(self.balance)
