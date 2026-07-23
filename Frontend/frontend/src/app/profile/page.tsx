"use client";
import { apiGet, createApiClient ,apiPatch} from "@/lib/api-client";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {LogIn, Save, User} from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar ,AvatarFallback, AvatarImage} from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {toast} from "sonner"
import Link from "next/link";


const optionalText = z
  .string()
  .transform((value) => value.trim())
  .transform((value) => (value === "" ? undefined : value))
  .optional();

const ProfileSchema = z.object({
  displayName: optionalText,
  handle: optionalText,
  bio: optionalText,
  avatarUrl: optionalText,
});

type ProfileFormValues = z.infer<typeof ProfileSchema>;

type UserResponse = {
  id: Number;
  clerkUserId: string;
  displayName: string | null;
  email: string | null;
  handle: string | null;
  avatarUrl: string | null;
  bio: string | null;
};

function ProfilePage() {
  const { getToken, isSignedIn } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const apiClient = useMemo(() => createApiClient(getToken), [getToken]);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(ProfileSchema),
    defaultValues: {
      displayName: "",
      handle: "",
      bio: "",
      avatarUrl: "",
    },
  });

  async function onSubmit(values: ProfileFormValues) {
    try{
      setIsSaving(true);
      const payload :Record<string, string> = {};

      if(values.displayName) payload.displayName = values.displayName;
      if(values.handle) payload.handle = values.handle.toLowerCase().trim();
      if(values.bio) payload.bio = values.bio;
      if(values.avatarUrl) payload.avatarUrl = values.avatarUrl;
      const apiResult = await apiPatch<typeof payload, UserResponse>(apiClient, "/api/me", payload);
      form.reset({
        displayName: apiResult.displayName ?? "",
        handle: apiResult.handle ?? "",
        bio: apiResult.bio ?? "",
        avatarUrl: apiResult.avatarUrl ?? "",
      });
      toast.success("Profile updated successfully",{
        description:"Your profile information has been updated."
      });
      console.log(apiResult, "apiResult");
    }
    catch(e)
    {
        console.log(e);
    }
    finally{
        setIsSaving(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      try {
        setIsLoading(true);
        const getUserInfo = await apiGet<UserResponse>(apiClient, "/api/me");

        if (!isMounted) return;

        console.log(getUserInfo, "getUserInfo");

        form.reset({
          displayName: getUserInfo.displayName ?? "",
          handle: getUserInfo.handle ?? "",
          bio: getUserInfo.bio ?? "",
          avatarUrl: getUserInfo.avatarUrl ?? "",
        });
      } catch (error) {
        console.log(error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadProfile();
  }, [apiClient, form]);

  // watch is used to get the current values of the form fields, which can be useful for various purposes such as enabling/disabling buttons, showing live previews, or performing validations based on the current input.
  // we can;t use direct from values because it won't update as the user types, watch allows us to get the latest values in real-time.


  const displayNameValue = form.watch("displayName");
  const handleValue = form.watch("handle");
  const bioValue = form.watch("bio");
  const avatarUrlValue = form.watch("avatarUrl");

  // Generate initials for avatar fallback
  const initials = displayNameValue
    ? displayNameValue
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <>
      {isSignedIn ? (
        <div className="mx-auto fle w-full max-w-2xl flex-col gap-6 px-4 py-8">
          <div>
            <h1 className=" flex items-center gap-2 text-3xl font-bold tracking-tight text-foreground">
              <User className="h-8 w-8 text-primary" />
              Profile Settings
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage your profile information
            </p>
            <div>
              {/* Skeleton for profile card header */}
              {isLoading ? (
                <Card className="mt-6 border-border/70 bg-card shadow-sm">
                  <CardHeader>
                    <div className="flex items-start gap-6">
                      <div className="skeleton h-20 w-20 rounded-full" />
                      <div className="flex-1 space-y-3">
                        <div className="skeleton h-7 w-48" />
                        <div className="skeleton h-6 w-24 rounded-full" />
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ) : (
                <Card className="mt-6 border-border/70 bg-card shadow-sm">
                  <CardHeader>
                    <div className="flex items-start gap-6 ">
                      <Avatar className="h-20 w-20 rounded-full">
                        {avatarUrlValue && (
                          <AvatarImage
                            src={avatarUrlValue}
                            alt={displayNameValue ?? ""}
                          />
                        )}
                        <AvatarFallback className="bg-primary/15 text-primary text-xl font-semibold">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <CardTitle className="text-2xl text-foreground">
                          {displayNameValue || "Your display name"}
                        </CardTitle>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "rounded-full px-3 py-1 text-xs font-medium",
                              handleValue
                                ? "bg-primary/10 text-primary"
                                : "bg-accent text-accent-foreground ",
                            )}
                          >
                            {handleValue ? `@${handleValue}` : "@handle"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              )}

              {/* Form card with skeleton */}
              {isLoading ? (
                <Card className="mt-6 border-border/70 bg-card shadow-sm">
                  <CardHeader>
                    <div className="skeleton h-6 w-28" />
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="space-y-2">
                          <div className="skeleton h-4 w-24" />
                          <div className="skeleton h-10 w-full" />
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2">
                      <div className="skeleton h-4 w-20" />
                      <div className="skeleton h-10 w-full" />
                    </div>
                    <div className="skeleton h-10 w-36" />
                  </CardContent>
                </Card>
              ) : (
                <Card className="mt-6 border-border/70 bg-card shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg text-foreground">
                      Edit Profile
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form 
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-6 ">
                      <div className="grid gap-6 md:grid-cols-2">
                        <div className="space-y-2">
                          <label
                            htmlFor="displayName"
                            className="block text-sm font-medium leading-6 text-foreground"
                          >
                            Display Name
                          </label>
                          <Input
                            id="displayName"
                            placeholder={displayNameValue || "Your display name"}
                            {...form.register("displayName")}
                            disabled={isLoading || isSaving}
                            className="border-border bg-background/60 text-sm mt-2"
                          />
                          {/*Implement eror state->  */}
                        </div>
                        <div className="space-y-2">
                          <label
                            htmlFor="handle"
                            className="block text-sm font-medium leading-6 text-foreground"
                          >
                            Handle
                          </label>
                          <Input
                            id="handle"
                            placeholder={handleValue || "Your handle"}
                            {...form.register("handle")}
                            disabled={isLoading || isSaving}
                            className="border-border bg-background/60 text-sm mt-2"
                          />
                          {/*Implement eror state->  */}
                        </div>
                        <div className="space-y-2">
                          <label
                            htmlFor="bio"
                            className="block text-sm font-medium leading-6 text-foreground"
                          >
                            Bio
                          </label>
                          <Textarea
                            id="bio"
                            placeholder={bioValue || "Tell about yourself"}
                            {...form.register("bio")}
                            disabled={isLoading || isSaving}
                            className="border-border bg-background/60 text-sm mt-2"
                            rows={4}
                          />
                          {/*Implement eror state->  */}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label
                          htmlFor="avatarUrl"
                          className="block text-sm font-medium leading-6 text-foreground"
                        >
                          Avatar URL
                        </label>
                        <Input
                          id="avatarUrl"
                          placeholder={avatarUrlValue || "Your avatar URL"}
                          {...form.register("avatarUrl")}
                          disabled={isLoading || isSaving}
                          className="border-border bg-background/60 text-sm mt-2"
                        />
                        {/*Implement eror state->  */}
                      </div>
                      <CardFooter className="p-0">
                        <Button
                        type="submit"
                        disabled={isLoading || isSaving}
                        className=" min-w-[150px] bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          {
                            isSaving ? "Saving..." : "Save Changes"
                          }
                        </Button>
                      </CardFooter>
                    </form>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center gap-6 px-4 py-20">
          <Card className="w-full border-border/70 bg-card">
            <CardContent className="py-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <User className="h-8 w-8 text-primary/60" />
              </div>
              <p className="text-lg font-semibold text-foreground">
                Sign in to view your profile
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                You need to be signed in to manage your profile settings
              </p>
              <Link href="/sign-in">
                <Button className="mt-6 bg-primary text-primary-foreground hover:bg-primary/90">
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign In
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

export default ProfilePage;
