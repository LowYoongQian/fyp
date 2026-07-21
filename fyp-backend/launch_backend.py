from __future__ import annotations

import signal
import subprocess
import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parent
BACKEND_PYTHON = BACKEND_DIR / ".venv" / "Scripts" / "python.exe"
HOST = "0.0.0.0"
PORT = "8000"


def stop_process_tree(process: subprocess.Popen[bytes]) -> None:
    if process.poll() is not None:
        return

    try:
        process.send_signal(signal.CTRL_BREAK_EVENT)
        process.wait(timeout=5)
        return
    except Exception:
        pass

    subprocess.run(
        ["taskkill", "/PID", str(process.pid), "/T", "/F"],
        cwd=BACKEND_DIR,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )

    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        pass


def main() -> int:
    if not BACKEND_PYTHON.exists():
        print("Backend venv not found:")
        print(f"  {BACKEND_PYTHON}")
        print()
        print("Create it first with:")
        print("  setup_backend.bat")
        return 1

    extra_args = sys.argv[1:]
    if "--reload" not in extra_args and "--no-reload" not in extra_args:
        extra_args = ["--reload", *extra_args]
    else:
        extra_args = [arg for arg in extra_args if arg != "--no-reload"]
    command = [
        str(BACKEND_PYTHON),
        "-m",
        "uvicorn",
        "main:app",
        "--host",
        HOST,
        "--port",
        PORT,
        *extra_args,
    ]

    print(f"Starting backend on http://{HOST}:{PORT}")
    if "--reload" in extra_args:
        print("Reload mode enabled.")
    else:
        print("Reload mode disabled.")
    print("Press Ctrl+C to stop the backend cleanly.")
    print()

    creationflags = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
    process = subprocess.Popen(command, cwd=BACKEND_DIR, creationflags=creationflags)

    try:
        return process.wait()
    except KeyboardInterrupt:
        print()
        print("Stopping backend...")
        stop_process_tree(process)
        return 0
    finally:
        stop_process_tree(process)


if __name__ == "__main__":
    raise SystemExit(main())
