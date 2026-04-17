import SshPasswordCard from "@/components/system-settings/ssh-password/ssh-password-card";

const SshPasswordPage = () => {
  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">SSH Password</h1>
        <p className="text-muted-foreground">
          Change the root password used for SSH and console access. This is
          independent from your QManager web login.
        </p>
      </div>
      <SshPasswordCard />
    </div>
  );
};

export default SshPasswordPage;
