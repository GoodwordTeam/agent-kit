# Security review checklist

The category checklist behind `pack-secure`'s constraints. `code-review/security` works through the
categories the change touches and cites the item in a finding. An unchecked item is a question for
the change, not a finding on its own; the finding is what the change shows or fails to show.

Numbers such as a hashing cost, a rate limit or a retention period are project facts read from the
knowledgebase, never values assumed here.

## Authentication

- Passwords are hashed with an adaptive function (bcrypt, scrypt or argon2) at the project's cost setting.
- Session tokens are `httpOnly`, `secure` and `sameSite`.
- Login is rate limited, with the limiter backed by a shared store when more than one instance serves traffic.
- Password reset tokens expire.

## Authorization

- Every endpoint checks the caller's permissions.
- A user reaches only their own resources, and a tenant only its own.
- Admin actions verify the admin role.
- Feature-flag and entitlement gates that control reachability are checked like any other permission.

## Input

- All user input is validated at the boundary.
- SQL queries are parameterized.
- HTML output is encoded or escaped.
- Server-side fetches of influenced URLs are allowlisted by scheme and host, reject any private or
  reserved resolved address (loopback, link-local metadata endpoints, private and unique-local
  ranges), and refuse redirects. For high-risk surfaces, resolve once and connect to the pinned
  address, since a second resolution reopens the check.
- Delete, move or overwrite targets built from data are checked against an allowlisted root, a
  minimum depth and ownership evidence read before the operation, after resolving symlinks.

## Data

- No secrets in code or version control.
- Sensitive fields are excluded from API responses.
- Personal data is encrypted at rest where the project requires it.
- Personal data is classified, collected against a stated purpose and minimized.
- Personal data has a retention limit and a working deletion path, including backups and indexes.
- Export and deletion requests are supported where required, and sharing with third parties has consent.

## Infrastructure

- Security headers are configured (CSP, HSTS and the rest the project requires).
- CORS is restricted to known origins, never a wildcard.
- Error messages do not expose internals or stack traces.

## Supply chain

Dependency changes are `pack-deps`'s ground. When a change here also adds or bumps a dependency,
that pack attaches and carries these items.

- One authoritative lockfile is committed, and CI uses that manager's frozen install.
- The native audit is triaged by reachability and fix risk, and dependency install scripts are blocked unless approved.
- New dependencies are reviewed for ownership, provenance, release age and transitive graph.

## AI and model features

- Model output is treated as untrusted: never passed to `eval`, SQL, `innerHTML` or a shell.
- Secrets and other users' data are kept out of prompts.
- Tool and agent permissions are scoped, and destructive actions require confirmation.
