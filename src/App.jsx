import { useCallback, useEffect, useRef, useState } from "react";
import { SECRETS_SEED, SEED, SEED_VERSION } from "./seed/index.js";
import { mergeById } from "./logic.js";
import * as C from "./crypto.js";
import { getVault, putVault } from "./vaultApi.js";
import Tracker from "./Tracker.jsx";
import { Setup, Unlock } from "./Lock.jsx";
import Settings from "./Settings.jsx";

// Plaintext data from the first version of the app lived in localStorage. It is moved into the
// vault when you create it, then deleted.
const LEGACY_KEY = "provider-tracker:v1";
const LEGACY_VERSION = "provider-tracker:seedVersion";
const IDLE_MS = 5 * 60 * 1000;

function readLegacy() {
  try {
    const v = JSON.parse(localStorage.getItem(LEGACY_KEY) || "null");
    return Array.isArray(v) && v.length ? v : null;
  } catch {
    return null;
  }
}

function normalize(state) {
  if ((state.seedVersion || 1) >= SEED_VERSION) return state;
  return {
    rows: mergeById(state.rows || [], SEED),
    secrets: mergeById(state.secrets || [], SECRETS_SEED),
    seedVersion: SEED_VERSION,
  };
}

export default function App() {
  const [phase, setPhase] = useState("loading"); // loading | error | setup | locked | open
  const [error, setError] = useState("");
  const [vault, setVaultState] = useState(null);
  const [data, setData] = useState(null);
  const [saveStatus, setSaveStatus] = useState("saved");
  const [showSettings, setShowSettings] = useState(false);

  const vaultRef = useRef(null);
  const sessionRef = useRef(null);
  const dataRef = useRef(null);
  const savedRef = useRef(null);
  const queue = useRef(Promise.resolve());
  const timer = useRef(null);
  const legacy = useRef(readLegacy());

  const setVault = (v) => {
    vaultRef.current = v;
    setVaultState(v);
  };

  // Everything that writes the vault file runs one at a time, so revisions never collide with ourselves.
  const exclusive = useCallback((fn) => {
    const p = queue.current.then(fn);
    queue.current = p.catch(() => {});
    return p;
  }, []);

  const store = async (next) => {
    const { rev } = await putVault(next);
    setVault({ ...next, rev });
  };

  const persist = useCallback(async () => {
    const d = dataRef.current;
    const s = sessionRef.current;
    if (!d || !s || d === savedRef.current) return;
    setSaveStatus("saving");
    try {
      const box = await C.sealState(s, d);
      await store({ ...vaultRef.current, data: box });
      savedRef.current = d;
      setSaveStatus(dataRef.current === d ? "saved" : "saving");
    } catch (e) {
      setSaveStatus(e.code === "conflict" ? "conflict" : "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const v = await getVault();
        if (v) {
          setVault(v);
          setPhase("locked");
        } else setPhase("setup");
      } catch {
        setError(
          "Can't reach the local vault server. Start the app with npm run dev (or npm run dev:demo) in the project folder.",
        );
        setPhase("error");
      }
    })();
  }, []);

  useEffect(() => {
    dataRef.current = data;
    if (phase !== "open" || !data) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => exclusive(persist), 500);
    return () => clearTimeout(timer.current);
  }, [data, phase, exclusive, persist]);

  const openWith = ({ session, state }) => {
    const d = normalize(state);
    sessionRef.current = session;
    dataRef.current = d;
    savedRef.current = d === state ? d : null; // merged starter data gets saved right away
    setSaveStatus("saved");
    setData(d);
    setPhase("open");
  };

  const lock = useCallback(async () => {
    clearTimeout(timer.current);
    await exclusive(persist);
    sessionRef.current = null;
    dataRef.current = null;
    savedRef.current = null;
    setData(null);
    setShowSettings(false);
    setPhase("locked");
  }, [exclusive, persist]);

  useEffect(() => {
    if (phase !== "open") return;
    let t;
    const reset = () => {
      clearTimeout(t);
      t = setTimeout(lock, IDLE_MS);
    };
    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(t);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [phase, lock]);

  useEffect(() => {
    if (phase !== "open" || saveStatus === "saved") return;
    const warn = (e) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [phase, saveStatus]);

  const create = async (pass) => {
    const base = {
      rows: legacy.current ? mergeById(legacy.current, SEED) : SEED,
      secrets: SECRETS_SEED,
      seedVersion: SEED_VERSION,
    };
    const { vault: v, session } = await C.createVault(pass, base);
    await store(v);
    try {
      localStorage.removeItem(LEGACY_KEY);
      localStorage.removeItem(LEGACY_VERSION);
    } catch {
      /* nothing to clean */
    }
    legacy.current = null;
    openWith({ session, state: base });
  };

  const backup = async () => {
    await exclusive(persist);
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(vaultRef.current)], { type: "application/json" }),
    );
    const day = new Date().toISOString().slice(0, 10);
    Object.assign(document.createElement("a"), {
      href: url,
      download: `provider-tracker-backup-${day}.json`,
    }).click();
    URL.revokeObjectURL(url);
  };

  const restore = async (file) => {
    const parsed = JSON.parse(await file.text());
    if (parsed.v !== 1 || !parsed.kdf || !parsed.wrapPass || !parsed.data)
      throw new Error("That isn't a vault backup.");
    if (
      !confirm(
        "Replace the current vault with this backup? You'll need the backup's passphrase to open it.",
      )
    ) {
      throw new Error("Cancelled.");
    }
    clearTimeout(timer.current);
    await exclusive(async () => {
      sessionRef.current = null;
      const { rev } = await putVault(parsed, { force: true });
      setVault({ ...parsed, rev });
    });
    dataRef.current = null;
    savedRef.current = null;
    setData(null);
    setShowSettings(false);
    setPhase("locked");
  };

  const update = (key) => (fn) =>
    setData((d) => ({ ...d, [key]: typeof fn === "function" ? fn(d[key]) : fn }));

  if (phase === "loading")
    return (
      <div className="lockwrap">
        <p className="muted">Loading…</p>
      </div>
    );
  if (phase === "error") {
    return (
      <div className="lockwrap">
        <div className="lockcard">
          <h1>Provider Tracker</h1>
          <p className="error">{error}</p>
        </div>
      </div>
    );
  }
  if (phase === "setup")
    return <Setup legacyCount={legacy.current?.length || 0} onCreate={create} />;
  if (phase === "locked") {
    return (
      <Unlock
        hasHello={!!vault?.hello && C.helloSupported()}
        onPass={async (pass) => openWith(await C.unlockWithPassphrase(vaultRef.current, pass))}
        onHello={async () => openWith(await C.unlockWithHello(vaultRef.current))}
      />
    );
  }

  return (
    <>
      <Tracker
        rows={data.rows}
        setRows={update("rows")}
        secrets={data.secrets}
        setSecrets={update("secrets")}
        status={saveStatus}
        onSettings={() => setShowSettings(true)}
        onLock={() => {
          if (
            (saveStatus === "error" || saveStatus === "conflict") &&
            !confirm("Some changes were not saved and will be lost. Lock anyway?")
          )
            return;
          lock();
        }}
      />
      {showSettings && (
        <Settings
          vault={vault}
          onClose={() => setShowSettings(false)}
          onEnableHello={async () => {
            const withHello = await C.enableHello(vaultRef.current, sessionRef.current);
            await exclusive(() => store({ ...vaultRef.current, hello: withHello.hello }));
          }}
          onDisableHello={() => exclusive(() => store(C.disableHello(vaultRef.current)))}
          onChangePass={(pass) =>
            exclusive(async () =>
              store(await C.changePassphrase(vaultRef.current, sessionRef.current, pass)),
            )
          }
          onBackup={backup}
          onRestore={restore}
        />
      )}
    </>
  );
}
