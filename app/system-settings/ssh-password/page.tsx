"use client";

import { useTranslation } from "react-i18next";
import SshPasswordCard from "@/components/system-settings/ssh-password/ssh-password-card";

const SshPasswordPage = () => {
  const { t } = useTranslation("system-settings");
  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">{t("ssh_password.page_title")}</h1>
        <p className="text-muted-foreground">
          {t("ssh_password.page_description")}
        </p>
      </div>
      <SshPasswordCard />
    </div>
  );
};

export default SshPasswordPage;
