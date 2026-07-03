export default function ChatLoading() {
  return (
    <div className="mx-auto flex h-[calc(100vh-6rem)] max-w-5xl gap-4 p-4 sm:p-6">
      {/* Conversation list skeleton */}
      <div className="hidden w-72 shrink-0 flex-col gap-3 sm:flex">
        <div className="h-8 w-24 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-8 w-full animate-pulse rounded-xl bg-slate-100" />
        <div className="flex-1 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl p-3">
              <div className="h-11 w-11 animate-pulse rounded-full bg-slate-200" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-3/5 animate-pulse rounded bg-slate-200" />
                <div className="h-2.5 w-4/5 animate-pulse rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Message area skeleton */}
      <div className="flex flex-1 flex-col rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <div className="h-11 w-11 animate-pulse rounded-full bg-slate-200" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-1/3 animate-pulse rounded bg-slate-200" />
            <div className="h-2.5 w-1/5 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
        <div className="flex-1 space-y-4 p-5">
          {[75, 50, 60, 35].map((w, i) => (
            <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
              <div className={`h-10 animate-pulse rounded-2xl bg-slate-100`} style={{ width: `${w}%` }} />
            </div>
          ))}
        </div>
        <div className="border-t border-slate-100 px-5 py-4">
          <div className="h-12 w-full animate-pulse rounded-2xl bg-slate-100" />
        </div>
      </div>
    </div>
  );
}
