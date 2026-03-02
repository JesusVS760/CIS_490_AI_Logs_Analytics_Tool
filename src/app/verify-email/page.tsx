"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type ApiResponse = { success: boolean; message: string; redirectTo?: string };

const CODE_LEN = 6;
const initialDigits = Array(CODE_LEN).fill("");

export default function VerifyEmailPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [digits, setDigits] = useState<string[]>(initialDigits);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const code = useMemo(() => digits.join(""), [digits]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("pendingVerifyEmail");
      if (stored) setEmail(stored);
    } catch {}
  }, []);

  const focus = (i: number) => refs.current[i]?.focus();

  const setAt = (i: number, val: string) =>
    setDigits((prev) => {
      const next = [...prev];
      next[i] = val;
      return next;
    });

  const handleChange = (i: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setStatus(null);
    const only = (e.target.value || "").replace(/\D/g, "");

    if (!only) return setAt(i, "");

    // If paste/multi-type, spread across boxes
    if (only.length > 1) {
      const next = [...digits];
      let idx = i;
      for (const ch of only) {
        if (idx >= CODE_LEN) break;
        next[idx++] = ch;
      }
      setDigits(next);
      if (idx < CODE_LEN) focus(idx);
      return;
    }

    setAt(i, only);
    if (i < CODE_LEN - 1) focus(i + 1);
  };

  const handleKeyDown = (i: number) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Backspace") return;

    if (digits[i]) return setAt(i, "");
    if (i > 0) {
      e.preventDefault();
      setAt(i - 1, "");
      focus(i - 1);
    }
  };

  const handlePaste = (i: number) => (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!text) return;
    e.preventDefault();

    const next = [...digits];
    let idx = i;
    for (const ch of text) {
      if (idx >= CODE_LEN) break;
      next[idx++] = ch;
    }
    setDigits(next);
    if (idx < CODE_LEN) focus(idx);
  };

  const parse = (payload: unknown): ApiResponse => {
    if (typeof payload === "string") {
      try {
        return JSON.parse(payload) as ApiResponse;
      } catch {
        return { success: false, message: "Invalid API response." };
      }
    }
    if (payload && typeof payload === "object") {
      const d = payload as Partial<ApiResponse>;
      return { success: !!d.success, message: d.message ?? "Done.", redirectTo: d.redirectTo };
    }
    return { success: false, message: "Unexpected API response." };
  };

  const verify = async () => {
    setStatus(null);
    if (!email) return setStatus("Missing email. Please register again.");
    if (code.length !== 6 || digits.some((d) => !d)) return setStatus("Enter the 6-digit code.");

    setLoading(true);
    try {
      const res = await axios.post("/api/auth/verify-email", { email, code });
      const data = parse(res.data);
      if (!data.success) return setStatus(data.message);

      try {
        localStorage.removeItem("pendingVerifyEmail");
      } catch {}
      router.push(data.redirectTo ?? "/login");
    } catch (err) {
      setStatus(axios.isAxiosError(err) ? (err.response?.data as any)?.message ?? "Verification failed." : "Unexpected error.");
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setStatus(null);
    if (!email) return setStatus("Missing email. Please register again.");

    setResending(true);
    try {
      const res = await axios.post("/api/auth/resend-verification", { email });
      const data = parse(res.data);
      if (!data.success) return setStatus(data.message);

      setDigits(initialDigits);
      focus(0);
      setStatus(data.message || "New code sent.");
    } catch (err) {
      setStatus(axios.isAxiosError(err) ? (err.response?.data as any)?.message ?? "Could not resend." : "Unexpected error.");
    } finally {
      setResending(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-md rounded-xl border border-slate-200 bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200 p-8 shadow-sm">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-200/70">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" className="text-slate-900">
          <path d="M17 11V8a5 5 0 0 0-10 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path
            d="M7 11h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M12 15v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>

      <h1 className="text-center text-3xl font-semibold text-slate-900">Verify Your Email</h1>
      <p className="mt-3 text-center text-sm text-slate-700">
        A 6-digit code was sent to the email you provided.
        <br />
        Enter it within 10 minutes.
      </p>

      <form
        className="mt-8 space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          void verify();
        }}
      >
        <div className="space-y-2">
          <Label className="sr-only" htmlFor="code-0">
            Verification code
          </Label>

          <div className="flex justify-center gap-3">
            {digits.map((v, i) => (
              <Input
                key={i}
                id={`code-${i}`}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                value={v}
                inputMode="numeric"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                onChange={handleChange(i)}
                onKeyDown={handleKeyDown(i)}
                onPaste={handlePaste(i)}
                className="h-16 w-16 rounded-2xl text-center text-2xl font-semibold"
                aria-label={`Digit ${i + 1}`}
              />
            ))}
          </div>
        </div>

        <Button type="submit" className="w-full bg-slate-700 hover:bg-slate-800" disabled={loading}>
          {loading ? "Verifying..." : "Verify email"}
        </Button>

        <div className="flex justify-center">
          <Button type="button" variant="secondary" className="rounded-full px-6" onClick={resend} disabled={resending}>
            {resending ? "Resending..." : "Resend code"}
          </Button>
        </div>
      </form>

      {status ? <p className="mt-4 text-center text-sm text-red-700">{status}</p> : null}
    </section>
  );
}