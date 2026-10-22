"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { signUp } from "@/lib/auth-client";

export default function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await signUp.email({
        name,
        email,
        password,
        callbackURL: callbackUrl,
      });
      if (result.error) {
        setError(result.error.message || "Sign up failed");
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("Sign up failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="card-body gap-4" onSubmit={onSubmit}>
      {error ? (
        <div role="alert" className="alert alert-error text-sm">
          <span>{error}</span>
        </div>
      ) : null}
      <label className="form-control w-full">
        <span className="label-text">Name</span>
        <input
          type="text"
          className="input input-bordered w-full"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoComplete="name"
        />
      </label>
      <label className="form-control w-full">
        <span className="label-text">Email</span>
        <input
          type="email"
          className="input input-bordered w-full"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </label>
      <label className="form-control w-full">
        <span className="label-text">Password</span>
        <input
          type="password"
          className="input input-bordered w-full"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
      </label>
      <button type="submit" className="btn btn-primary" disabled={loading}>
        {loading ? "Creating account…" : "Create account"}
      </button>
      <p className="text-center text-sm">
        Already have an account?{" "}
        <Link
          href={`/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          className="link link-primary"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
