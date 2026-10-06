// Vault crypto (WebCrypto only, no dependencies).
//
// A random 256-bit data key (DEK) encrypts the whole app state with AES-GCM. The DEK is stored
// wrapped (encrypted) by a key derived from your passphrase (PBKDF2-SHA256), and optionally also
// wrapped by a key from Windows Hello via the WebAuthn PRF extension. Anyone without the passphrase
// (or your Hello credential) only sees ciphertext.

const enc = new TextEncoder();
const dec = new TextDecoder();
const ITER = 600_000;
const AES = { name: "AES-GCM" };

export function b64(buf) {
  const u = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}
export const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

const rand = (n) => crypto.getRandomValues(new Uint8Array(n));
const aesKey = (raw) => crypto.subtle.importKey("raw", raw, AES, false, ["encrypt", "decrypt"]);

async function seal(key, bytes) {
  const iv = rand(12);
  const ct = await crypto.subtle.encrypt({ ...AES, iv }, key, bytes);
  return { iv: b64(iv), ct: b64(ct) };
}

async function open(key, box) {
  return new Uint8Array(
    await crypto.subtle.decrypt({ ...AES, iv: unb64(box.iv) }, key, unb64(box.ct)),
  );
}

async function passKey(pass, salt, iter) {
  const base = await crypto.subtle.importKey(
    "raw",
    enc.encode(pass.normalize("NFKC")),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: iter, hash: "SHA-256" },
    base,
    { ...AES, length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export const sealState = (session, state) => seal(session.key, enc.encode(JSON.stringify(state)));

async function openState(session, vault) {
  return JSON.parse(dec.decode(await open(session.key, vault.data)));
}

export async function createVault(pass, state) {
  const salt = rand(16);
  const dek = rand(32);
  const session = { dek, key: await aesKey(dek) };
  const wrapPass = await seal(await passKey(pass, salt, ITER), dek);
  const data = await sealState(session, state);
  return {
    vault: { v: 1, rev: 0, kdf: { iter: ITER, salt: b64(salt) }, wrapPass, hello: null, data },
    session,
  };
}

export async function unlockWithPassphrase(vault, pass) {
  const kek = await passKey(pass, unb64(vault.kdf.salt), vault.kdf.iter);
  const dek = await open(kek, vault.wrapPass); // throws on a wrong passphrase
  const session = { dek, key: await aesKey(dek) };
  return { session, state: await openState(session, vault) };
}

export async function changePassphrase(vault, session, newPass) {
  const salt = rand(16);
  const wrapPass = await seal(await passKey(newPass, salt, ITER), session.dek);
  return { ...vault, kdf: { iter: ITER, salt: b64(salt) }, wrapPass };
}

// ---- Windows Hello (WebAuthn platform authenticator + PRF) ----

export const helloSupported = () => typeof window !== "undefined" && !!window.PublicKeyCredential;

async function prfSecret(credId, prfSalt) {
  const cred = await navigator.credentials.get({
    publicKey: {
      challenge: rand(32),
      allowCredentials: [{ type: "public-key", id: unb64(credId) }],
      userVerification: "required",
      timeout: 60000,
      extensions: { prf: { eval: { first: unb64(prfSalt) } } },
    },
  });
  const secret = cred?.getClientExtensionResults?.().prf?.results?.first;
  if (!secret)
    throw new Error("This browser or Windows setup can't derive a key from Windows Hello (PRF).");
  return secret;
}

export async function enableHello(vault, session) {
  const cred = await navigator.credentials.create({
    publicKey: {
      rp: { name: "Provider Tracker" },
      user: { id: rand(16), name: "provider-tracker", displayName: "Provider Tracker" },
      challenge: rand(32),
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "discouraged",
      },
      extensions: { prf: {} },
      timeout: 60000,
    },
  });
  const credId = b64(cred.rawId);
  const prfSalt = b64(rand(32));
  const secret = await prfSecret(credId, prfSalt); // second prompt: proves PRF works before we rely on it
  const wrap = await seal(await aesKey(secret), session.dek);
  return { ...vault, hello: { credId, prfSalt, ...wrap } };
}

export async function unlockWithHello(vault) {
  const { credId, prfSalt } = vault.hello;
  const secret = await prfSecret(credId, prfSalt);
  const dek = await open(await aesKey(secret), vault.hello);
  const session = { dek, key: await aesKey(dek) };
  return { session, state: await openState(session, vault) };
}

export const disableHello = (vault) => ({ ...vault, hello: null });
