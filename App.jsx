import { useEffect, useMemo, useState } from "react";

const API = "/api/records";

async function api(url, options) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.status === 204 ? null : res.json();
}

const today = () => new Date().toISOString().slice(0, 10);
const monthKey = (date) => date.slice(0, 7); // "YYYY-MM"
const monthLabel = (key) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
};
const money = (n) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

function summarize(records) {
  const sales = records.filter((r) => r.type === "sale").reduce((s, r) => s + r.amount, 0);
  const expenses = records.filter((r) => r.type === "expense").reduce((s, r) => s + r.amount, 0);
  return { sales, expenses, net: sales - expenses };
}

/* ------------------------------------------------------------------ */
/* Entry form (used for both sales and expenses)                       */
/* ------------------------------------------------------------------ */
function EntryForm({ type, onSaved, onCancel }) {
  const isSale = type === "sale";
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    const value = parseFloat(amount);
    if (!name.trim()) return setError("Enter a name.");
    if (!Number.isFinite(value) || value <= 0) return setError("Enter an amount greater than 0.");
    if (!date) return setError("Pick a date.");
    setError("");
    setSaving(true);
    try {
      const saved = await api(API, {
        method: "POST",
        body: JSON.stringify({ type, name: name.trim(), amount: Math.round(value * 100) / 100, date }),
      });
      onSaved(saved, `${isSale ? "Sale" : "Expense"} saved.`);
    } catch (e) {
      setError(e.message || "Could not save the record. Check that the API server is running.");
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  const accent = isSale
    ? "border-emerald-600 focus:ring-emerald-600 bg-emerald-700 hover:bg-emerald-800"
    : "border-rose-600 focus:ring-rose-600 bg-rose-700 hover:bg-rose-800";
  const field =
    "w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:border-transparent " +
    (isSale ? "focus:ring-emerald-600" : "focus:ring-rose-600");

  return (
    <section
      aria-label={isSale ? "Log sales revenue" : "Log expense"}
      className={`rounded-xl border-l-4 bg-white p-6 shadow-sm ring-1 ring-slate-200 ${
        isSale ? "border-l-emerald-600" : "border-l-rose-600"
      }`}
    >
      <h2 className="text-lg font-semibold text-slate-900">
        {isSale ? "Log sales revenue" : "Log expense"}
      </h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-6">
        <label className="sm:col-span-3">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            {isSale ? "Product / service name" : "Expense item name"}
          </span>
          <input
            className={field}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={isSale ? "e.g. Logo design package" : "e.g. Office rent"}
          />
        </label>
        <label className="sm:col-span-2">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Price / amount</span>
          <input
            className={`${field} tabular-nums`}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </label>
        <label className="sm:col-span-1">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Date</span>
          <input className={field} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>
      {error && (
        <p role="alert" className="mt-4 text-sm font-medium text-rose-700">
          {error}
        </p>
      )}
      <div className="mt-6 flex gap-3">
        <button
          onClick={handleSubmit}
          disabled={saving}
          className={`rounded-md px-5 py-2.5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 ${accent}`}
        >
          {saving ? "Saving…" : isSale ? "Save sale" : "Save expense"}
        </button>
        <button
          onClick={onCancel}
          className="rounded-md px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400"
        >
          Cancel
        </button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Monthly summary widget                                              */
/* ------------------------------------------------------------------ */
function MonthSelect({ months, value, onChange, id }) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-800"
    >
      <option value="all">All months</option>
      {months.map((m) => (
        <option key={m} value={m}>
          {monthLabel(m)}
        </option>
      ))}
    </select>
  );
}

function MonthlySummary({ records, months, month, setMonth }) {
  const scoped = month === "all" ? records : records.filter((r) => monthKey(r.date) === month);
  const { sales, expenses, net } = summarize(scoped);
  const byMonth = months.map((m) => ({ key: m, ...summarize(records.filter((r) => monthKey(r.date) === m)) }));

  return (
    <section aria-label="Monthly summary" className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Monthly summary</h2>
        <div className="flex items-center gap-2">
          <label htmlFor="summary-month" className="text-sm text-slate-600">
            Showing
          </label>
          <MonthSelect id="summary-month" months={months} value={month} onChange={setMonth} />
        </div>
      </div>

      <dl className="mt-5 grid gap-px overflow-hidden rounded-lg bg-slate-200 sm:grid-cols-3">
        <div className="bg-white p-4">
          <dt className="text-sm text-slate-600">Sales revenue</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums text-emerald-700">{money(sales)}</dd>
        </div>
        <div className="bg-white p-4">
          <dt className="text-sm text-slate-600">Expenses</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums text-rose-700">{money(expenses)}</dd>
        </div>
        <div className={`p-4 ${net >= 0 ? "bg-emerald-50" : "bg-rose-50"}`}>
          <dt className="text-sm text-slate-700">{net >= 0 ? "Net profit" : "Net loss"}</dt>
          <dd className={`mt-1 text-2xl font-semibold tabular-nums ${net >= 0 ? "text-emerald-800" : "text-rose-800"}`}>
            {net < 0 ? "−" : ""}
            {money(Math.abs(net))}
          </dd>
        </div>
      </dl>

      {byMonth.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <caption className="pb-2 text-left text-sm font-medium text-slate-700">Month by month</caption>
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-600">
                <th className="py-2 font-medium">Month</th>
                <th className="py-2 text-right font-medium">Sales</th>
                <th className="py-2 text-right font-medium">Expenses</th>
                <th className="py-2 text-right font-medium">Net</th>
              </tr>
            </thead>
            <tbody>
              {byMonth.map((m) => (
                <tr
                  key={m.key}
                  onClick={() => setMonth(m.key)}
                  className={`cursor-pointer border-b border-slate-100 hover:bg-slate-50 ${
                    month === m.key ? "bg-slate-100" : ""
                  }`}
                >
                  <td className="py-2.5 font-medium text-slate-800">{monthLabel(m.key)}</td>
                  <td className="py-2.5 text-right tabular-nums text-emerald-700">{money(m.sales)}</td>
                  <td className="py-2.5 text-right tabular-nums text-rose-700">{money(m.expenses)}</td>
                  <td
                    className={`py-2.5 text-right font-semibold tabular-nums ${
                      m.net >= 0 ? "text-emerald-800" : "text-rose-800"
                    }`}
                  >
                    {m.net < 0 ? "−" : ""}
                    {money(Math.abs(m.net))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Records table                                                       */
/* ------------------------------------------------------------------ */
function RecordsTable({ records, onDelete, limit }) {
  const rows = limit ? records.slice(0, limit) : records;

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-600">
        No records yet. Log a sale or an expense to see it here.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg ring-1 ring-slate-200">
      <table className="w-full min-w-[560px] bg-white text-sm">
        <thead className="bg-slate-50 text-left text-slate-600">
          <tr>
            <th className="px-4 py-3 font-medium">Date</th>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium">Item name</th>
            <th className="px-4 py-3 text-right font-medium">Amount</th>
            {onDelete && <th className="w-16 px-4 py-3"><span className="sr-only">Actions</span></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const sale = r.type === "sale";
            return (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-700">{r.date}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      sale ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {sale ? "Sale" : "Expense"}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-900">{r.name}</td>
                <td
                  className={`whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums ${
                    sale ? "text-emerald-700" : "text-rose-700"
                  }`}
                >
                  {sale ? "+" : "−"}
                  {money(r.amount)}
                </td>
                {onDelete && (
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => onDelete(r)}
                      className="text-xs font-medium text-slate-500 hover:text-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-600"
                      aria-label={`Delete ${r.name}`}
                    >
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* App                                                                 */
/* ------------------------------------------------------------------ */
export default function App() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState("home"); // "home" | "records"
  const [form, setForm] = useState(null); // null | "sale" | "expense"
  const [month, setMonth] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [toast, setToast] = useState("");

  // Load all records from the Neon-backed API when the app starts.
  useEffect(() => {
    api(API)
      .then(setRecords)
      .catch((e) => {
        console.error(e);
        setLoadError("Could not load records. Check that the API server is running and DATABASE_URL is correct.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const sorted = useMemo(
    () => [...records].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [records]
  );
  const months = useMemo(
    () => [...new Set(records.map((r) => monthKey(r.date)))].sort().reverse(),
    [records]
  );
  const filtered = useMemo(
    () =>
      sorted.filter(
        (r) =>
          (month === "all" || monthKey(r.date) === month) &&
          (typeFilter === "all" || r.type === typeFilter)
      ),
    [sorted, month, typeFilter]
  );

  async function handleDelete(r) {
    if (!window.confirm(`Delete "${r.name}" (${money(r.amount)})?`)) return;
    try {
      await api(`${API}/${r.id}`, { method: "DELETE" });
      setRecords((prev) => prev.filter((x) => x.id !== r.id));
      setToast("Record deleted.");
    } catch (e) {
      console.error(e);
      setToast("Could not delete the record.");
    }
  }

  const tabBtn = (id, label) => (
    <button
      onClick={() => setTab(id)}
      aria-current={tab === id ? "page" : undefined}
      className={`rounded-md px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-800 ${
        tab === id ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-200"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900" style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <h1 className="text-xl font-semibold tracking-tight">Ledger</h1>
          <nav className="flex gap-1" aria-label="Main">
            {tabBtn("home", "Dashboard")}
            {tabBtn("records", `Records (${records.length})`)}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        {loadError && (
          <p role="alert" className="rounded-lg bg-rose-50 p-4 text-sm font-medium text-rose-800 ring-1 ring-rose-200">
            {loadError}
          </p>
        )}

        {tab === "home" && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <button
                onClick={() => setForm(form === "sale" ? null : "sale")}
                aria-pressed={form === "sale"}
                className={`rounded-xl px-6 py-8 text-left text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:ring-offset-2 ${
                  form === "sale" ? "bg-emerald-800" : "bg-emerald-700 hover:bg-emerald-800"
                }`}
              >
                <span className="block text-2xl font-semibold">Log Sales Revenue</span>
                <span className="mt-1 block text-emerald-100">Record money coming in</span>
              </button>
              <button
                onClick={() => setForm(form === "expense" ? null : "expense")}
                aria-pressed={form === "expense"}
                className={`rounded-xl px-6 py-8 text-left text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-700 focus:ring-offset-2 ${
                  form === "expense" ? "bg-rose-800" : "bg-rose-700 hover:bg-rose-800"
                }`}
              >
                <span className="block text-2xl font-semibold">Log Expense</span>
                <span className="mt-1 block text-rose-100">Record money going out</span>
              </button>
            </div>

            {form && (
              <EntryForm
                key={form}
                type={form}
                onSaved={(saved, msg) => {
                  setRecords((prev) => [saved, ...prev]);
                  setToast(msg);
                  setForm(null);
                }}
                onCancel={() => setForm(null)}
              />
            )}

            <MonthlySummary records={records} months={months} month={month} setMonth={setMonth} />

            <section aria-label="Recent records" className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Recent records</h2>
                {records.length > 8 && (
                  <button onClick={() => setTab("records")} className="text-sm font-medium text-slate-700 underline">
                    View all
                  </button>
                )}
              </div>
              {loading ? <p className="text-slate-600">Loading records…</p> : <RecordsTable records={sorted} limit={8} />}
            </section>
          </>
        )}

        {tab === "records" && (
          <section aria-label="All records" className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-lg font-semibold">All records</h2>
              <div className="flex flex-wrap items-center gap-3">
                <MonthSelect id="records-month" months={months} value={month} onChange={setMonth} />
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  aria-label="Filter by type"
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-800"
                >
                  <option value="all">Sales and expenses</option>
                  <option value="sale">Sales only</option>
                  <option value="expense">Expenses only</option>
                </select>
              </div>
            </div>
            {loading ? (
              <p className="text-slate-600">Loading records…</p>
            ) : (
              <RecordsTable records={filtered} onDelete={handleDelete} />
            )}
            {filtered.length > 0 && (
              <p className="text-right text-sm text-slate-600">
                {filtered.length} record{filtered.length === 1 ? "" : "s"} · net{" "}
                <span className="font-semibold tabular-nums">{money(summarize(filtered).net)}</span>
              </p>
            )}
          </section>
        )}
      </main>

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
