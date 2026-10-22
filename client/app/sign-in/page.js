import { Suspense } from "react";
import SignInForm from "@/components/auth/SignInForm";

export default function SignInPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <div className="card w-full max-w-md bg-base-100 shadow-xl">
        <div className="card-body pb-2">
          <h1 className="card-title text-2xl">Sign in</h1>
          <p className="text-sm text-base-content/70">
            Use your email and password to order and reserve.
          </p>
        </div>
        <Suspense
          fallback={
            <div className="card-body pt-0">
              <span className="loading loading-spinner" />
            </div>
          }
        >
          <SignInForm />
        </Suspense>
      </div>
    </div>
  );
}
