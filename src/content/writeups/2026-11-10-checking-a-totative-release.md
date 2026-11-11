---
title: Checking a Totative release
description: What we sign, what each release carries, how the pipeline that builds it is locked down, and the commands that check it without taking our word for it.
---

A security shop asking you to trust its downloads is a bit rich. So every release from [github.com/Totative](https://github.com/Totative) can be checked without trusting us; here's how, and what sits behind each check.

## What we sign

Every commit and tag in our public repositories is signed. Ours carry SSH signatures from keys registered on GitHub, and squash merges are signed by GitHub itself (so either way, GitHub shows them as Verified.) You can ask GitHub about any tag yourself:

```sh
sha=$(gh api repos/Totative/go-avscan/git/ref/tags/v0.3.0 --jq .object.sha)
gh api repos/Totative/go-avscan/git/tags/$sha --jq '.verification | {verified, reason}'
```

A good tag answers `"verified": true` with the reason `valid`.

Nothing reaches `main` by a direct push. A change goes through a pull request and a merge queue, so its checks run twice: once on the pull request, and again on the queue's test merge against the latest `main`. It lands only when CI and CodeQL pass both times. Force-pushes and deleting `main` are refused.

## What a release carries

A release starts with a signed tag. Pushing it runs the repository's `release.yml` on GitHub's own runners, which builds the source tarball and an SPDX SBOM, then attaches two attestations to the tarball: build provenance (which repository, workflow and commit produced the file) and the SBOM (what went into it).

Both are signed through Sigstore and recorded in its public transparency log, Rekor. If we ever swapped a file after the fact, the log would still say what was built.

## Checking one

You'll need the [GitHub CLI](https://cli.github.com). Using go-avscan v0.3.0 as the example:

```sh
gh release download v0.3.0 --repo Totative/go-avscan --pattern '*.tar.gz'
gh attestation verify go-avscan-v0.3.0.tar.gz --owner Totative
gh attestation verify go-avscan-v0.3.0.tar.gz --owner Totative \
  --predicate-type https://spdx.dev/Document/v2.3
```

The first check passes only if GitHub Actions built that exact file from a Totative repository's workflow. The second confirms the SBOM was made for that same file.

A pass is the short answer. For the long one, ask what the attestation says:

```sh
gh attestation verify go-avscan-v0.3.0.tar.gz --owner Totative \
  --format json \
  | jq '.[0].verificationResult.signature.certificate
        | {sourceRepositoryURI, sourceRepositoryRef,
           sourceRepositoryDigest, buildSignerURI}'
```

That names the repository, the tag, the exact commit and the workflow file that did the build; the commit is one you can open and read.

A pass means the file you hold came from source you can read, built where we say it was; it says nothing about bugs in that source (that part is still on us.)

The attestations cover the tarball, not the `sbom.spdx.json` beside it, so point the check at the tarball. If you use one of our Go libraries through `go get`, the Go checksum database already pins each module version for you; that's a separate check from this one.

## What CI is allowed to do

A signed release is only as good as the pipeline that built it, so ours is kept on a short leash:

- Every action is pinned to a full commit SHA, and the organisation refuses a workflow that names one by tag.
- Only GitHub's own actions and verified creators' run, plus three we name outright: OpenSSF Scorecard, Anchore's SBOM generator, and our shared CI setup actions.
- The default workflow token is read-only. A workflow asks for more per job; the release job gets permission to write the release and mint its attestations, and nothing else.
- Release jobs restore no cache. Each one starts on a clean runner, so nothing an earlier run left behind can end up in a published file.

## How we proved it

Before any repository shipped a release, we stood up a throwaway repository from our template and tried to break each control on purpose. The pre-commit hook stopped a planted token. GitHub turned away an unsigned push (`GH013`, "Commits must have verified signatures".) A pull request adding lodash 4.17.20, which has published advisories, failed dependency review. Then a signed `v0.0.1` tag produced a release that passed both checks above, and we deleted the repository.

## Limits worth knowing

Rekor entries are public and permanent; deleting a repository doesn't remove what the log recorded about it. Attestations also need a public repository on our GitHub plan, so the checks above cover what we publish and nothing kept private.

## If a check fails

Tell us. A failed verification, or a release with no attestation, counts as a vulnerability report, so send it the way our [security policy](https://github.com/Totative/.github/blob/main/SECURITY.md) describes rather than in a public issue.
