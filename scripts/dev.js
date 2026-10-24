// One command for local development: the demo fixture site (port 4100) and
// AccessBench (port 3000) in a single process.
await import('../fixtures/server.js');
await import('../src/server/index.js');
