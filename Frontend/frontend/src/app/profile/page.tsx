"use client";
import { apiGet, createApiClient ,apiPatch} from "@/lib/api-client";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {Save, User} from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar ,AvatarImage} from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {toast} from "sonner"


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
              <Card className="mt-6 border-border/70 bg-card shadow-sm">
                <CardHeader>
                  <div className="flex items-start gap-6 ">
                    <Avatar className="h-20 w-20 rounded-full">
                      {avatarUrlValue && (
                        <AvatarImage
                          src={avatarUrlValue || "/placeholder.xyz"}
                          alt={displayNameValue ?? ""}
                        />
                      )}
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
                          htmlFor="displayName"
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
                          {...form.register("bio")}
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
            </div>
          </div>
        </div>
      ) : (
        <p>signed out</p>
      )}
    </>
  );
}

export default ProfilePage;
