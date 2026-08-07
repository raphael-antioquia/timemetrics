import Link from "next/link";
import { signUp } from "@/app/auth/actions";
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

type SignUpPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
};

export default async function SignUpPage({
  searchParams,
}: SignUpPageProps) {
  const { error, message } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8 sm:px-6">
      <div className="w-full max-w-md">
        <p className="text-muted-foreground mb-6 text-center text-sm font-medium uppercase tracking-wide">
          TimeMetrics
        </p>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">
              <h1>Create your account</h1>
            </CardTitle>

            <CardDescription>
              Start tracking your focused work.
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

            {message && (
              <p
                role="status"
                className="mb-4 text-sm text-emerald-600 dark:text-emerald-400"
              >
                {message}
              </p>
            )}

            <form action={signUp} className="space-y-5">
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
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">
                  Confirm password
                </Label>

                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full"
              >
                Sign up
              </Button>
            </form>

            <p className="text-muted-foreground mt-6 text-center text-sm">
              Already have an account?{" "}
              <Link
                href="/sign-in"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}