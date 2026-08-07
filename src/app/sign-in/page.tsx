import Link from "next/link";
import { signIn } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SignInPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function SignInPage({
  searchParams,
}: SignInPageProps) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8 sm:px-6">
      <div className="w-full max-w-md">
        <p className="text-muted-foreground mb-6 text-center text-sm font-medium uppercase tracking-wide">
          TimeMetrics
        </p>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">
              <h1>Sign in</h1>
            </CardTitle>

            <CardDescription>
              Continue to TimeMetrics.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {error && (
              <p
                role="alert"
                className="text-destructive mb-4 text-sm"
              >
                {error}
              </p>
            )}

            <form action={signIn} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">
                  Email
                </Label>

                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">
                  Password
                </Label>

                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full"
              >
                Sign in
              </Button>
            </form>

            <p className="text-muted-foreground mt-6 text-center text-sm">
              Need an account?{" "}
              <Link
                href="/sign-up"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                Sign up
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}