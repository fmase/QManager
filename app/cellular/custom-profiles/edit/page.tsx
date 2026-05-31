"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ArrowLeftIcon, SearchXIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useSimProfiles } from "@/hooks/use-sim-profiles";
import type { SimProfile } from "@/types/sim-profile";
import { ProfileEditor } from "@/components/cellular/custom-profiles/profile-form/profile-editor";

// =============================================================================
// Edit Profile page — /cellular/custom-profiles/edit?id=<id>
// =============================================================================
// Static-export friendly: the profile id rides a query param (read via
// useSearchParams inside a Suspense boundary) rather than a dynamic [id]
// segment, which `output: export` cannot pre-render for runtime ids. Loads the
// full profile before mounting the wizard so its state seeds cleanly.
// =============================================================================

const LIST_PATH = "/cellular/custom-profiles/";

function EditFormSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-12 w-full rounded-lg" />
      <Card>
        <CardContent className="space-y-4 py-6">
          <Skeleton className="h-9 w-full rounded-md" />
          <Skeleton className="h-9 w-full rounded-md" />
          <Skeleton className="h-9 w-2/3 rounded-md" />
        </CardContent>
      </Card>
    </div>
  );
}

function EditProfileInner() {
  const { t } = useTranslation("cellular");
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id");

  const { updateProfile, getProfile } = useSimProfiles();
  // undefined = loading, null = not found, profile = loaded
  const [fetched, setFetched] = useState<SimProfile | null | undefined>(
    undefined,
  );

  useEffect(() => {
    if (!id) return; // missing id resolves to not-found during render, no setState here
    let active = true;
    getProfile(id).then((p) => {
      if (active) setFetched(p);
    });
    return () => {
      active = false;
    };
  }, [id, getProfile]);

  // A missing id is "not found" without a fetch; otherwise track the query.
  const profile: SimProfile | null | undefined = id ? fetched : null;

  const back = () => router.push(LIST_PATH);

  const description =
    profile === undefined
      ? t("custom_profiles.form.edit_loading")
      : profile
        ? t("custom_profiles.form.edit_description", { name: profile.name })
        : t("custom_profiles.edit.not_found_desc");

  return (
    <div className="@container/main mx-auto p-2">
      <header className="mb-6">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="text-muted-foreground -ml-2 mb-2"
        >
          <Link href={LIST_PATH}>
            <ArrowLeftIcon className="size-4" />
            {t("custom_profiles.form.back_to_list")}
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">
          {t("custom_profiles.form.edit_title")}
        </h1>
        <p className="text-muted-foreground mt-2">{description}</p>
      </header>

      {profile === undefined ? (
        <EditFormSkeleton />
      ) : profile === null ? (
        <Card>
          <CardContent className="flex items-center justify-center py-10">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SearchXIcon />
                </EmptyMedia>
                <EmptyTitle>
                  {t("custom_profiles.edit.not_found_title")}
                </EmptyTitle>
                <EmptyDescription>
                  {t("custom_profiles.edit.not_found_desc")}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={back}>
                  <ArrowLeftIcon className="size-4" />
                  {t("custom_profiles.form.back_to_list")}
                </Button>
              </EmptyContent>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <ProfileEditor
          mode="edit"
          initialProfile={profile}
          onSave={(data) =>
            updateProfile(profile.id, data).then((ok) =>
              ok ? profile.id : null,
            )
          }
          onDone={back}
          onCancel={back}
        />
      )}
    </div>
  );
}

export default function EditProfilePage() {
  return (
    <Suspense fallback={null}>
      <EditProfileInner />
    </Suspense>
  );
}
