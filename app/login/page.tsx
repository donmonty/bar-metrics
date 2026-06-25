/**
 * Magic-link sign-in (issue #11; extended for `callbackUrl` round-tripping
 * in issue #16). Wraps `signIn("resend")` via a Server Action — Resend is
 * the sole provider this slice wires up (ADR 0002). Reachable
 * unauthenticated; `middleware.ts` never redirects this route.
 *
 * `callbackUrl` lets a deep `/dashboard/...?sucursal=...` link survive the
 * login round trip (`middleware.ts` sets it before redirecting here).
 * Restricted to a same-origin relative path to avoid an open-redirect via an
 * attacker-supplied `callbackUrl`.
 */
import { signIn } from "@/lib/auth";

function safeCallbackUrl(value: string | undefined): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return "/me";
}

async function sendMagicLink(formData: FormData) {
  "use server";
  const email = formData.get("email");
  const callbackUrl = formData.get("callbackUrl");
  await signIn("resend", {
    email,
    redirectTo: safeCallbackUrl(
      typeof callbackUrl === "string" ? callbackUrl : undefined,
    ),
  });
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
      <h1>Sign in to bar-metrics</h1>
      <form action={sendMagicLink}>
        <input type="hidden" name="callbackUrl" value={callbackUrl ?? ""} />
        <label htmlFor="email">Email</label>
        <br />
        <input id="email" name="email" type="email" required autoFocus />
        <br />
        <button type="submit">Send magic link</button>
      </form>
    </main>
  );
}
