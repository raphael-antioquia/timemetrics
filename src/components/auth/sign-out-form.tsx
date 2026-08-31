"use client";

import { signOut } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { clearPersistedTimer } from "@/lib/time/persisted-timer";

// Clears persisted timer state before sign-out navigates away. Ownership
// is enforced on read, so this is defense-in-depth rather than the
// primary control.
export function SignOutForm() {
  return (
    <form
      action={signOut}
      onSubmit={() => {
        clearPersistedTimer();
      }}
    >
      <Button
        type="submit"
        variant="outline"
        size="sm"
      >
        Log out
      </Button>
    </form>
  );
}