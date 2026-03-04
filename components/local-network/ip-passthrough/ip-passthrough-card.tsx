"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, RotateCcwIcon } from "lucide-react";

import { useIpPassthrough } from "@/hooks/use-ip-passthrough";
import type { PassthroughMode, UsbMode, DnsProxy } from "@/types/ip-passthrough";

// MAC source: "client" = use client_mac from server, "manual" = text input
type MacSource = "client" | "manual";

const IPPassthroughCard = () => {
  const {
    passthroughMode,
    targetMac,
    usbMode,
    dnsProxy,
    clientMac,
    isLoading,
    isSaving,
    error,
    saveSettings,
    rebootDevice,
  } = useIpPassthrough();

  // Local form state
  const [localMode, setLocalMode] = useState<PassthroughMode>("disabled");
  const [localMacSource, setLocalMacSource] = useState<MacSource>("client");
  const [localMacInput, setLocalMacInput] = useState<string>("");
  const [localUsbMode, setLocalUsbMode] = useState<UsbMode>("1");
  const [localDnsProxy, setLocalDnsProxy] = useState<DnsProxy>("disabled");

  // Reboot dialog state
  const [showRebootDialog, setShowRebootDialog] = useState(false);
  const [isRebooting, setIsRebooting] = useState(false);

  // Sync form state when data arrives from server
  useEffect(() => {
    if (passthroughMode !== null) setLocalMode(passthroughMode);
    if (usbMode !== null) setLocalUsbMode(usbMode);
    if (dnsProxy !== null) setLocalDnsProxy(dnsProxy);

    if (targetMac !== null && passthroughMode !== "disabled") {
      // If the stored MAC matches the client MAC, default to "client" source
      if (clientMac && targetMac === clientMac) {
        setLocalMacSource("client");
      } else if (targetMac !== "") {
        setLocalMacSource("manual");
        setLocalMacInput(targetMac);
      } else {
        setLocalMacSource("client");
      }
    }
  }, [passthroughMode, targetMac, usbMode, dnsProxy, clientMac]);

  // Resolved MAC to send to backend
  const resolvedMac =
    localMacSource === "client" ? (clientMac ?? "") : localMacInput;

  const macRequired = localMode !== "disabled";
  const macValid =
    !macRequired ||
    /^[0-9A-Fa-f]{2}(:[0-9A-Fa-f]{2}){5}$/.test(resolvedMac);

  const syncFromServer = () => {
    if (passthroughMode !== null) setLocalMode(passthroughMode);
    if (usbMode !== null) setLocalUsbMode(usbMode);
    if (dnsProxy !== null) setLocalDnsProxy(dnsProxy);

    if (targetMac !== null && passthroughMode !== "disabled") {
      if (clientMac && targetMac === clientMac) {
        setLocalMacSource("client");
      } else if (targetMac !== "") {
        setLocalMacSource("manual");
        setLocalMacInput(targetMac);
      } else {
        setLocalMacSource("client");
      }
    } else {
      setLocalMacSource("client");
      setLocalMacInput("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (macRequired && resolvedMac === "") {
      toast.error("A target device MAC address is required");
      return;
    }

    if (!macValid) {
      toast.error("Enter a valid MAC address (XX:XX:XX:XX:XX:XX)");
      return;
    }

    const success = await saveSettings({
      passthrough_mode: localMode,
      target_mac: macRequired ? resolvedMac : "",
      usb_mode: localUsbMode,
      dns_proxy: localDnsProxy,
    });

    if (success) {
      toast.success("Settings saved — reboot required to apply");
      setShowRebootDialog(true);
    } else {
      toast.error("Failed to save IP Passthrough settings");
    }
  };

  const handleReboot = async () => {
    setIsRebooting(true);
    const sent = await rebootDevice();
    if (sent) {
      toast.success("Device is rebooting…");
    } else {
      toast.error("Failed to send reboot command");
      setIsRebooting(false);
    }
  };

  // Format MAC input: strip non-hex, uppercase, insert colons
  const handleMacInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9A-Fa-f]/g, "").toUpperCase();
    const formatted = raw.match(/.{1,2}/g)?.join(":") ?? raw;
    setLocalMacInput(formatted.slice(0, 17));
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>IP Passthrough (IPPT) Configuration</CardTitle>
          <CardDescription>
            Manage your IP Passthrough settings to optimize network performance
            and connectivity for your devices.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid xl:grid-cols-2 grid-cols-1 gap-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-9 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-9 w-full" />
              </div>
            </div>
            <div className="grid xl:grid-cols-2 grid-cols-1 gap-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-9 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-9 w-full" />
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-9 w-9" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>IP Passthrough (IPPT) Configuration</CardTitle>
        <CardDescription>
          Manage your IP Passthrough settings to optimize network performance
          and connectivity for your devices.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <p className="text-sm text-destructive mb-4">{error}</p>
        )}
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="w-full">
            <FieldSet>
              <FieldGroup>
                <div className="grid xl:grid-cols-2 grid-cols-1 gap-4">
                  {/* Field 1: Passthrough Mode */}
                  <Field>
                    <FieldLabel>IP Passthrough (Bridge)</FieldLabel>
                    <Select
                      name="ippt_mode"
                      value={localMode}
                      onValueChange={(v) => setLocalMode(v as PassthroughMode)}
                      disabled={isSaving}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="disabled">
                          Disabled (Router Mode)
                        </SelectItem>
                        <SelectItem value="eth">Ethernet (ETH)</SelectItem>
                        <SelectItem value="usb">USB Tethering</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>

                  {/* Field 2: Target Device MAC (hidden when disabled) */}
                  <Field>
                    <FieldLabel>Target Device (MAC)</FieldLabel>
                    <AnimatePresence mode="wait">
                      {localMode === "disabled" ? (
                        <motion.div
                          key="mac-disabled"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <Select disabled>
                            <SelectTrigger>
                              <SelectValue placeholder="N/A — Router Mode" />
                            </SelectTrigger>
                            <SelectContent />
                          </Select>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="mac-active"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="flex flex-col gap-2"
                        >
                          <Select
                            name="mac_source"
                            value={localMacSource}
                            onValueChange={(v) =>
                              setLocalMacSource(v as MacSource)
                            }
                            disabled={isSaving}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select Target" />
                            </SelectTrigger>
                            <SelectContent>
                              {clientMac && (
                                <SelectItem value="client">
                                  This Device (Recommended)
                                </SelectItem>
                              )}
                              <SelectItem value="manual">
                                Enter Manually…
                              </SelectItem>
                            </SelectContent>
                          </Select>

                          {/* Manual MAC text input */}
                          <AnimatePresence mode="wait">
                            {localMacSource === "manual" && (
                              <motion.div
                                key="manual-mac-input"
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.3, ease: "easeInOut" }}
                              >
                                <Input
                                  placeholder="XX:XX:XX:XX:XX:XX"
                                  className="font-mono uppercase placeholder:normal-case"
                                  value={localMacInput}
                                  onChange={handleMacInputChange}
                                  maxLength={17}
                                  disabled={isSaving}
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                  Only this specific device will receive the WAN IP.
                                </p>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Field>
                </div>

                <div className="grid xl:grid-cols-2 grid-cols-1 grid-flow-row gap-4">
                  {/* Field 3: USB Modem Protocol */}
                  <Field>
                    <FieldLabel>USB Connection Mode</FieldLabel>
                    <Select
                      value={localUsbMode}
                      onValueChange={(v) => setLocalUsbMode(v as UsbMode)}
                      disabled={isSaving}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose USB Modem Protocol" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">RMNET (QMI)</SelectItem>
                        <SelectItem value="1">ECM (Universal)</SelectItem>
                        <SelectItem value="2">MBIM (Windows)</SelectItem>
                        <SelectItem value="3">RNDIS (Legacy)</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>

                  {/* Field 4: DNS Offloading */}
                  <Field>
                    <FieldLabel>DNS Offloading</FieldLabel>
                    <Select
                      name="dns_mode"
                      value={localDnsProxy}
                      onValueChange={(v) => setLocalDnsProxy(v as DnsProxy)}
                      disabled={isSaving}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select DNS Strategy" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="disabled">
                          Disabled (Recommended)
                        </SelectItem>
                        <SelectItem value="enabled">
                          Enabled (Use Modem DNS)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </FieldGroup>
            </FieldSet>
          </div>

          <div className="flex items-center gap-x-2">
            <Button type="submit" disabled={isSaving || !macValid}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save Settings"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={syncFromServer}
              disabled={isSaving}
            >
              <RotateCcwIcon />
            </Button>
          </div>
        </form>

        {/* Reboot confirmation dialog */}
        <AlertDialog open={showRebootDialog} onOpenChange={setShowRebootDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reboot Required</AlertDialogTitle>
              <AlertDialogDescription>
                IP Passthrough changes require a device reboot to take effect.
                Would you like to reboot now?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isRebooting}>
                Reboot Later
              </AlertDialogCancel>
              <AlertDialogAction disabled={isRebooting} onClick={handleReboot}>
                {isRebooting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Rebooting…
                  </>
                ) : (
                  "Reboot Now"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};

export default IPPassthroughCard;
