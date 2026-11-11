// Copy is taken as written from the current site, the organisation profile and
// the three library READMEs. The `html` fields carry inline markup from those sources.

export const tagline =
	"Software security research, and the tools we build for it.";

export const links = {
	github: "https://github.com/Totative",
	repositories: "https://github.com/orgs/Totative/repositories",
	policy: "https://github.com/Totative/.github/blob/main/SECURITY.md",
	disclosure: "https://github.com/Totative/.github/blob/main/DISCLOSURE.md",
	advisories: "https://github.com/advisories?query=Totative",
} as const;

export const services = [
	{
		name: "Vulnerability research",
		text: "Finding bugs in software we don't own; disclosing them responsibly.",
	},
	{
		name: "Supply chain",
		text: "Provenance and CI hardening, shown on our own releases.",
	},
	{
		name: "Tooling",
		text: "Open-source security libraries, released when ready.",
	},
] as const;

interface ToolFacts {
	/** The library's own one-line description, from its README. */
	summary: string;
	/** Latest release tag. */
	version: string;
}

const tool = (name: string, text: string, facts: ToolFacts) => {
	const tarball = `${name}-${facts.version}.tar.gz`;
	return {
		name,
		text,
		...facts,
		href: `https://github.com/Totative/${name}`,
		release: `https://github.com/Totative/${name}/releases/tag/${facts.version}`,
		install: `go get github.com/Totative/${name}`,
		/** What each release publishes: the source tarball, its provenance bundle and the SBOM. */
		assets: [tarball, `${tarball}.intoto.jsonl`, "sbom.spdx.json"],
		download: `gh release download ${facts.version} --repo Totative/${name} --pattern '*.tar.gz'`,
		verify: `gh attestation verify ${tarball} --owner Totative`,
	};
};

export const tools = [
	tool(
		"go-avscan",
		"asks the machine’s antivirus about a folder: AMSI, clamd, or a command you name.",
		{
			summary:
				"Asks the machine’s antivirus about a folder of files: Windows AMSI, a clamd daemon, or a command you name.",
			version: "v0.3.0",
		},
	),
	tool(
		"go-keyring",
		"one credential store for a Go desktop app, with a sealed-file fallback inside Flatpak.",
		{
			summary:
				"One credential store for a Go desktop app: the OS keyring, with a sealed-file fallback inside a Flatpak.",
			version: "v0.3.0",
		},
	),
	tool("go-codepair", "pairs two devices on a LAN with a short typed code.", {
		summary:
			"Pair two devices on a LAN with a short human-typed code and an authenticated key exchange.",
		version: "v0.2.0",
	}),
] as const;

export const verifyCommand = "gh attestation verify <file> --owner Totative";

export const checks = [
	`Releases are built in CI and carry signed provenance and an SBOM. Verify any of them with <code>${verifyCommand.replace("<", "&lt;").replace(">", "&gt;")}</code>.`,
	"Every commit and tag is signed.",
	'Public repositories run CodeQL and publish an <a href="https://scorecard.dev">OpenSSF Scorecard</a>.',
	"Vulnerability reports come in privately; advisories and CVEs go out through GitHub, with credit to the reporter.",
] as const;

export const reportVulnerability = `Use <strong>Report a vulnerability</strong> on the repository’s <strong>Security</strong> tab, not a public issue. Scope and what we commit to are in the <a href="${links.policy}">security policy</a>.`;

export const definition =
	"A <strong>totative</strong> of <em>n</em> is a positive integer up to <em>n</em> that shares no factor with it other than 1. Euler’s totient function counts them; RSA is built on it.";

export const noWriteups = `No write-ups published yet. Advisories appear on GitHub first: <a href="${links.advisories}">GitHub advisories</a>`;

// The letters are the ones the two designs had among the first eight.
export const designs = [{ id: "e", name: "Lattice" }] as const;

export type DesignId = (typeof designs)[number]["id"];
