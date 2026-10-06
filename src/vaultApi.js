// Talks to the local vault endpoint (see vite.config.js). Only ciphertext crosses this boundary.

export async function getVault() {
  const r = await fetch("/api/vault", { cache: "no-store" });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Vault server answered ${r.status}`);
  return r.json();
}

export async function putVault(vault, { force = false } = {}) {
  const r = await fetch("/api/vault", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-vault": "1",
      "x-base-rev": String(vault.rev ?? 0),
      ...(force ? { "x-force": "1" } : {}),
    },
    body: JSON.stringify(vault),
  });
  if (r.status === 409) {
    const e = new Error("conflict");
    e.code = "conflict";
    throw e;
  }
  if (!r.ok) throw new Error(`Vault server answered ${r.status}`);
  return r.json(); // { rev }
}
