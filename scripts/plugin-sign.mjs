#!/usr/bin/env node
// plugin-sign.mjs — plugin-bundle signing for the micro-frontend system.
//
// The host (browser loader.ts + Go pluginhost) verifies this signature
// before EXECUTING a plugin bundle. It is the security boundary of the
// plugin system: an unsigned / mismatched bundle is rejected, so a
// MITM'd bundle URL cannot inject code into a user's session.
//
// Usage:
//   node plugin-sign.mjs keygen
//       → prints the private key (PKCS8 PEM) + the minisign public key.
//         Private key → CI secret PLUGIN_SIGNING_KEY.
//         Public key  → bake into the host (loader.ts + pluginhost).
//   node plugin-sign.mjs sign <bundle> [--comment "<text>"]
//       → reads $PLUGIN_SIGNING_KEY, writes <bundle>.minisig.
//
// Format: minisign LEGACY ("Ed") — Ed25519 over the raw bundle bytes,
// no prehash. The browser then verifies with pure WebCrypto (no
// BLAKE2b dependency); the Go pluginhost verifies with crypto/ed25519.
// `minisign -V` can verify the output too.

import crypto from 'node:crypto'
import fs from 'node:fs'

const ALGO = Buffer.from('Ed') // minisign legacy Ed25519 (vs prehashed "ED")

/** rawPub(KeyObject) → 32-byte Ed25519 public key. */
function rawPub(pubKey) {
  const jwk = pubKey.export({ format: 'jwk' })
  return Buffer.from(jwk.x, 'base64url')
}

/** keyId(pub32) → 8 bytes, deterministic from the public key — so the
 *  signer needs only the private key, never a separate id. */
function keyId(pub32) {
  return crypto.createHash('sha256').update(pub32).digest().subarray(0, 8)
}

function keygen() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519')
  const pub = rawPub(publicKey)
  const pubLine = Buffer.concat([ALGO, keyId(pub), pub]).toString('base64')
  console.log('# --- PRIVATE KEY — set as CI secret PLUGIN_SIGNING_KEY (keep secret!) ---')
  console.log(privateKey.export({ type: 'pkcs8', format: 'pem' }).trim())
  console.log()
  console.log('# --- PUBLIC KEY — bake into loader.ts PLUGIN_PUBKEY + pluginhost Config.Pubkey ---')
  console.log(pubLine)
}

function sign(bundlePath, comment) {
  const pem = process.env.PLUGIN_SIGNING_KEY
  if (!pem) {
    console.error('error: PLUGIN_SIGNING_KEY env var not set')
    process.exit(1)
  }
  const priv = crypto.createPrivateKey(pem)
  const id = keyId(rawPub(crypto.createPublicKey(priv)))

  const bundle = fs.readFileSync(bundlePath)
  const sig = crypto.sign(null, bundle, priv) // 64-byte Ed25519 over raw bundle

  const trusted = `timestamp:${Math.floor(Date.now() / 1000)}\t${comment || bundlePath}`
  const globalSig = crypto.sign(null, Buffer.concat([sig, Buffer.from(trusted)]), priv)

  const out =
    `untrusted comment: signature for ${bundlePath}\n` +
    Buffer.concat([ALGO, id, sig]).toString('base64') + '\n' +
    `trusted comment: ${trusted}\n` +
    globalSig.toString('base64') + '\n'

  fs.writeFileSync(bundlePath + '.minisig', out)
  console.log(`signed → ${bundlePath}.minisig`)
}

const [cmd, ...args] = process.argv.slice(2)
if (cmd === 'keygen') {
  keygen()
} else if (cmd === 'sign' && args[0]) {
  const ci = args.indexOf('--comment')
  sign(args[0], ci >= 0 ? args[ci + 1] : undefined)
} else {
  console.error('usage: plugin-sign.mjs keygen | sign <bundle> [--comment "<text>"]')
  process.exit(1)
}
