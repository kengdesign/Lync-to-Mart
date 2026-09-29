#!/usr/bin/env python3
"""Restore a trusted Mart SQL export into an isolated temp DB and check its R2 copy.
No network access, no credentials, and no restore into an existing database.
"""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import sqlite3
import tempfile


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def authorize(action, arg1, arg2, database, trigger):
    if action in (sqlite3.SQLITE_ATTACH, sqlite3.SQLITE_DETACH):
        return sqlite3.SQLITE_DENY
    if action == sqlite3.SQLITE_PRAGMA and arg1.lower() not in ('foreign_keys', 'defer_foreign_keys'):
        return sqlite3.SQLITE_DENY
    if action == sqlite3.SQLITE_FUNCTION and (arg2 or '').lower() in ('load_extension', 'readfile', 'writefile'):
        return sqlite3.SQLITE_DENY
    return sqlite3.SQLITE_OK


def verify(sql, media, expected=None):
    sql, media = Path(sql), Path(media).resolve(strict=True)
    report = {'ok': False, 'database_sha256': digest(sql), 'tables': {}, 'media_files': 0,
              'media_bytes': 0, 'media_sha256': {}, 'errors': []}
    with tempfile.TemporaryDirectory(prefix='mart-restore-check-') as tmp:
        db = sqlite3.connect(str(Path(tmp) / 'restored.sqlite'))
        try:
            db.set_authorizer(authorize)
            db.executescript(sql.read_text(encoding='utf-8-sig'))
            db.set_authorizer(None)
            if db.execute('PRAGMA integrity_check').fetchall() != [('ok',)]:
                report['errors'].append('SQLite integrity check failed')
            if db.execute('PRAGMA foreign_key_check').fetchone():
                report['errors'].append('Foreign key references are broken')
            expected_db = sqlite3.connect(':memory:')
            try:
                for migration in sorted((Path(__file__).resolve().parent.parent / 'migrations').glob('*.sql')):
                    expected_db.executescript(migration.read_text())
                tables = [row[0] for row in expected_db.execute("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%'")]
                for table in tables:
                    safe = '"' + table.replace('"', '""') + '"'
                    columns = {row[1] for row in db.execute('PRAGMA table_info(' + safe + ')')}
                    required = {row[1] for row in expected_db.execute('PRAGMA table_info(' + safe + ')')}
                    if not required.issubset(columns):
                        report['errors'].append('Missing table/columns: ' + table)
                    else:
                        report['tables'][table] = db.execute('SELECT COUNT(*) FROM ' + safe).fetchone()[0]
            finally:
                expected_db.close()
            if 'media' in report['tables']:
                for key, size in db.execute('SELECT key,size FROM media ORDER BY key'):
                    parts = PurePosixPath(key)
                    if not key or parts.is_absolute() or '..' in parts.parts or '\\' in key or ':' in key:
                        report['errors'].append('Invalid media key'); continue
                    path = media.joinpath(*parts.parts)
                    if path.is_symlink() or not path.resolve().is_relative_to(media) or not path.is_file():
                        report['errors'].append('Missing or unsafe media: ' + key); continue
                    if path.stat().st_size != size:
                        report['errors'].append('Media size mismatch: ' + key); continue
                    report['media_sha256'][key] = digest(path)
                    report['media_files'] += 1
                    report['media_bytes'] += size
        finally:
            db.close()
    if expected:
        previous = json.loads(Path(expected).read_text())
        if not previous.get('ok'):
            report['errors'].append('Expected report was not a successful verification')
        for field in ('database_sha256', 'media_sha256', 'tables'):
            if previous.get(field) != report[field]:
                report['errors'].append('Snapshot differs from expected report: ' + field)
    report['ok'] = not report['errors']
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sql', required=True)
    parser.add_argument('--media', required=True)
    parser.add_argument('--expected', help='Previous successful report for this exact snapshot')
    args = parser.parse_args()
    try:
        result = verify(args.sql, args.media, args.expected)
    except Exception as error:
        # Do not print SQL values, which can contain hashes/tokens/member data.
        result = {'ok': False, 'errors': ['Verification failed (' + type(error).__name__ + ')']}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    raise SystemExit(0 if result['ok'] else 1)
