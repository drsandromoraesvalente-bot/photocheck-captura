// Offline deployment audit. Missing recordings are an explicit, nonfatal default.
const fs = require('node:fs');
const path = require('node:path');
const dir = path.join(__dirname, '../audio');
const script = fs.readFileSync(path.join(dir, 'ROTEIRO.txt'), 'utf8');
const expected = [...script.matchAll(/^\d+\. ([a-z0-9-]+\.mp3)$/gm)].map(m => m[1]);
if (expected.length !== 39 || new Set(expected).size !== expected.length) throw Error('Roteiro inesperado');
const missing = expected.filter(name => !fs.existsSync(path.join(dir, name)) || fs.statSync(path.join(dir, name)).size === 0);
console.log(JSON.stringify({expected:expected.length, available:expected.length-missing.length, missing}, null, 2));
if (process.argv.includes('--strict') && missing.length) process.exitCode = 1;
