import SavedFeedView from "@/app/dashboard/components/SavedFeedView";

export default function SavedPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Saved</h1>
        <p className="mt-1 text-sm text-slate-600">Bookmarked posts and listings.</p>
      </div>
      <SavedFeedView />
    </div>
  );
}
