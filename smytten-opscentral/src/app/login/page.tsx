"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Boxes, BarChart3, ShieldCheck, Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DEMO_ACCOUNTS = [
  { label: "Ops Exec", email: "exec@smytten.com" },
  { label: "Ops Lead", email: "lead@smytten.com" },
  { label: "Finance", email: "finance@smytten.com" },
  { label: "Vendor", email: "vendor@smytten.com" },
];
const DEMO_PASSWORD = "Smytten@123";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password.");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  function quickFill(addr: string) {
    setEmail(addr);
    setPassword(DEMO_PASSWORD);
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Brand panel */}
      <div className="relative hidden w-full flex-col justify-between bg-sidebar p-10 text-sidebar-foreground md:flex md:w-[44%] lg:w-[40%]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Boxes className="h-5 w-5" />
          </div>
          <span className="text-[15px] font-semibold tracking-tight">
            Smytten OpsCentral
          </span>
        </div>

        <div className="space-y-6">
          <h1 className="text-3xl font-semibold leading-tight">
            Last-mile intelligence,
            <br />
            in one place.
          </h1>
          <ul className="space-y-3 text-sm text-sidebar-muted">
            <li className="flex items-center gap-3">
              <BarChart3 className="h-4 w-4 text-[hsl(var(--sidebar-accent))]" />
              Delhivery courier performance — P-to-D, RTO, NDR, TAT
            </li>
            <li className="flex items-center gap-3">
              <ShieldCheck className="h-4 w-4 text-[hsl(var(--sidebar-accent))]" />
              Role-based views for ops, leadership, finance & vendors
            </li>
            <li className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-[hsl(var(--sidebar-accent))]" />
              Email intelligence for chargebacks & escalations
            </li>
          </ul>
        </div>

        <p className="text-xs text-sidebar-muted">
          Internal tool · Smytten Ops
        </p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 md:hidden">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Boxes className="h-5 w-5" />
              </div>
              <span className="text-[15px] font-semibold">
                Smytten OpsCentral
              </span>
            </div>
          </div>

          <h2 className="text-xl font-semibold">Sign in</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Use your Smytten ops account to continue.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@smytten.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Sign in
            </Button>
          </form>

          <div className="mt-6 rounded-lg border bg-muted/40 p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Demo accounts · password{" "}
              <code className="rounded bg-background px-1 py-0.5">
                {DEMO_PASSWORD}
              </code>
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((a) => (
                <button
                  key={a.email}
                  type="button"
                  onClick={() => quickFill(a.email)}
                  className="rounded-md border bg-background px-2.5 py-1.5 text-left text-xs transition-colors hover:border-primary hover:bg-accent"
                >
                  <span className="block font-medium">{a.label}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {a.email}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <LoginForm />
    </Suspense>
  );
}
