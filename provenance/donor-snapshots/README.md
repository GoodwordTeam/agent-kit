# Donor snapshots

Every file here is a byte-for-byte copy of one donor file, taken at the commit
`provenance/upstream.lock.yaml` pins, that at least one row in
`provenance/adaptations.d/*.yaml` names as a `source:`. Nothing in this tree is
edited by hand, and nothing in it is an instruction to this package: these are the
upstream texts the catalog was adapted **from**, kept so a reader can compare an
adapted body with its source without cloning the donors.

Layout: `<donor>@<first 12 characters of the pin>/<path inside the donor>`, so the
directory name alone resolves back to a lock entry and a `git show` in its clone.

- **Written by** `research/probes/snapshot-donors.sh`, which also prunes any file no
  row cites any more. `--check` reports drift without writing.
- **Held by** `tests/donor-snapshots.test.ts`; what it fails on is stated once, in
  `AUTHORING.md` §5 (Provenance law).
- **Licensed** under each donor's own terms, in `provenance/licenses/`. The root
  `NOTICE` carries the attributions.
- **Never shipped.** `provenance/` is source-only in the packager and exempt from
  the content denylist, which these files would otherwise fail by design.
