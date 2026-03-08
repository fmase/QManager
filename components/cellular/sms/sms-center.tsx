"use client";

import React from "react";
import SmsInboxCard from "./sms-inbox-card";
import { useSms } from "@/hooks/use-sms";

const SmsCenterComponent = () => {
  const {
    data,
    isLoading,
    isSaving,
    error,
    sendSms,
    deleteSms,
    deleteAllSms,
    refresh,
  } = useSms();

  return (
    <div className="@container/main mx-auto p-2">
      <div className="grid grid-cols-1 grid-flow-row gap-4 *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:shadow-xs">
        <SmsInboxCard
          data={data}
          isLoading={isLoading}
          isSaving={isSaving}
          onSend={sendSms}
          onDelete={deleteSms}
          onDeleteAll={deleteAllSms}
          onRefresh={() => refresh()}
        />
      </div>
    </div>
  );
};

export default SmsCenterComponent;
