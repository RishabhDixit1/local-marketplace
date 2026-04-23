"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle, Briefcase, Package } from "lucide-react";
import { useRouter } from "next/navigation";

export type OnboardingStep = "welcome" | "service_or_product" | "form_redirect" | "complete";

interface OnboardingServiceWizardProps {
  open: boolean;
  onClose: () => void;
}

export function OnboardingServiceWizard({ open, onClose }: OnboardingServiceWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>("welcome");

  if (!open) return null;

  const handleStartService = () => {
    setStep("form_redirect");
    setTimeout(() => {
      onClose();
      router.push("/dashboard/provider/add-service");
    }, 800);
  };

  const handleStartProduct = () => {
    setStep("form_redirect");
    setTimeout(() => {
      onClose();
      router.push("/dashboard/provider/add-product");
    }, 800);
  };

  const handleSkip = () => {
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleSkip}
        aria-hidden
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
          {/* Welcome Step */}
          {step === "welcome" && (
            <div className="space-y-6 bg-gradient-to-br from-indigo-50 to-blue-50 p-6 sm:p-8">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSkip}
                  className="text-sm font-semibold text-slate-500 transition hover:text-slate-700"
                >
                  Skip
                </button>
              </div>

              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100">
                  <Package className="h-8 w-8 text-indigo-600" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900">Welcome to your store!</h1>
                <p className="mt-2 text-sm text-slate-600">
                  Let&apos;s add your first service or product to start reaching customers.
                </p>
              </div>

              <div className="space-y-3 pt-4">
                <button
                  type="button"
                  onClick={() => setStep("service_or_product")}
                  className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 flex items-center justify-center gap-2"
                >
                  Get Started
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-3 pt-2 text-xs text-slate-600">
                <div className="flex gap-2">
                  <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
                  <span>Reach local customers looking for your service</span>
                </div>
                <div className="flex gap-2">
                  <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
                  <span>Manage availability and respond quickly</span>
                </div>
                <div className="flex gap-2">
                  <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
                  <span>Build your reputation with reviews</span>
                </div>
              </div>
            </div>
          )}

          {/* Service or Product Step */}
          {step === "service_or_product" && (
            <div className="space-y-4 p-6 sm:p-8">
              <div>
                <h2 className="text-lg font-bold text-slate-900">What do you offer?</h2>
                <p className="mt-1 text-sm text-slate-600">Choose what you&apos;d like to add first.</p>
              </div>

              <div className="grid gap-3">
                <button
                  type="button"
                  onClick={handleStartService}
                  className="group flex items-start gap-3 rounded-lg border-2 border-slate-200 p-4 text-left transition hover:border-indigo-500 hover:bg-indigo-50"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 group-hover:bg-indigo-100 group-hover:text-indigo-600">
                    <Briefcase className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Service</p>
                    <p className="text-xs text-slate-600">Hourly work, consulting, repairs</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleStartProduct}
                  className="group flex items-start gap-3 rounded-lg border-2 border-slate-200 p-4 text-left transition hover:border-indigo-500 hover:bg-indigo-50"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600 group-hover:bg-indigo-100 group-hover:text-indigo-600">
                    <Package className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Product</p>
                    <p className="text-xs text-slate-600">Items, goods, physical products</p>
                  </div>
                </button>
              </div>

              <button
                type="button"
                onClick={handleSkip}
                className="w-full text-sm font-semibold text-slate-600 transition hover:text-slate-900 py-2"
              >
                I&apos;ll do this later
              </button>
            </div>
          )}

          {/* Form Redirect Step */}
          {step === "form_redirect" && (
            <div className="space-y-4 p-6 sm:p-8">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle className="h-8 w-8 text-emerald-600" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">Ready to add!</h2>
                <p className="mt-2 text-sm text-slate-600">We&apos;re opening the form for you now.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
