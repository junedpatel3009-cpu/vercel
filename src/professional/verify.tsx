import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { useRef, useState } from "react";

export const Route = createFileRoute("/verify")({
  head: () => ({ meta: [{ title: "Verify your account — Servio" }] }),
  component: Verify,
});

function Verify() {
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const set = (i: number, v: string) => {
    const next = [...code];
    next[i] = v.slice(-1);
    setCode(next);
    if (v && i < 5) refs.current[i + 1]?.focus();
  };

  return (
    <AuthLayout
      title="Verify your email"
      subtitle="We sent a 6-digit code to jane@company.com. Enter it below to continue."
      footer={
        <>
          Didn't get it? <button className="text-primary hover:underline">Resend code</button>
        </>
      }
    >
      <div className="flex justify-between gap-2">
        {code.map((c, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            value={c}
            onChange={(e) => set(i, e.target.value)}
            className="h-14 w-12 rounded-xl border border-input bg-card text-center text-xl font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            inputMode="numeric"
            maxLength={1}
          />
        ))}
      </div>
      <Button asChild className="mt-6 w-full">
        <Link to="/dashboard">Verify and continue</Link>
      </Button>
    </AuthLayout>
  );
}
