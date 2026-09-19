#!/usr/bin/env python3
"""Resolve every donor citation in research/dossiers/ against its pinned clone.

Run from the repo root. Reports, per dossier: how many distinct citations use the
canonical `<lock-id>@<full-40-sha>:<path>` form, how many use a tolerated alias or
an abbreviated sha, and how many name something that is not in the pinned tree.

A citation may also be a bare `<donor>@<sha>` pin reference with no path -- the dossiers
use these to state which commit a section was researched against. Those carry no path to
resolve, but they do carry a donor and a sha, so they are spell-checked like any other
citation and reported in their own column rather than skipped. Skipping them would make a
wrong sha in a pin reference silent.

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

# The `:path` tail is optional: absent means a pin reference, `:` with nothing after it
# means a malformed citation, and the two are different findings.
CITATION = re.compile(r'([A-Za-z][A-Za-z0-9_-]*)@([0-9a-f]{7,40})(:[^\s`)\],]*)?')

total_noncanonical = 0
total_unresolved = 0
total_pinrefs = 0
print(f"{'dossier':26s} {'distinct':>8s} {'canonical':>9s} {'needs-fix':>9s} {'pin-refs':>8s} {'unresolved':>10s}")
for f in sorted(glob.glob('research/dossiers/*.md')):
    distinct = sorted(set(CITATION.findall(open(f).read())))
    canonical = noncanonical = pinrefs = 0
    unresolved = []
    for donor, sha, tail in distinct:
        i = alias.get(donor.lower())
        if i is None:
            unresolved.append(('unknown-alias', donor, sha, tail))
            continue
        pin = m[(i, 'commit')]
        if not pin.startswith(sha):
            unresolved.append(('sha-not-pin', donor, sha, tail))
            continue
        if donor == i and len(sha) == 40:
            canonical += 1
        else:
            noncanonical += 1
        if tail == '':
            # A pin reference: spelling checked above, nothing to resolve in the tree.
            pinrefs += 1
            continue
        path = tail[1:]
        bare = path.split('#')[0].rstrip('.,;:')
        if bare == '':
            unresolved.append(('empty-path', donor, sha, tail))
        elif not exists_at_pin(i, pin, bare):
            unresolved.append(('missing-at-pin', donor, sha, tail))
    print(f"{f.split('/')[-1]:26s} {len(distinct):8d} {canonical:9d} {noncanonical:9d} {pinrefs:8d} {len(unresolved):10d}")
    for kind, donor, sha, tail in unresolved:
        print(f"      {kind} | {donor}@{sha}{tail}")
    total_noncanonical += noncanonical
    total_unresolved += len(unresolved)
    total_pinrefs += pinrefs

print()
print(f"TOTAL needs-fix {total_noncanonical}  pin-refs {total_pinrefs}  unresolved {total_unresolved}")
sys.exit(1 if total_unresolved else 0)
