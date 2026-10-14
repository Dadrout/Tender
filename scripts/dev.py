"""One local stack owner; stop both process groups on Ctrl+C or child failure."""

import os, signal, subprocess, sys, time, shutil
from pathlib import Path
from dotenv import load_dotenv

root = Path(__file__).resolve().parents[1]
load_dotenv(root / ".env")
env = dict(os.environ)
if not env.get("QAZBID_DATA_DIR"):
    env.pop("QAZBID_DATA_DIR", None)
api_port = env.get("QAZBID_API_PORT", "8000")
web_port = env.get("QAZBID_WEB_PORT", "3000")
env["API_URL"] = f"http://127.0.0.1:{api_port}"
children = []


def stop(signum=None, frame=None):
    for p in children:
        if p.poll() is None:
            if os.name == "posix":
                os.killpg(p.pid, signal.SIGTERM)
            else:
                p.terminate()
    for p in children:
        try:
            p.wait(timeout=8)
        except subprocess.TimeoutExpired:
            if os.name == "posix":
                os.killpg(p.pid, signal.SIGKILL)
            else:
                p.kill()
    if signum:
        sys.exit(0)


signal.signal(signal.SIGINT, stop)
signal.signal(signal.SIGTERM, stop)
try:
    children.append(
        subprocess.Popen(
            [
                sys.executable,
                "-m",
                "uvicorn",
                "qazbid.main:app",
                "--host",
                "127.0.0.1",
                "--port",
                api_port,
            ],
            cwd=root / "apps/api",
            env=env,
            start_new_session=True,
        )
    )
    children.append(
        subprocess.Popen(
            [
                shutil.which("node") or "node",
                str(root / "apps/web/node_modules/next/dist/bin/next"),
                "dev",
                "--hostname",
                "127.0.0.1",
                "--port",
                web_port,
            ],
            cwd=root / "apps/web",
            env=env,
            start_new_session=True,
        )
    )
    print(
        f"QazBid AI: http://127.0.0.1:{web_port}\nDemo: http://127.0.0.1:{web_port}/demo",
        flush=True,
    )
    while all(p.poll() is None for p in children):
        time.sleep(0.3)
    code = next((p.returncode for p in children if p.poll() is not None), 1)
    sys.exit(code or 0)
finally:
    stop()
