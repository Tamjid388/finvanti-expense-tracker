"""Money serialization helpers.

Rule (root + server AGENTS.md): money is Decimal, serialized as decimal strings
with exactly two decimal places. Never float.
"""

from decimal import Decimal

CENT = Decimal("0.01")
ZERO = Decimal("0.00")


def as_money(value) -> str:
    """Quantize to 2dp and render as a fixed decimal string ("8500.00", "-500.00")."""
    if value is None:
        value = ZERO
    if not isinstance(value, Decimal):
        value = Decimal(str(value))
    return str(value.quantize(CENT))
