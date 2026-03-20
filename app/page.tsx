import Link from "next/link";
import { Button } from "@/components/ui/button";
import LoginComponent from "@/components/auth/login-component";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main>
        <LoginComponent />
      </main>
    </div>
  );
}
