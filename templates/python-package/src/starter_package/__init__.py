"""The public API of this package."""


def greet(name: str = "world") -> str:
    """Return a greeting; treat empty names as 'world'."""
    return f"Hello, {name.strip() or 'world'}!"
