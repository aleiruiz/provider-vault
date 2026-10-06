import { describe, expect, it } from "vitest";
import {
  changePassphrase,
  createVault,
  disableHello,
  sealState,
  unlockWithPassphrase,
} from "./crypto.js";

const state = { rows: [{ id: "a", name: "Provider A" }], secrets: [{ id: "s", value: "hunter2" }] };
const PASS = "correct horse battery staple";

describe("vault crypto", () => {
  it("round-trips state through a passphrase", async () => {
    const { vault } = await createVault(PASS, state);
    const { state: opened } = await unlockWithPassphrase(vault, PASS);
    expect(opened).toEqual(state);
  });

  it("never stores plaintext in the vault file", async () => {
    const { vault } = await createVault(PASS, state);
    const json = JSON.stringify(vault);
    expect(json).not.toContain("Provider A");
    expect(json).not.toContain("hunter2");
  });

  it("rejects a wrong passphrase", async () => {
    const { vault } = await createVault(PASS, state);
    await expect(unlockWithPassphrase(vault, "not the passphrase")).rejects.toThrow();
  });

  it("detects tampering with the encrypted data", async () => {
    const { vault, session } = await createVault(PASS, state);
    const box = await sealState(session, state);
    const flipped = box.ct.startsWith("A") ? "B" + box.ct.slice(1) : "A" + box.ct.slice(1);
    const tampered = { ...vault, data: { ...box, ct: flipped } };
    await expect(unlockWithPassphrase(tampered, PASS)).rejects.toThrow();
  });

  it("uses a fresh IV for every save", async () => {
    const { session } = await createVault(PASS, state);
    const a = await sealState(session, state);
    const b = await sealState(session, state);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ct).not.toBe(b.ct);
  });

  it("changes the passphrase without touching the data", async () => {
    const { vault, session } = await createVault(PASS, state);
    const next = await changePassphrase(vault, session, "a brand new passphrase");
    await expect(unlockWithPassphrase(next, PASS)).rejects.toThrow();
    const { state: opened } = await unlockWithPassphrase(next, "a brand new passphrase");
    expect(opened).toEqual(state);
  });

  it("turns Windows Hello off by clearing its wrapped key", async () => {
    const { vault } = await createVault(PASS, state);
    const withHello = { ...vault, hello: { credId: "x", prfSalt: "y", iv: "z", ct: "w" } };
    expect(disableHello(withHello).hello).toBeNull();
  });
});
