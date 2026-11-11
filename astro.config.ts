import { defineConfig } from "astro/config";
import { tokenClasses } from "./src/lib/token-classes";

export default defineConfig({
	site: "https://totative.dev",
	trailingSlash: "always",
	server: { host: "0.0.0.0", port: 4321 },
	build: {
		inlineStylesheets: "never",
	},
	// The mocks are looked at in the dev server, where the toolbar would sit on top of every design.
	devToolbar: { enabled: false },
	vite: {
		// Keep small scripts and sheets as files so CSP can allow them via 'self'.
		build: { assetsInlineLimit: 0 },
		// The mocks are opened by machine name over the LAN and tailnet, not only by IP.
		server: { allowedHosts: true },
		preview: { allowedHosts: true },
	},
	markdown: {
		shikiConfig: { theme: "css-variables", transformers: [tokenClasses] },
	},
});
