"use client";

import { useCallback, useEffect, useState } from "react";
import { Crown, Loader2, Zap, CheckCircle, Clock, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fetchAuthedJson } from "@/lib/clientApi";

type Placement = {
  id: string;
  listing_id: string | null;
  starts_at: string;
  ends_at: string;
  active: boolean;
  price_paise: number;
  placement_type: string;
};

type BoostData = {
  ok: boolean;
  active: Placement[];
  upcoming: Placement[];
  expired: Placement[];
  remainingBoosts: number;
  plans: Record<string, { label: string; days: number; pricePaise: number }>;
};

export default function BoostsPage() {
  const [data, setData] = useState<BoostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [error, setError] = useState("");

  const fetchBoosts = useCallback(async () => {
    setLoading(true);
    try {
      const json = await fetchAuthedJson<BoostData>(supabase, "/api/provider/boosts");
      setData(json);
    } catch {
      setError("Failed to load boost data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBoosts();
  }, [fetchBoosts]);

  const handlePurchase = async (duration: string) => {
    setPurchasing(duration);
    setError("");
    try {
      interface BoostOrderResponse {
        ok: boolean; orderId: string; amount: number; currency: string; keyId: string; days: number;
      }

      const json = await fetchAuthedJson<BoostOrderResponse>(
        supabase,
        "/api/provider/boosts",
        {
          method: "POST",
          body: JSON.stringify({ duration }),
        }
      );

      if (typeof window.Razorpay === "undefined") {
        setError("Payment gateway not loaded. Refresh and try again.");
        setPurchasing(null);
        return;
      }

      const options = {
        key: json.keyId,
        amount: json.amount,
        currency: json.currency,
        name: "ServiQ Boost",
        description: `${json.days}-day featured placement`,
        order_id: json.orderId,
        handler: async function (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) {
          try {
            await fetchAuthedJson(
              supabase,
              "/api/provider/boosts/verify",
              {
                method: "POST",
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  duration,
                }),
              }
            );
            fetchBoosts();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Verification failed");
          }
          setPurchasing(null);
        },
        modal: {
          ondismiss: () => setPurchasing(null),
        },
      };

      const rzp = new window.Razorpay!(options);
      rzp.open();
    } catch {
      setError("Payment failed");
      setPurchasing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Zap className="w-6 h-6 text-amber-500" />
          Boost Promotions
        </h1>
        <p className="text-gray-600 mt-1">
          Get featured in search results. Premium plan includes up to 10 active boosts.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(data.plans).map(([duration, plan]) => (
              <div key={duration} className="border rounded-xl p-6 flex flex-col">
                <h3 className="text-lg font-semibold">{plan.label}</h3>
                <p className="text-3xl font-bold mt-2">
                  ₹{plan.pricePaise / 100}
                </p>
                <p className="text-sm text-gray-500 mt-1">one-time payment</p>
                <button
                  onClick={() => handlePurchase(duration)}
                  disabled={purchasing === duration}
                  className="mt-4 w-full bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  {purchasing === duration ? "Processing..." : "Boost Now"}
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-4 py-3 rounded-lg">
            <Crown className="w-4 h-4 text-amber-500" />
            <span>
              Remaining boost slots: <strong>{data.remainingBoosts}</strong> / 10
              {data.active.length > 0 && " (active count)"}
            </span>
          </div>

          {data.active.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
                <CheckCircle className="w-5 h-5 text-green-500" /> Active Boosts
              </h2>
              <div className="space-y-2">
                {data.active.map((p) => (
                  <div key={p.id} className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{p.placement_type}</p>
                      <p className="text-xs text-gray-500">
                        Until {new Date(p.ends_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded">Active</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {data.upcoming.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
                <Clock className="w-5 h-5 text-blue-500" /> Upcoming
              </h2>
              <div className="space-y-2">
                {data.upcoming.map((p) => (
                  <div key={p.id} className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Starts {new Date(p.starts_at).toLocaleDateString()}</p>
                      <p className="text-xs text-gray-500">Until {new Date(p.ends_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {data.expired.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
                <XCircle className="w-5 h-5 text-gray-400" /> Past Boosts
              </h2>
              <div className="space-y-1">
                {data.expired.slice(0, 5).map((p) => (
                  <div key={p.id} className="text-sm text-gray-500 px-4 py-2">
                    {new Date(p.starts_at).toLocaleDateString()} – {new Date(p.ends_at).toLocaleDateString()} · ₹{p.price_paise / 100}
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
