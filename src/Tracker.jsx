import { useMemo, useState } from "react";
import { CATEGORIES, PERIODS, STATUSES } from "./constants.js";
import { daysUntil, monthly, rotationIn, todayISO } from "./logic.js";
import { PROJECTS } from "./seed/index.js";

const money = (n, cur) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: cur }).format(n);

const blank = () => ({
  id: crypto.randomUUID(),
  name: "",
  category: "Other",
  projects: [],
  purpose: "",
  plan: "",
  cost: "",
  currency: "USD",
  period: "monthly",
  renewal: "",
  url: "",
  account: "",
  keysLocation: "",
  status: "active",
  notes: "",
});

const blankSecret = () => ({
  id: crypto.randomUUID(),
  name: "",
  provider: "",
  projects: [],
  envs: "",
  value: "",
  rotated: "",
  rotateDays: "",
  notes: "",
});

export default function Tracker({
  rows,
  setRows,
  secrets,
  setSecrets,
  status: saveStatus,
  onLock,
  onSettings,
}) {
  const [tab, setTab] = useState("list");
  const [project, setProject] = useState("all");
  const [status, setStatus] = useState("live");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);
  const [editingSecret, setEditingSecret] = useState(null);
  const [revealed, setRevealed] = useState({});
  const [toast, setToast] = useState("");

  const flash = (m) => {
    setToast(m);
    setTimeout(() => setToast(""), 2500);
  };

  const projects = useMemo(
    () => [
      ...new Set([
        ...PROJECTS,
        ...rows.flatMap((r) => r.projects),
        ...secrets.flatMap((s) => s.projects),
      ]),
    ],
    [rows, secrets],
  );
  const providerName = (id) => rows.find((r) => r.id === id)?.name || "";

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter((r) => project === "all" || r.projects.includes(project))
      .filter((r) =>
        status === "all"
          ? true
          : status === "live"
            ? r.status !== "cancelled"
            : r.status === status,
      )
      .filter(
        (r) =>
          !needle ||
          [r.name, r.category, r.purpose, r.notes, r.account].some((v) =>
            (v || "").toLowerCase().includes(needle),
          ),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, project, status, q]);

  const visibleSecrets = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return secrets
      .filter((s) => project === "all" || s.projects.includes(project))
      .filter(
        (s) =>
          !needle ||
          [s.name, s.envs, s.notes, providerName(s.provider)].some((v) =>
            (v || "").toLowerCase().includes(needle),
          ),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secrets, rows, project, q]);

  const totals = useMemo(() => {
    const t = {};
    for (const r of visible) t[r.currency] = (t[r.currency] || 0) + monthly(r);
    return t;
  }, [visible]);

  const upcoming = useMemo(
    () =>
      rows
        .filter((r) => r.status !== "cancelled" && r.renewal)
        .map((r) => ({ ...r, days: daysUntil(r.renewal) }))
        .filter((r) => r.days <= 30)
        .sort((a, b) => a.days - b.days),
    [rows],
  );

  const rotationDue = useMemo(
    () =>
      secrets
        .map((s) => ({ ...s, days: rotationIn(s) }))
        .filter((s) => s.days !== null && s.days <= 14)
        .sort((a, b) => a.days - b.days),
    [secrets],
  );

  const missingCost = visible.filter(
    (r) => r.status === "active" && r.period !== "free" && r.cost === "",
  ).length;
  const storedCount = secrets.filter((s) => s.value).length;

  const save = (rec) => {
    setRows((rs) =>
      rs.some((r) => r.id === rec.id) ? rs.map((r) => (r.id === rec.id ? rec : r)) : [...rs, rec],
    );
    setEditing(null);
  };
  const remove = (id) => {
    if (confirm("Delete this provider?")) {
      setRows((rs) => rs.filter((r) => r.id !== id));
      setEditing(null);
    }
  };
  const saveSecret = (rec) => {
    setSecrets((ss) =>
      ss.some((s) => s.id === rec.id) ? ss.map((s) => (s.id === rec.id ? rec : s)) : [...ss, rec],
    );
    setEditingSecret(null);
  };
  const removeSecret = (id) => {
    if (confirm("Delete this secret? Its stored value is lost unless you have a backup.")) {
      setSecrets((ss) => ss.filter((s) => s.id !== id));
      setEditingSecret(null);
    }
  };

  const hide = (id) =>
    setRevealed((r) => {
      const n = { ...r };
      delete n[id];
      return n;
    });
  const reveal = (id) => {
    setRevealed((r) => ({ ...r, [id]: true }));
    setTimeout(() => hide(id), 15000);
  };
  const copy = async (s) => {
    try {
      await navigator.clipboard.writeText(s.value);
      flash("Copied. Clipboard clears in 20 s.");
      setTimeout(() => navigator.clipboard.writeText("").catch(() => {}), 20000);
    } catch {
      flash("Couldn't copy to the clipboard.");
    }
  };

  const saveLabel = {
    saved: "Saved",
    saving: "Saving…",
    error: "Not saved!",
    conflict: "Changed elsewhere, reload",
  }[saveStatus];

  return (
    <div className="app">
      <header>
        <h1>Provider Tracker</h1>
        <div className="actions">
          <span className={"savestate " + saveStatus}>{saveLabel}</span>
          <button
            onClick={() =>
              tab === "secrets" ? setEditingSecret(blankSecret()) : setEditing(blank())
            }
          >
            {tab === "secrets" ? "+ Add secret" : "+ Add provider"}
          </button>
          <button className="ghost" onClick={onSettings}>
            Settings
          </button>
          <button className="ghost" onClick={onLock}>
            Lock
          </button>
        </div>
      </header>

      <section className="cards">
        <div className="card">
          <span className="label">Est. monthly</span>
          <strong>
            {Object.values(totals).some((v) => v > 0)
              ? Object.entries(totals)
                  .filter(([, v]) => v > 0)
                  .map(([c, v]) => <div key={c}>{money(v, c)}</div>)
              : money(0, "USD")}
          </strong>
          {missingCost > 0 && <span className="muted">{missingCost} active without a cost</span>}
        </div>
        <div className="card">
          <span className="label">Providers</span>
          <strong>{visible.length}</strong>
          <span className="muted">
            {storedCount} of {secrets.length} secrets stored
          </span>
        </div>
        <div className={"card" + (upcoming.length || rotationDue.length ? " warn" : "")}>
          <span className="label">Due soon</span>
          {upcoming.length || rotationDue.length ? (
            <ul>
              {upcoming.map((r) => (
                <li key={"r" + r.id}>
                  {r.name} renews{" "}
                  <span className="muted">
                    {r.days < 0 ? `${-r.days}d overdue` : `in ${r.days}d`}
                  </span>
                </li>
              ))}
              {rotationDue.map((s) => (
                <li key={"s" + s.id}>
                  Rotate <code>{s.name}</code>{" "}
                  <span className="muted">
                    {s.days < 0 ? `${-s.days}d overdue` : `in ${s.days}d`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <span className="muted">Nothing due</span>
          )}
        </div>
      </section>

      <section className="filters">
        <div className="chips">
          {["all", ...projects].map((p) => (
            <button
              key={p}
              className={"chip" + (project === p ? " on" : "")}
              onClick={() => setProject(p)}
            >
              {p}
            </button>
          ))}
        </div>
        {tab !== "secrets" && (
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="live">Not cancelled</option>
            <option value="all">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
        <input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="tabs">
          {["list", "matrix", "secrets"].map((t) => (
            <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
              {t === "list" ? "List" : t === "matrix" ? "Matrix" : "Secrets"}
            </button>
          ))}
        </div>
      </section>

      {tab === "list" && (
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Provider</th>
                <th>Projects</th>
                <th>Purpose</th>
                <th>Cost</th>
                <th>Renewal</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const d = daysUntil(r.renewal);
                return (
                  <tr key={r.id} onDoubleClick={() => setEditing(r)}>
                    <td>
                      {r.url ? (
                        <a href={r.url} target="_blank" rel="noreferrer">
                          {r.name}
                        </a>
                      ) : (
                        r.name
                      )}
                      <div className="muted">
                        {r.category}
                        {r.account ? ` · ${r.account}` : ""}
                      </div>
                    </td>
                    <td>
                      {r.projects.map((p) => (
                        <span key={p} className="tag">
                          {p}
                        </span>
                      ))}
                    </td>
                    <td className="purpose">{r.purpose}</td>
                    <td className="nowrap">
                      {r.cost === "" ? (
                        <span className="muted">{r.period === "free" ? "free" : "—"}</span>
                      ) : (
                        <>
                          {money(parseFloat(r.cost), r.currency)}
                          <div className="muted">{r.period}</div>
                        </>
                      )}
                    </td>
                    <td className={"nowrap" + (d !== null && d <= 30 ? " due" : "")}>
                      {r.renewal || <span className="muted">—</span>}
                    </td>
                    <td>
                      <span className={"status " + r.status}>{r.status}</span>
                    </td>
                    <td>
                      <button className="ghost small" onClick={() => setEditing(r)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!visible.length && (
                <tr>
                  <td colSpan="7" className="muted center">
                    No providers match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "matrix" && (
        <div className="tablewrap">
          <table className="matrix">
            <thead>
              <tr>
                <th>Provider</th>
                {projects.map((p) => (
                  <th key={p}>{p}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  {projects.map((p) => (
                    <td key={p} className="center">
                      {r.projects.includes(p) ? "●" : ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "secrets" && (
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Secret</th>
                <th>Provider</th>
                <th>Projects</th>
                <th>Value</th>
                <th>Rotation</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibleSecrets.map((s) => {
                const rot = rotationIn(s);
                return (
                  <tr key={s.id} onDoubleClick={() => setEditingSecret(s)}>
                    <td>
                      <code>{s.name}</code>
                      {s.envs && <div className="muted">{s.envs}</div>}
                      {s.notes && <div className="muted">{s.notes}</div>}
                    </td>
                    <td>{providerName(s.provider) || <span className="muted">—</span>}</td>
                    <td>
                      {s.projects.map((p) => (
                        <span key={p} className="tag">
                          {p}
                        </span>
                      ))}
                    </td>
                    <td className="secretcell">
                      {!s.value ? (
                        <span className="muted">not stored</span>
                      ) : revealed[s.id] ? (
                        <code className="revealed">{s.value}</code>
                      ) : (
                        <span className="dots">••••••••••••</span>
                      )}
                      {s.value && (
                        <div className="rowbtns">
                          <button
                            className="ghost small"
                            onClick={() => (revealed[s.id] ? hide(s.id) : reveal(s.id))}
                          >
                            {revealed[s.id] ? "Hide" : "Reveal"}
                          </button>
                          <button className="ghost small" onClick={() => copy(s)}>
                            Copy
                          </button>
                        </div>
                      )}
                    </td>
                    <td className={"nowrap" + (rot !== null && rot <= 14 ? " due" : "")}>
                      {s.rotated || <span className="muted">—</span>}
                      {rot !== null && (
                        <div className="muted">
                          {rot < 0 ? `${-rot}d overdue` : `due in ${rot}d`}
                        </div>
                      )}
                    </td>
                    <td>
                      <button className="ghost small" onClick={() => setEditingSecret(s)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!visibleSecrets.length && (
                <tr>
                  <td colSpan="6" className="muted center">
                    No secrets match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <Editor
          rec={editing}
          projects={projects}
          onSave={save}
          onDelete={remove}
          onClose={() => setEditing(null)}
        />
      )}
      {editingSecret && (
        <SecretEditor
          rec={editingSecret}
          providers={rows}
          projects={projects}
          onSave={saveSecret}
          onDelete={removeSecret}
          onClose={() => setEditingSecret(null)}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function ProjectPicker({ all, selected, onToggle, onAdd }) {
  const [newProject, setNewProject] = useState("");
  const add = () => {
    const p = newProject.trim();
    if (p) onAdd(p);
    setNewProject("");
  };
  return (
    <div className="span2">
      <span className="fieldlabel">Projects</span>
      <div className="chips">
        {all.map((p) => (
          <button
            type="button"
            key={p}
            className={"chip" + (selected.includes(p) ? " on" : "")}
            onClick={() => onToggle(p)}
          >
            {p}
          </button>
        ))}
        <input
          className="inline"
          placeholder="new project"
          value={newProject}
          onChange={(e) => setNewProject(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          onBlur={add}
        />
      </div>
    </div>
  );
}

function Editor({ rec, projects, onSave, onDelete, onClose }) {
  const [f, setF] = useState(rec);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const toggle = (p) =>
    setF({
      ...f,
      projects: f.projects.includes(p) ? f.projects.filter((x) => x !== p) : [...f.projects, p],
    });
  const all = [...new Set([...projects, ...f.projects])];

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="modal"
        onSubmit={(e) => {
          e.preventDefault();
          if (f.name.trim()) onSave({ ...f, name: f.name.trim() });
        }}
      >
        <h2>{rec.name ? "Edit provider" : "Add provider"}</h2>
        <div className="grid">
          <label>
            Name
            <input required autoFocus value={f.name} onChange={set("name")} />
          </label>
          <label>
            Category
            <select value={f.category} onChange={set("category")}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="span2">
            Purpose
            <input value={f.purpose} onChange={set("purpose")} />
          </label>
          <ProjectPicker
            all={all}
            selected={f.projects}
            onToggle={toggle}
            onAdd={(p) => !f.projects.includes(p) && setF({ ...f, projects: [...f.projects, p] })}
          />
          <label>
            Plan
            <input value={f.plan} onChange={set("plan")} placeholder="e.g. Pro" />
          </label>
          <label>
            Status
            <select value={f.status} onChange={set("status")}>
              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Cost
            <input type="number" step="0.01" min="0" value={f.cost} onChange={set("cost")} />
          </label>
          <label>
            Currency
            <input
              value={f.currency}
              onChange={set("currency")}
              maxLength={3}
              style={{ textTransform: "uppercase" }}
            />
          </label>
          <label>
            Billing
            <select value={f.period} onChange={set("period")}>
              {PERIODS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Next renewal
            <input type="date" value={f.renewal} onChange={set("renewal")} />
          </label>
          <label className="span2">
            Dashboard URL
            <input type="url" value={f.url} onChange={set("url")} />
          </label>
          <label>
            Account / login email
            <input value={f.account} onChange={set("account")} />
          </label>
          <label>
            Where keys live
            <input
              value={f.keysLocation}
              onChange={set("keysLocation")}
              placeholder="e.g. Vercel env vars"
            />
          </label>
          <label className="span2">
            Notes
            <textarea rows="3" value={f.notes} onChange={set("notes")} />
          </label>
        </div>
        <p className="muted">
          Everything here is stored encrypted. Put actual keys under the Secrets tab.
        </p>
        <div className="modalactions">
          {rec.name && (
            <button type="button" className="danger" onClick={() => onDelete(rec.id)}>
              Delete
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit">Save</button>
        </div>
      </form>
    </div>
  );
}

function SecretEditor({ rec, providers, projects, onSave, onDelete, onClose }) {
  const [f, setF] = useState(rec);
  const [show, setShow] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const toggle = (p) =>
    setF({
      ...f,
      projects: f.projects.includes(p) ? f.projects.filter((x) => x !== p) : [...f.projects, p],
    });
  const all = [...new Set([...projects, ...f.projects])];

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="modal"
        autoComplete="off"
        onSubmit={(e) => {
          e.preventDefault();
          if (!f.name.trim()) return;
          const out = { ...f, name: f.name.trim() };
          // A new or changed value counts as a rotation unless you set the date yourself.
          if (out.value && out.value !== rec.value && out.rotated === rec.rotated)
            out.rotated = todayISO();
          onSave(out);
        }}
      >
        <h2>{rec.name ? "Edit secret" : "Add secret"}</h2>
        <div className="grid">
          <label className="span2">
            Name
            <input
              required
              autoFocus
              value={f.name}
              onChange={set("name")}
              placeholder="e.g. RESEND_API_KEY"
            />
          </label>
          <label>
            Provider
            <select value={f.provider} onChange={set("provider")}>
              <option value="">—</option>
              {[...providers]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Where it&apos;s set
            <input value={f.envs} onChange={set("envs")} placeholder="local, vercel prod…" />
          </label>
          <ProjectPicker
            all={all}
            selected={f.projects}
            onToggle={toggle}
            onAdd={(p) => !f.projects.includes(p) && setF({ ...f, projects: [...f.projects, p] })}
          />
          <label className="span2">
            <span className="rowbtns spread">
              Value
              <button type="button" className="ghost small" onClick={() => setShow(!show)}>
                {show ? "Hide" : "Show"}
              </button>
            </span>
            <textarea
              rows={show ? 4 : 2}
              className={show ? "mono" : "mono masked"}
              spellCheck="false"
              autoComplete="off"
              value={f.value}
              onChange={set("value")}
            />
          </label>
          <label>
            Last rotated
            <input type="date" value={f.rotated} onChange={set("rotated")} />
          </label>
          <label>
            Rotate every (days)
            <input
              type="number"
              min="1"
              value={f.rotateDays}
              onChange={set("rotateDays")}
              placeholder="e.g. 90"
            />
          </label>
          <label className="span2">
            Notes
            <textarea rows="2" value={f.notes} onChange={set("notes")} />
          </label>
        </div>
        <div className="modalactions">
          {rec.name && (
            <button type="button" className="danger" onClick={() => onDelete(rec.id)}>
              Delete
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit">Save</button>
        </div>
      </form>
    </div>
  );
}
