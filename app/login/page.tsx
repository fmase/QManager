import LoginComponent from "@/components/auth/login-component";

// =============================================================================
// /login page wrapper
// =============================================================================
// Mirrors app/page.tsx (the public Overview): same background, same vertical
// centering, same body font. Only the max-width narrows from `max-w-lg`
// (Overview, 3-column data grid earns the width) to `max-w-md` (Login, single
// password field). The Card silhouette stays recognisably the same family;
// the width step signals the user has crossed from "at a glance" into "focused
// task." LoginLanguagePicker no longer floats in the corner — it lives inside
// the Card's CardAction next to ModeToggle, so the chrome is one rectangle.
// =============================================================================

const LoginPage = () => {
  return (
    <div className="bg-background flex min-h-svh items-center justify-center p-4 font-sans">
      <main className="w-full max-w-md">
        <LoginComponent />
      </main>
    </div>
  );
};

export default LoginPage;
