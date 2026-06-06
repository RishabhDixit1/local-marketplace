import Link from "next/link";

export function AppFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-xs text-slate-500">
            &copy; {new Date().getFullYear()} ServiQ. All rights reserved.
          </p>
          <nav className="flex items-center gap-6">
            <Link href="/privacy" className="text-xs text-slate-500 hover:text-slate-700 transition">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-xs text-slate-500 hover:text-slate-700 transition">
              Terms of Service
            </Link>
            <Link href="/support" className="text-xs text-slate-500 hover:text-slate-700 transition">
              Help Centre
            </Link>
            <Link href="/contact" className="text-xs text-slate-500 hover:text-slate-700 transition">
              Contact Us
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
