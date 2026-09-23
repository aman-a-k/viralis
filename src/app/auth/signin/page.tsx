import { Suspense } from "react";
import { devLoginAvailable, googleLoginAvailable } from "@/lib/auth";
import { isSignupOpen } from "@/lib/signupPolicy";
import { SignInForm } from "./SignInForm";

export const metadata = {
  title: "Sign in — Viralis",
};

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  const signupOpen = await isSignupOpen().catch(() => false);
  return (
    <Suspense fallback={null}>
      <SignInForm
        devLoginAvailable={devLoginAvailable}
        googleLoginAvailable={googleLoginAvailable}
        signupOpen={signupOpen}
      />
    </Suspense>
  );
}
