import { Suspense } from "react";
import { devLoginAvailable, googleLoginAvailable } from "@/lib/auth";
import { SignInForm } from "./SignInForm";

export const metadata = {
  title: "Sign in — Viralis",
};

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm devLoginAvailable={devLoginAvailable} googleLoginAvailable={googleLoginAvailable} />
    </Suspense>
  );
}
