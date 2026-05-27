import LoginComponent from "@/components/auth/login-component";
import { LoginLanguagePicker } from "@/components/auth/login-language-picker";

const LoginPage = () => {
  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginComponent />
      </div>
      {/*
        DOM-last on purpose: `fixed` keeps the picker pinned top-right, while
        tab order still lands on the password field first per the design brief.
      */}
      <LoginLanguagePicker className="fixed top-4 right-4 z-10" />
    </div>
  );
};

export default LoginPage;
