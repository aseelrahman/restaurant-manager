import { Suspense } from "react";
import SignUpForm from "@/components/auth/SignUpForm";

export default function SignUpPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <div className="card w-full max-w-md bg-base-100 shadow-xl">
        <div className="card-body pb-2">
          <h1 className="card-title text-2xl">Create account</h1>
          <p className="text-sm text-base-content/70">
            New accounts are customers by default.
          </p>
        </div>
        <Suspense
          fallback={
            <div className="card-body pt-0">
              <span className="loading loading-spinner" />
            </div>
          }
        >
          <SignUpForm />
        </Suspense>
      </div>
    </div>
  );
}
