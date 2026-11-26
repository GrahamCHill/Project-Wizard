"""Example tools and the validation that runs before any tool does.

The model chooses a tool's arguments, so treat them as untrusted input: check them against the tool's
schema first, and keep each tool's own checks strict (see `calculate`).
"""

from __future__ import annotations

import ast
import operator
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Callable

from .providers import ToolSpec


@dataclass(frozen=True)
class Tool:
    spec: ToolSpec
    run: Callable[..., str]


_TYPES: dict[str, tuple[type, ...]] = {
    "string": (str,), "number": (int, float), "integer": (int,), "boolean": (bool,), "array": (list,), "object": (dict,),
}


def validate_arguments(schema: dict[str, Any], arguments: Any) -> str | None:
    """Returns a message that describes the first problem, or None when the arguments fit the schema."""
    if not isinstance(arguments, dict):
        return "Arguments must be a JSON object."
    properties = schema.get("properties", {})
    for name in schema.get("required", []):
        if name not in arguments:
            return f"Missing required argument {name!r}."
    for name, value in arguments.items():
        if name not in properties:
            return f"Unexpected argument {name!r}."
        expected = _TYPES.get(properties[name].get("type", ""))
        # bool is a subclass of int, so check it explicitly.
        if expected and (not isinstance(value, expected) or (isinstance(value, bool) and bool not in expected)):
            return f"Argument {name!r} must be of type {properties[name]['type']}."
    return None


# --- calculate ---------------------------------------------------------------------------------------

_BINARY = {
    ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul, ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv, ast.Mod: operator.mod, ast.Pow: operator.pow,
}
_UNARY = {ast.UAdd: operator.pos, ast.USub: operator.neg}
_MAX_EXPRESSION = 200
_MAX_POWER = 100


def _evaluate(node: ast.AST) -> float:
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)) and not isinstance(node.value, bool):
        return node.value
    if isinstance(node, ast.UnaryOp) and type(node.op) in _UNARY:
        return _UNARY[type(node.op)](_evaluate(node.operand))
    if isinstance(node, ast.BinOp) and type(node.op) in _BINARY:
        left, right = _evaluate(node.left), _evaluate(node.right)
        if isinstance(node.op, ast.Pow) and (abs(right) > _MAX_POWER or abs(left) > 1e6):
            raise ValueError("That power is too large.")
        return _BINARY[type(node.op)](left, right)
    raise ValueError("Only numbers and + - * / // % ** with parentheses are allowed.")


def calculate(expression: str) -> str:
    """Evaluates arithmetic without eval(), so a model-written expression cannot run code."""
    if len(expression) > _MAX_EXPRESSION:
        return "Error: the expression is too long."
    try:
        value = _evaluate(ast.parse(expression.strip(), mode="eval").body)
    except ZeroDivisionError:
        return "Error: division by zero."
    except (SyntaxError, ValueError, OverflowError, RecursionError) as error:
        return f"Error: {error}" if isinstance(error, ValueError) else "Error: could not read that expression."
    return str(int(value)) if isinstance(value, float) and value.is_integer() and abs(value) < 1e15 else str(value)


# --- get_time ------------------------------------------------------------------------------------------


def get_time(utc_offset_hours: float = 0) -> str:
    if not -14 <= utc_offset_hours <= 14:
        return "Error: utc_offset_hours must be between -14 and 14."
    zone = timezone(timedelta(hours=utc_offset_hours))
    return datetime.now(zone).strftime("%Y-%m-%d %H:%M:%S UTC%z")


def default_tools() -> list[Tool]:
    return [
        Tool(ToolSpec(
            "calculate", "Evaluate an arithmetic expression such as (3 + 4) * 12 / 5.",
            {"type": "object", "properties": {"expression": {"type": "string", "description": "The expression."}},
             "required": ["expression"]},
        ), calculate),
        Tool(ToolSpec(
            "get_time", "Get the current date and time at a UTC offset.",
            {"type": "object", "properties": {"utc_offset_hours": {
                "type": "number", "description": "Hours from UTC, for example 2 or -5.5. Defaults to 0."}},
             "required": []},
        ), get_time),
    ]
