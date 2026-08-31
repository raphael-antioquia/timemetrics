"use client";

import { signOut } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { clearPersistedTimer } from "@/lib/time/persisted-timer";

// Client component so persisted timer state is cleared before sign-out
// navigates away, preventing it from carrying into another account.
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