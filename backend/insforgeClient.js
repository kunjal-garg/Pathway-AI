/**
 * The package name @insforge/insforge-js is installed as an alias to
 * @insforge/sdk (the name @insforge/insforge-js is not on npm). The public API
 * is createClient with baseUrl + anonKey (not new InsForge({ projectUrl, apiKey })).
 *
 * The SDK's CommonJS build requires @insforge/shared-schemas, which is ESM-only; use
 * dynamic import() so Node resolves the ESM entry. The default export is a Promise
 * of the client — in server code: const insforge = await require('./insforgeClient');
 */
const insforge = import("@insforge/insforge-js").then(({ createClient }) =>
  createClient({
    baseUrl: process.env.INSFORGE_API_URL,
    anonKey: process.env.INSFORGE_API_KEY,
  })
);

module.exports = insforge;
