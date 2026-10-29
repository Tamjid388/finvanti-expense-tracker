"""Vercel serverless entrypoint for the Django API.

Vercel's Python runtime imports `app` from any file under `api/`.
`config.wsgi.application` is the Django WSGI app — Vercel calls it per request.
No code changes needed here when adding endpoints; just redeploy.
"""
import os
import sys
from pathlib import Path

# Ensure the project root (server/) is importable when Vercel runs api/index.py
# as a standalone function.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

from config.wsgi import application  # noqa: E402

app = application
