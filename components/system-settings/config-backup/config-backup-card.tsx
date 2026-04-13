"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { SaveButton } from "@/components/ui/save-button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { DownloadIcon } from "lucide-react";

const ConfigBackupCard = () => {
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Configuration Backup</CardTitle>
        <CardDescription>
          Download a backup of your current modem configuration.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-y-8"
          onSubmit={(e) => {
            e.preventDefault();
            alert("Backup functionality not implemented yet");
          }}
        >
          <FieldSet>
            <FieldLegend variant="label">
              Select the items you want to include in the backup.
            </FieldLegend>
            <FieldGroup className="gap-3">
              <Field orientation="horizontal">
                <Checkbox
                  id="finder-pref-9k2-hard-disks-ljj-checkbox"
                  name="finder-pref-9k2-hard-disks-ljj-checkbox"
                  defaultChecked
                />
                <FieldLabel
                  htmlFor="finder-pref-9k2-hard-disks-ljj-checkbox"
                  className="font-normal"
                >
                  Network Mode and APN settings
                </FieldLabel>
              </Field>
              <Field orientation="horizontal">
                <Checkbox
                  id="finder-pref-9k2-external-disks-1yg-checkbox"
                  name="finder-pref-9k2-external-disks-1yg-checkbox"
                  defaultChecked
                />
                <FieldLabel
                  htmlFor="finder-pref-9k2-external-disks-1yg-checkbox"
                  className="font-normal"
                >
                  Preferred LTE and 5G bands
                </FieldLabel>
              </Field>
              <Field orientation="horizontal">
                <Checkbox
                  id="finder-pref-9k2-cds-dvds-fzt-checkbox"
                  name="finder-pref-9k2-cds-dvds-fzt-checkbox"
                />
                <FieldLabel
                  htmlFor="finder-pref-9k2-cds-dvds-fzt-checkbox"
                  className="font-normal"
                >
                  Preferred Tower Locking settings
                </FieldLabel>
              </Field>
              <Field orientation="horizontal">
                <Checkbox
                  id="finder-pref-9k2-cds-dvds-fzt-checkbox"
                  name="finder-pref-9k2-cds-dvds-fzt-checkbox"
                />
                <FieldLabel
                  htmlFor="finder-pref-9k2-cds-dvds-fzt-checkbox"
                  className="font-normal"
                >
                  Preferred TTL/HL settings
                </FieldLabel>
              </Field>
              <Field orientation="horizontal">
                <Checkbox
                  id="finder-pref-9k2-connected-servers-6l2-checkbox"
                  name="finder-pref-9k2-connected-servers-6l2-checkbox"
                />
                <FieldLabel
                  htmlFor="finder-pref-9k2-connected-servers-6l2-checkbox"
                  className="font-normal"
                >
                  Preferred IMEI Settings
                </FieldLabel>
              </Field>
            </FieldGroup>
          </FieldSet>
          <div className="grid gap-y-4">
            <div className="flex items-center space-x-2">
              <Switch id="config-password" />
              <Label htmlFor="config-password">Configuration Password</Label>
            </div>

            <Field>
              <FieldLabel htmlFor="config-password-input">
                Enter your configuration password
              </FieldLabel>
              <Input
                id="config-password-input"
                type="password"
                placeholder="rm551e-..."
                className="max-w-sm"
              />
            </Field>
          </div>

          <div>
            <Button type="submit">
              <DownloadIcon />
              Download Backup
            </Button>
          </div>

          {/* <SaveButton
            type="submit"
            isSaving={isSaving}
            saved={saved}
            disabled={!canSave}
          /> */}
        </form>
      </CardContent>
    </Card>
  );
};

export default ConfigBackupCard;
