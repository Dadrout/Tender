#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
python_bin="${PYTHON_BIN:-python3}"
"$python_bin" -c 'import sys; assert sys.version_info >= (3,12), "Python 3.12+ required"'
"$python_bin" -m venv .venv
.venv/bin/python -m pip install -r apps/api/requirements.lock.txt
(cd apps/web && npm ci)
.venv/bin/python scripts/generate_demo.py
printf 'Ready. Start with ./scripts/dev.sh\n'
