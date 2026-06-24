/**
 * Magic-link sign-in (issue #11). Wraps `signIn("resend")` via a Server
 * Action — Resend is the sole provider this slice wires up (ADR 0002).
 * Reachable unauthenticated; `middleware.ts` never redirects this route.
 */
import { signIn } from "@/lib/auth";

async function sendMagicLink(formData: FormData) {
  "use server";
  const email = formData.get("email");
  await signIn("resend", { email, redirectTo: "/me" });
}

export default function LoginPage() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
      <h1>Sign in to bar-metrics</h1>
      <form action={sendMagicLink}>
        <label htmlFor="email">Email</label>
        <br />
        <input id="email" name="email" type="email" required autoFocus />
        <br />
        <button type="submit">Send magic link</button>
      </form>
    </main>
  );
}
