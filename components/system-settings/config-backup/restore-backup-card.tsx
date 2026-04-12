import React from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

import { Button } from "@/components/ui/button";
import { ArchiveRestoreIcon } from "lucide-react";

const RestoreConfigBackupCard = () => {
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Restore Configuration Backup</CardTitle>
        <CardDescription>
          Restore your modem configuration from a previously downloaded backup
          file. This will overwrite your current settings.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ArchiveRestoreIcon />
            </EmptyMedia>
            <EmptyTitle>No backup file selected</EmptyTitle>
            <EmptyDescription>
              Upload a backup file to restore your modem configuration. The file
              must be in the correct format and encrypted for this device.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" size="sm">
              Upload Backup File
            </Button>
          </EmptyContent>
        </Empty>
      </CardContent>
    </Card>
  );
};

export default RestoreConfigBackupCard;
