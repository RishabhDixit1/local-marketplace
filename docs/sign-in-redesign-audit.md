# Sign-In Redesign — Pre-Work Audit

> Read-only investigation completed 2026-07-03. Covers the OTP email login flow only.

---

## 1. Component Location

The sign-in lives inside `app/components/landing/LandingPageClient.tsx` (766 lines) — a monolithic component containing the entire landing page plus an embedded auth modal (lines 656–762).

**Supporting files:**
- `app/page.tsx` — server wrapper, passes `?signin=true` as `initialSignIn` prop
- `app/auth/callback/page.tsx` — magic-link callback handler
- `app/auth/set-password/page.tsx` — first-time password set

**Auth state (lines 148–155):** `showAuth`, `otpStep`, `emailAddress`, `verificationCode`, `loading`, `verifying`, `infoMessage`, `errorMessage`.

---

## 2. Modal, Not a Route

The auth panel is a fixed overlay (`z-50`, `backdrop-blur-sm`) with `max-w-md` (448px). It is **not a dedicated page/route**.

**Triggers that open it:**
| Trigger | Mechanism |
|---|---|
| `/?signin=true` | `initialSignIn` prop → `showAuth = initialSignIn` |
| Header "Sign In" button | `onClick={() => setShowAuth(true)}` |
| "Contact" on provider card | Sets `contactProvider` which also opens modal |
| Mobile bottom nav "Sign In" | `<Link href="/?signin=true">` |

**Constraint:** `max-w-md` (448px) is tight for split-screen / marketing content. A dedicated `/login` route would give full-page width.

---

## 3. Auth API Calls & Shapes

### `POST /api/auth/send-link`
| | |
|---|---|
| **Request** | `{ email: string }` |
| **Success** | `{ ok: true, emailSent: true }` |
| **Error** | `{ ok: false, error: string }` (400/502) |
| **Rate limit** | 60s per-email cooldown (in-memory), plus IP rate limit |

### `supabase.auth.verifyOtp({ email, token, type: "email" })` (primary)
- **Success:** `{ data: { user, session } }`
- **Error:** falls through to custom fallback
- Uses `type: "email"` (not `"magiclink"`)

### `POST /api/auth/verify-link` (fallback when GoTrue unreachable)
| | |
|---|---|
| **Request** | `{ email: string, otp: string }` |
| **Success** | `{ ok: true, user, accessToken, refreshToken, session }` |
| **Error** | `{ ok: false, error: string }` (401/403) |
| **Flow** | Verifies OTP from `otp_codes` table → builds session via GoTrue admin API or local JWT fallback |

### Other calls in component
- `supabase.auth.getSession()` — bootstrap check
- `supabase.auth.onAuthStateChange()` — listen for SIGNED_IN
- `supabase.auth.setSession()` — hydrate from fallback session

---

## 4. Animation Libraries & Primitives

**framer-motion** `^12.40.0` confirmed in `package.json`.

**Existing reusable motion components** (`app/components/motion/`):

| Component | Description |
|---|---|
| `FadeIn` | Opacity + optional `y`, configurable delay |
| `FadeInScale` | Opacity + scale 0.96→1 |
| `StaggerContainer` / `StaggerItem` | Staggered children (0.05s gap) |
| `PageTransition` | Page enter/exit with pathname key |
| `PressScale` | whileTap 0.97, whileHover 1.02 |
| `ShimmerSkeleton` / `CardSkeleton` | Animated loading skeletons |

**Components already using framer-motion:** `Modal`, `CartDrawer`, `AiPromptBar`, `AutocompleteSearch`, `ToastProvider`, `MarketAiBar`.

**Key gap:** The auth modal (line 656) uses **zero framer-motion** — no `AnimatePresence`, no `motion.div`. Compare with the reusable `Modal` component (`app/components/ui/Modal.tsx`) which wraps in `AnimatePresence` + `motion.div` with fade/scale. The auth modal could reuse `Modal` directly or at minimum add framer-motion transitions.

