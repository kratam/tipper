"use client";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

function GoogleG({ size = 19 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="Google">
      <title>Google</title>
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.2 13.5 17.6 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.5 24.5c0-1.6-.2-3.2-.5-4.7H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8C43.9 37.9 46.5 31.8 46.5 24.5z"
      />
      <path
        fill="#FBBC05"
        d="M10.4 28.3c-.5-1.4-.8-2.9-.8-4.3s.3-3 .8-4.3l-7.8-6.1C1 16.7 0 20.2 0 24s1 7.3 2.6 10.4l7.8-6.1z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.2 0 11.5-2 15.3-5.5l-7.5-5.8c-2 1.4-4.7 2.3-7.8 2.3-6.4 0-11.8-4-13.6-9.8l-7.8 6.1C6.5 42.6 14.6 48 24 48z"
      />
    </svg>
  );
}

interface GoogleSignInButtonProps {
  /** Hova térjen vissza a böngésző a sikeres login után. */
  callbackURL: string;
  label: string;
}

/**
 * Egységes Google bejelentkező gomb. A `callbackURL` őrzi meg a login szándékot
 * (pl. `/join/4V8M35`), hogy az OAuth oda-vissza úton ne vesszen el.
 */
export function GoogleSignInButton({ callbackURL, label }: GoogleSignInButtonProps) {
  function handleSignIn() {
    authClient.signIn.social({ provider: "google", callbackURL });
  }

  return (
    <Button variant="google" size="lg" className="mt-1.5" onClick={handleSignIn}>
      <GoogleG size={19} />
      {label}
    </Button>
  );
}
