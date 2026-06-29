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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    <main className="flex min-h-screen items-center justify-center p-8">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in to bar-metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={sendMagicLink} className="space-y-4">
            <input
              type="hidden"
              name="callbackUrl"
              value={callbackUrl ?? ""}
            />
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full">
              Send magic link
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
