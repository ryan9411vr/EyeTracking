// Copies tensorflow.dll from napi-v9 (if present) to napi-v8 when missing.
const fs = require('fs');
const path = require('path');

const base = path.join(
  __dirname, '..',
  'node_modules', '@tensorflow', 'tfjs-node-gpu', 'lib'
);

const from = path.join(base, 'napi-v9', 'tensorflow.dll');
const to   = path.join(base, 'napi-v8', 'tensorflow.dll');

if (fs.existsSync(from) && !fs.existsSync(to)) {
  fs.copyFileSync(from, to);
  console.log('tfjs‑node‑gpu: copied tensorflow.dll to napi-v8');
}