---

## 5. Design Tokens

Tailwind v4 (`@import "tailwindcss"`) with CSS custom properties in `app/globals.css`.

### Brand (`--brand-*`)
| Token | Light | Dark |
|---|---|---|
| `--brand-900` | `#0b1f33` | `#e0f2fe` |
| `--brand-700` | `#11466a` | `#7dd3fc` |
| `--brand-600` | `#0d9488` | — |
| `--brand-500` | `#0ea5a4` (teal) | `#22c7c5` |
| `--brand-50` | `#ecfeff` | `#042f2e` |

### Ink (`--ink-*`)
- 950: `#0f172a`, 700: `#334155`, 500: `#64748b`, 50: `#f8fafc`

### Surface (`--surface-*`)
- app: `#f3f6fb`, elevated: `#fff`, soft: `#f8fafc`, border: `#e2e8f0`

### Typography
- `--font-sans`: Aptos / Manrope
- `--font-display`: Sora
- `--font-mono`: JetBrains Mono / Fira Code

### Shadows
- `--shadow-sm` through `--shadow-elevated`, `--shadow-card`, `--shadow-popover`, `--shadow-header`

### Z-index layers
- `--layer-modal-backdrop: 80`, `--layer-modal: 90`, `--layer-toast: 100`

**The auth modal currently hard-codes Tailwind utilities (`bg-slate-*`, `border-slate-*`, `text-slate-*`) instead of using CSS variables. Should align with token system in a redesign.**

---

## 6. Mobile Responsiveness

### ✅ What's solid
- `max-w-md w-full` — fills mobile width
- `overflow-y-auto` with `pb-8` — scrollable
- `pt-[10vh]` — viewport-relative top spacing
- `p-6 sm:p-8` — responsive padding
- `w-full` form controls
- No `min-w-0` bugs in auth section

### ⚠️ Mobile issues found
| Issue | Location | Detail |
|---|---|---|
| **No open/close animation** | Lines 656–762 | Modal appears/disappears instantly vs the reusable `Modal` which has fade+scale |
| **`items-start` + `pt-[10vh]`** | Line 657 | Top-aligned, not centered. Short viewports may push content oddly |
| **Backdrop blur** | Line 657 | `backdrop-blur-sm` can jank on low-end mobile |
| **Keyboard handling** | — | No special handling for virtual keyboard — modal position doesn't adjust when keyboard opens |
| **Contact provider + auth** | Lines 669–682 | When both are shown, the scroll becomes long on mobile |
| **Close button** | Line 661 | Hard-coded `top-4` with no safe-area consideration |
| **OTP input centered** | Line 710 | Centered OTP input makes placeholder "Enter code from email" also centered — unusual UX |

### Good patterns (not present here)
- No unconstrained `flex` without `min-w-0`
- No `items-center` misuse (intentional `items-start`)
- `pb-24 lg:pb-0` correctly accounts for mobile bottom nav

---

## 7. Key Considerations for Redesign

1. **Modal vs dedicated route:** `max-w-md` is very tight for a premium split-screen layout with marketing content. Consider converting to a dedicated `/login` route, or keep the modal and use the translucent background as a canvas for animations.

2. **Animation gap:** The auth modal has zero framer-motion. The existing `Modal`, `FadeIn`, `FadeInScale`, `StaggerContainer` components can all be reused.

3. **Reusable `Modal` component exists** at `app/components/ui/Modal.tsx` — the auth modal should be refactored to use it rather than hand-rolling the fixed overlay pattern.

4. **Design tokens not used** in the auth modal — hard-coded `slate-*` classes throughout.

5. **API contract is stable** — `send-link` and `verify-link` endpoints are the two integration points. OTP verification uses `type: "email"` (not `"magiclink"` as docs suggest — likely the fix from earlier today).

6. **Mobile nav entry point** is `MobileBottomNav.tsx:34` — `<Link href="/?signin=true">`. This stays the same regardless of modal vs route approach.
