#!/usr/bin/env node
// Encrypt tools/private/bundle.json into data/vault.json (the only question data that is published).
//
// Password source, in order: QUIZ_PASSWORD env var, then tools/private/.password.
// If neither exists, a random passphrase is generated and saved to tools/private/.password.
//
// Usage: node tools/encrypt.mjs
//        QUIZ_PASSWORD='my new password' node tools/encrypt.mjs   # change the password
import { randomBytes, pbkdf2Sync, createCipheriv } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PRIVATE = join(ROOT, 'tools', 'private');
const PW_FILE = join(PRIVATE, '.password');
const ITERATIONS = 600000;

function wordPassphrase() {
  const words = ['amber', 'basil', 'cedar', 'delta', 'ember', 'fjord', 'gecko', 'harbor', 'indigo', 'jasper',
    'kiwi', 'lotus', 'maple', 'nectar', 'onyx', 'pepper', 'quartz', 'raven', 'sierra', 'tulip', 'umber',
    'velvet', 'willow', 'xenon', 'yarrow', 'zephyr', 'orbit', 'cobalt', 'meadow', 'summit', 'lantern', 'pixel'];
  const pick = () => words[randomBytes(1)[0] % words.length];
  return [pick(), pick(), pick(), pick(), String(randomBytes(2).readUInt16BE() % 1000).padStart(3, '0')].join('-');
}

let password = process.env.QUIZ_PASSWORD;
if (password) {
  writeFileSync(PW_FILE, password + '\n', { mode: 0o600 });
} else if (existsSync(PW_FILE)) {
  password = readFileSync(PW_FILE, 'utf8').trim();
} else {
  password = wordPassphrase();
  mkdirSync(PRIVATE, { recursive: true });
  writeFileSync(PW_FILE, password + '\n', { mode: 0o600 });
  console.log(`Generated a new password and saved it to ${PW_FILE}`);
}
if (password.length < 8) throw new Error('Password must be at least 8 characters.');

const plain = gzipSync(readFileSync(join(PRIVATE, 'bundle.json')), { level: 9 });
const salt = randomBytes(16);
const iv = randomBytes(12);
const key = pbkdf2Sync(password, salt, ITERATIONS, 32, 'sha256');
const cipher = createCipheriv('aes-256-gcm', key, iv);
const ct = Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()]); // WebCrypto layout

mkdirSync(join(ROOT, 'data'), { recursive: true });
writeFileSync(join(ROOT, 'data', 'vault.json'), JSON.stringify({
  v: 1, kdf: 'PBKDF2-SHA256', iter: ITERATIONS, cipher: 'AES-256-GCM', gzip: true,
  salt: salt.toString('base64'), iv: iv.toString('base64'), ct: ct.toString('base64'),
}));
console.log(`data/vault.json written (${(ct.length / 1048576).toFixed(1)} MB encrypted).`);
