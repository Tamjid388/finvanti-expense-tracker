"""One-off maintenance: clear the stale test database (pgbouncer-safe)."""
import os

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.db import connection  # noqa: E402

with connection.cursor() as cur:
    cur.execute(
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
        "WHERE datname = 'test_neondb' AND pid <> pg_backend_pid()"
    )
    print("terminated pgbouncer sessions:", cur.rowcount)
    cur.execute("DROP DATABASE IF EXISTS test_neondb")
    print("dropped test_neondb")
