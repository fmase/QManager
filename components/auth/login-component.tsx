"use client";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import Link from "next/link";

const LoginComponent = () => {
  return (
    <div className="flex flex-col gap-6">
      <form
        method="post"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const data = new FormData(form);
          // Submit via POST body — never in query string
          fetch("/cgi-bin/quecmanager/auth/login.sh", {
            method: "POST",
            body: data,
          })
            .then((r) => r.json())
            .then((res) => {
              if (res.success) {
                window.location.href = "/dashboard";
              } else {
                // Show inline error
                const errEl = document.getElementById("login-error");
                if (errEl) {
                  errEl.textContent =
                    res.message || "Invalid password. Please try again.";
                  errEl.classList.remove("hidden");
                }
              }
            })
            .catch(() => {
              const errEl = document.getElementById("login-error");
              if (errEl) {
                errEl.textContent = "Connection failed. Please try again.";
                errEl.classList.remove("hidden");
              }
            });
        }}
      >
        <FieldGroup>
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex flex-col items-center gap-2 font-medium">
              <div className="flex size-16 p-1 items-center justify-center rounded-md">
                <img
                  src="/qmanager-logo.svg"
                  alt="QManager Logo"
                  className="size-full"
                />
              </div>
            </div>
            <h1 className="text-xl font-bold">Welcome to QManager</h1>
            <FieldDescription>
              Enter your device password to continue.
            </FieldDescription>
          </div>
          <Field>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
            <p
              id="login-error"
              role="alert"
              className="hidden text-sm text-destructive"
            />
          </Field>
          <Field>
            {/* Temporary redirect link to dashboard */}
            {/* TODO: Auth Logic */}
            <Link href="/dashboard">
              <Button type="submit">Login</Button>
            </Link>
          </Field>
        </FieldGroup>
      </form>
      <FieldDescription className="px-6 text-center">
        QManager — Quectel Modem Management
      </FieldDescription>
    </div>
  );
};

export default LoginComponent;
