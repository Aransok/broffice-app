from decimal import Decimal

# Bulgaria's currency-board peg (fixed since 1997, the same rate set for the
# actual euro changeover) — a permanent legal conversion, not a market rate
# that moves. Mirrors the frontend's utils/currency.ts constant; duplicated
# here only because Python and TypeScript can't share a module, not because
# the fact itself is allowed to drift between them.
BGN_PER_EUR = Decimal("1.95583")


def bgn_to_eur(bgn_value) -> Decimal:
    return (Decimal(str(bgn_value)) / BGN_PER_EUR).quantize(Decimal("0.01"))


def format_eur(bgn_value) -> str:
    return f"€{bgn_to_eur(bgn_value)}"
