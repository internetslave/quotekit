// Bump this string any time the chapter-kit prompt or response schema changes
// in a way that should invalidate existing cached results. Both the client
// (IndexedDB) and the server (file cache) check it before serving a hit.
//
// Keep this constant in sync between client and server. The server reads its
// own copy from server/promptVersion.js; if the two ever drift, the server
// value wins because the server makes the actual cache decision.
export const PROMPT_VERSION = "v1";
