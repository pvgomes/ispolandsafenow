// Test-only stand-in for the "cloudflare:workers" module, which only
// exists inside the Workers runtime. API route files import `env` from it
// at module scope; tests exercise the routes' extracted pure functions
// directly with a fake D1Database instead, so this stub's `env` is never
// actually read.
export const env = {} as never;
