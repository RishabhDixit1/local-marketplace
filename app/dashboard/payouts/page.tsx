"use client";

import { useCallback, useEffect, useState } from "react";
import { Banknote, Landmark, Loader2, Plus, Trash2, Wallet } from "lucide-react";

type BankAccount = {
  id: string;
  account_type: "bank" | "upi";
  account_holder_name: string | null;
  bank_name: string | null;
  account_number: string | null;
  ifsc_code: string | null;
  upi_handle: string | null;
  is_default: boolean;
  is_verified: boolean;
};

type Payout = {
  id: string;
  amount_paise: number;
  fee_paise: number;
  net_amount_paise: number;
  status: string;
  payout_method: string;
  payout_detail: string | null;
  notes: string | null;
  processed_at: string | null;
  created_at: string;
};

type PayoutSummary = {
  totalEarnedPaise: number;
  totalPaidOutPaise: number;
  totalPendingPaise: number;
  availablePaise: number;
};

const INR = (paise: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-blue-50 text-blue-700 border-blue-200",
  processing: "bg-indigo-50 text-indigo-700 border-indigo-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  failed: "bg-rose-50 text-rose-700 border-rose-200",
  cancelled: "bg-slate-50 text-slate-500 border-slate-200",
};

export default function PayoutsPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [summary, setSummary] = useState<PayoutSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutMethod, setPayoutMethod] = useState<"bank" | "upi">("bank");
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Bank account form
  const [showAddForm, setShowAddForm] = useState(false);
  const [acctType, setAcctType] = useState<"bank" | "upi">("bank");
  const [holderName, setHolderName] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [upiHandle, setUpiHandle] = useState("");
  const [savingAccount, setSavingAccount] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [payoutsRes, accountsRes] = await Promise.all([
        fetch("/api/provider/payouts"),
        fetch("/api/provider/bank-accounts"),
      ]);
      const payoutsJson = await payoutsRes.json();
      const accountsJson = await accountsRes.json();
      if (payoutsJson.ok) {
        setPayouts(payoutsJson.payouts);
        setSummary(payoutsJson.summary);
      }
      if (accountsJson.ok) setAccounts(accountsJson.accounts);
    } catch {
      setError("Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const requestPayout = async () => {
    const amount = parseInt(payoutAmount);
    if (!amount || amount < 100) { setError("Minimum withdrawal is ₹1"); return; }
    if (summary && amount > summary.availablePaise) { setError("Insufficient balance"); return; }

    setRequesting(true);
    setError(""); setSuccess("");
    try {
      const res = await fetch("/api/provider/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount_paise: amount, payout_method: payoutMethod }),
      });
      const json = await res.json();
      if (json.ok) {
        setSuccess(`Withdrawal of ${INR(amount)} requested.`);
        setPayoutAmount("");
        void fetchData();
      } else {
        setError(json.message || "Failed to request payout.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setRequesting(false);
    }
  };

  const addAccount = async () => {
    if (acctType === "bank" && (!accountNumber || !ifscCode)) { setError("Account number and IFSC required"); return; }
    if (acctType === "upi" && !upiHandle) { setError("UPI handle required"); return; }

    setSavingAccount(true);
    setError(""); setSuccess("");
    try {
      const res = await fetch("/api/provider/bank-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_type: acctType,
          account_holder_name: holderName || undefined,
          bank_name: bankName || undefined,
          account_number: accountNumber || undefined,
          ifsc_code: ifscCode || undefined,
          upi_handle: upiHandle || undefined,
          is_default: accounts.length === 0,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setShowAddForm(false);
        setHolderName(""); setBankName(""); setAccountNumber(""); setIfscCode(""); setUpiHandle("");
        void fetchData();
        setSuccess("Account added.");
      } else {
        setError(json.message || "Failed to add account.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setSavingAccount(false);
    }
  };

  const deleteAccount = async (id: string) => {
    try {
      await fetch(`/api/provider/bank-accounts/${id}`, { method: "DELETE" });
      void fetchData();
    } catch {
      setError("Failed to delete account.");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Payouts</h1>
        <p className="mt-1 text-sm text-slate-600">Manage your earnings and withdrawals.</p>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Total earned</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{INR(summary.totalEarnedPaise)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Paid out</p>
            <p className="mt-1 text-lg font-bold text-emerald-700">{INR(summary.totalPaidOutPaise)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Pending</p>
            <p className="mt-1 text-lg font-bold text-amber-700">{INR(summary.totalPendingPaise)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Available</p>
            <p className="mt-1 text-lg font-bold text-blue-700">{INR(summary.availablePaise)}</p>
          </div>
        </div>
      )}

      {/* Request Withdrawal */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="text-base font-semibold text-slate-900">Request withdrawal</h2>
        <p className="mt-1 text-xs text-slate-500">Minimum ₹1. Available: {summary ? INR(summary.availablePaise) : "—"}</p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="text-xs font-medium text-slate-700">Amount (paise)</label>
            <input
              type="number"
              value={payoutAmount}
              onChange={(e) => setPayoutAmount(e.target.value)}
              placeholder="e.g. 50000 (₹500)"
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            />
          </div>
          <div className="w-full sm:w-40">
            <label className="text-xs font-medium text-slate-700">Method</label>
            <select
              value={payoutMethod}
              onChange={(e) => setPayoutMethod(e.target.value as "bank" | "upi")}
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none"
            >
              <option value="bank">Bank transfer</option>
              <option value="upi">UPI</option>
              <option value="wallet">Wallet</option>
            </select>
          </div>
          <button
            type="button"
            disabled={requesting || !payoutAmount}
            onClick={() => void requestPayout()}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {requesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
            {requesting ? "Requesting..." : "Withdraw"}
          </button>
        </div>
      </section>

      {/* Bank Accounts */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Payout accounts</h2>
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            <Plus className="h-3 w-3" />
            {showAddForm ? "Cancel" : "Add account"}
          </button>
        </div>

        {showAddForm && (
          <div className="mt-4 space-y-3 rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <div className="flex gap-2">
              <button type="button" onClick={() => setAcctType("bank")}
                className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition ${acctType === "bank" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}>
                <Landmark className="mx-auto h-4 w-4" /> Bank
              </button>
              <button type="button" onClick={() => setAcctType("upi")}
                className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition ${acctType === "upi" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}>
                <Wallet className="mx-auto h-4 w-4" /> UPI
              </button>
            </div>
            <input value={holderName} onChange={(e) => setHolderName(e.target.value)} placeholder="Account holder name" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none" />
            {acctType === "bank" && (
              <>
                <input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Bank name" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none" />
                <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="Account number" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none" />
                <input value={ifscCode} onChange={(e) => setIfscCode(e.target.value)} placeholder="IFSC code" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none" />
              </>
            )}
            {acctType === "upi" && (
              <input value={upiHandle} onChange={(e) => setUpiHandle(e.target.value)} placeholder="UPI handle (e.g. name@upi)" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none" />
            )}
            <button type="button" disabled={savingAccount} onClick={() => void addAccount()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50">
              {savingAccount ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {savingAccount ? "Saving..." : "Save account"}
            </button>
          </div>
        )}

        {accounts.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No payout accounts added yet.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {accounts.map((acc) => (
              <div key={acc.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    {acc.account_type === "bank" ? acc.bank_name || "Bank" : "UPI"}
                    {acc.is_default && <span className="ml-2 text-xs text-blue-600">Default</span>}
                  </p>
                  <p className="text-xs text-slate-500">
                    {acc.account_type === "bank"
                      ? `••••${acc.account_number?.slice(-4) ?? ""} / ${acc.ifsc_code ?? ""}`
                      : acc.upi_handle ?? ""}
                  </p>
                </div>
                <button type="button" onClick={() => void deleteAccount(acc.id)}
                  className="rounded-full p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Payout History */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="text-base font-semibold text-slate-900">Withdrawal history</h2>
        {payouts.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No withdrawals yet.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {payouts.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{INR(p.net_amount_paise)}</p>
                  <p className="text-xs text-slate-500">{p.payout_method} • {new Date(p.created_at).toLocaleDateString("en-IN")}</p>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLES[p.status] ?? ""}`}>
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {error && <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {success && <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}
    </div>
  );
}
