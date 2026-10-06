import { useEffect, useState } from "react";

const MIN_LEN = 12;

export function Setup({ legacyCount, onCreate }) {
  const [pass, setPass] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (pass.length < MIN_LEN)
      return setErr(`Use at least ${MIN_LEN} characters. A few random words works well.`);
    if (pass !== again) return setErr("The two passphrases don't match.");
    setBusy(true);
    setErr("");
    try {
      await onCreate(pass);
    } catch (e2) {
      setErr(e2.message || "Couldn't create the vault.");
      setBusy(false);
    }
  };

  return (
    <div className="lockwrap">
      <form className="lockcard" onSubmit={submit}>
        <h1>Create your vault</h1>
        <p className="muted">
          Everything in this app (providers, costs and secrets) is encrypted with a master
          passphrase and saved to <code>data/vault.json</code>.
          {legacyCount > 0 && ` Your ${legacyCount} existing providers will be moved into it.`}
        </p>
        <label>
          Master passphrase
          <input
            type="password"
            autoFocus
            autoComplete="new-password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
          />
        </label>
        <label>
          Repeat it
          <input
            type="password"
            autoComplete="new-password"
            value={again}
            onChange={(e) => setAgain(e.target.value)}
          />
        </label>
        <p className="warnbox">
          <strong>There is no recovery.</strong> If you forget this passphrase the data cannot be
          opened by anyone, including me. Keep it somewhere safe and download a backup from Settings
          once you have secrets in here.
        </p>
        {err && <p className="error">{err}</p>}
        <button disabled={busy}>{busy ? "Creating…" : "Create vault"}</button>
      </form>
    </div>
  );
}

export function Unlock({ hasHello, onPass, onHello }) {
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [fails, setFails] = useState(0);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const fail = (msg) => {
    const n = fails + 1;
    setFails(n);
    setWait(Math.min(n * 2, 20));
    setErr(msg);
    setBusy(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!pass || wait > 0) return;
    setBusy(true);
    setErr("");
    try {
      await onPass(pass);
    } catch {
      setPass("");
      fail("Wrong passphrase.");
    }
  };

  const hello = async () => {
    setBusy(true);
    setErr("");
    try {
      await onHello();
    } catch (e2) {
      fail(
        e2?.name === "NotAllowedError"
          ? "Windows Hello was cancelled."
          : e2?.message || "Windows Hello failed.",
      );
    }
  };

  return (
    <div className="lockwrap">
      <form className="lockcard" onSubmit={submit}>
        <h1>Provider Tracker</h1>
        <p className="muted">Locked. Unlock to see your providers and secrets.</p>
        <label>
          Master passphrase
          <input
            type="password"
            autoFocus
            autoComplete="current-password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
          />
        </label>
        {err && <p className="error">{err}</p>}
        <button disabled={busy || wait > 0}>
          {wait > 0 ? `Try again in ${wait}s` : busy ? "Unlocking…" : "Unlock"}
        </button>
        {hasHello && (
          <button type="button" className="ghost" disabled={busy} onClick={hello}>
            Unlock with Windows Hello
          </button>
        )}
      </form>
    </div>
  );
}
