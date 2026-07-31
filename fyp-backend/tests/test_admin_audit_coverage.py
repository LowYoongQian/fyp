"""Every admin write endpoint must leave an audit log entry.

The point of the audit page is that an admin action can be traced afterwards, so a
write with no log is a silent hole in it -- exactly the gap this file exists to catch
when a new endpoint is added later.
"""
import ast
import os

ROUTERS = ("admin_academic.py", "admin_students.py", "admin_staff.py")
WRITE_DECORATORS = {"post", "put", "patch", "delete"}


def _write_endpoints(path):
    """Yield (function_name, logs_audit) for every write endpoint in a router file."""
    tree = ast.parse(open(path, encoding="utf-8").read())
    for node in ast.walk(tree):
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        methods = {
            d.func.attr
            for d in node.decorator_list
            if isinstance(d, ast.Call) and isinstance(d.func, ast.Attribute)
        }
        if not methods & WRITE_DECORATORS:
            continue
        logs = any(
            isinstance(n, ast.Call)
            and isinstance(n.func, ast.Name)
            and n.func.id == "log_admin_action"
            for n in ast.walk(node)
        )
        yield node.name, logs


def test_every_admin_write_logs_an_audit_entry():
    backend = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    here = os.path.join(backend, "routers")
    missing, checked = [], 0
    for filename in ROUTERS:
        for name, logs in _write_endpoints(os.path.join(here, filename)):
            checked += 1
            if not logs:
                missing.append(f"{filename}::{name}")
    assert checked > 0, "found no write endpoints -- the AST walk is broken, not the code"
    assert not missing, (
        "these admin write endpoints do not call log_admin_action, so the action would "
        f"not appear on the audit page: {missing}"
    )


if __name__ == "__main__":
    test_every_admin_write_logs_an_audit_entry()
    print("ok")
