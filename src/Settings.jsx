import { useRef, useState } from "react";
import { helloSupported } from "./crypto.js";

export default function Settings({
  vault,
  onClose,
  onEnableHello,
  onDisableHello,
  onChangePass,
  onBackup,
  onRestore,
}) {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [pass, setPass] = useState("");
  const [again, setAgain] = useState("");
  const fileRef = useRef(null);

  const run = async (fn, ok) => {
    setBusy(true);
    setMsg("");
    try {
      await fn();
      setMsg(ok);
    } catch (e) {
      setMsg(e?.name === "NotAllowedError" ? "Cancelled." : e?.message || "That didn't work.");
    }
    setBusy(false);
  };

  const changePass = () => {
    if (pass.length < 12) return setMsg("Use at least 12 characters.");
    if (pass !== again) return setMsg("The two passphrases don't match.");
    run(async () => {
      await onChangePass(pass);
      setPass("");
      setAgain("");
    }, "Passphrase changed.");
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>Settings</h2>

        <h3>Windows Hello</h3>
        <p className="muted">
          Unlock with your Windows PIN, fingerprint or face instead of typing the passphrase. Your
          passphrase keeps working as a fallback and recovery. It needs a browser and Windows setup
          that support the WebAuthn PRF extension; if not, you&apos;ll see an error here and nothing
          changes.
        </p>
        {vault.hello ? (
          <button
            className="ghost"
            disabled={busy}
            onClick={() => run(onDisableHello, "Windows Hello turned off.")}
          >
            Turn off Windows Hello
          </button>
        ) : (
          <button
            className="ghost"
            disabled={busy || !helloSupported()}
            onClick={() =>
              run(onEnableHello, "Windows Hello is on. You'll see two prompts; that's expected.")
            }
          >
            {helloSupported() ? "Turn on Windows Hello" : "Not supported in this browser"}
          </button>
        )}

        <h3>Change passphrase</h3>
        <div className="grid">
          <label>
            New passphrase
            <input
              type="password"
              autoComplete="new-password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
            />
          </label>
          <label>
            Repeat
            <input
              type="password"
              autoComplete="new-password"
              value={again}
              onChange={(e) => setAgain(e.target.value)}
            />
          </label>
        </div>
        <p>
          <button className="ghost" disabled={busy || !pass} onClick={changePass}>
            Change passphrase
          </button>
        </p>

        <h3>Backup</h3>
        <p className="muted">
          The backup is the encrypted vault file, so it is safe to store anywhere, but it still
          needs your passphrase. Live data is in <code>data/vault.json</code>, with the previous
          save in <code>data/vault.prev.json</code>.
        </p>
        <div className="rowbtns">
          <button className="ghost" onClick={onBackup}>
            Download encrypted backup
          </button>
          <button className="ghost" onClick={() => fileRef.current.click()}>
            Restore from backup…
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) run(() => onRestore(f), "Restored. Locking…");
            }}
          />
        </div>

        <h3>Locking</h3>
        <p className="muted">
          The app locks itself after 5 minutes without activity. Revealed values hide again after 15
          seconds, and copied values are cleared from the clipboard after 20 seconds.
        </p>

        {msg && <p className="notice">{msg}</p>}
        <div className="modalactions">
          <span style={{ flex: 1 }} />
          <button onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
