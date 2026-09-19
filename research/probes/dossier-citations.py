#!/usr/bin/env python3
"""Resolve every donor citation in research/dossiers/ against its pinned clone.

Run from the repo root. Reports, per dossier: how many distinct citations use the
canonical `<lock-id>@<full-40-sha>:<path>` form, how many use a tolerated alias or
an abbreviated sha, and how many name something that is not in the pinned tree.

The alias map is deliberately generous -- it accepts the lock id, the repo name,
the owner_name clone directory, and the two initialisms the dossiers actually use
-- because the point is to separate "cites a thing that is not there" from "spells
a donor differently". Only the first is a defect in the research.
"""
import re, subprocess, glob, sys

lock = open('provenance/upstream.lock.yaml').read()
m = {}
cur = None
for line in lock.split('\n'):
    a = re.match(r'^  - id:\s*(\S+)', line)
    if a:
        cur = a.group(1)
    for key in ('path', 'commit', 'repo'):
        b = re.match(r'^    %s:\s*(\S+)' % key, line)
        if b and cur:
            m[(cur, key)] = b.group(1)

ids = sorted({c for c, _ in m})
alias = {}
for i in ids:
    owner, name = m[(i, 'repo')].split('/')
    for spelling in (i, name, owner + '_' + name):
        alias[spelling.lower()] = i
alias['ce'] = 'compound-engineering'
alias['sp'] = 'superpowers'

cache = {}
def exists_at_pin(donor_id, sha, path):
    key = (donor_id, sha, path)
    if key not in cache:
        r = subprocess.run(['git', '-C', m[(donor_id, 'path')], 'cat-file', '-e', f'{sha}:{path}'],
                           capture_output=True)
        cache[key] = r.returncode == 0
    return cache[key]

CITATION = re.compile(r'([A-Za-z][A-Za-z0-9_-]*)@([0-9a-f]{7,40}):([^\s`)\],]*)')

total_noncanonical = 0
total_unresolved = 0
print(f"{'dossier':26s} {'distinct':>8s} {'canonical':>9s} {'needs-fix':>9s} {'unresolved':>10s}")
for f in sorted(glob.glob('research/dossiers/*.md')):
    distinct = sorted(set(CITATION.findall(open(f).read())))
    canonical = noncanonical = 0
    unresolved = []
    for donor, sha, path in distinct:
        i = alias.get(donor.lower())
        if i is None:
            unresolved.append(('unknown-alias', donor, sha, path))
            continue
        pin = m[(i, 'commit')]
        if not pin.startswith(sha):
            unresolved.append(('sha-not-pin', donor, sha, path))
            continue
        if donor == i and len(sha) == 40:
            canonical += 1
        else:
            noncanonical += 1
        bare = path.split('#')[0].rstrip('.,;:')
        if bare == '':
            unresolved.append(('empty-path', donor, sha, path))
        elif not exists_at_pin(i, pin, bare):
            unresolved.append(('missing-at-pin', donor, sha, path))
    print(f"{f.split('/')[-1]:26s} {len(distinct):8d} {canonical:9d} {noncanonical:9d} {len(unresolved):10d}")
    for kind, donor, sha, path in unresolved:
        print(f"      {kind} | {donor}@{sha}:{path}")
    total_noncanonical += noncanonical
    total_unresolved += len(unresolved)

print()
print(f"TOTAL needs-fix {total_noncanonical}  unresolved {total_unresolved}")
sys.exit(1 if total_unresolved else 0)
