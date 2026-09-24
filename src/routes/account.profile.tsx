import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getAccountOverview, updateMyProfile } from "@/lib/membership.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorBlock, LoadingBlock, Section, SectionHeading } from "@/components/site/Bits";

export const Route = createFileRoute("/account/profile")({
  component: AccountProfilePage,
});

type FormState = {
  first_name: string;
  last_name: string;
  phone: string;
  company: string;
  job_title: string;
  country: string;
};

const empty: FormState = {
  first_name: "",
  last_name: "",
  phone: "",
  company: "",
  job_title: "",
  country: "",
};

function AccountProfilePage() {
  const queryClient = useQueryClient();
  const fetchOverview = useServerFn(getAccountOverview);
  const saveProfile = useServerFn(updateMyProfile);
  const { data, isLoading, error } = useQuery({
    queryKey: ["account"],
    queryFn: () => fetchOverview(),
  });
  const [form, setForm] = useState<FormState>(empty);

  useEffect(() => {
    if (data) {
      setForm({
        first_name: data.profile.firstName ?? "",
        last_name: data.profile.lastName ?? "",
        phone: data.profile.phone ?? "",
        company: data.profile.company ?? "",
        job_title: data.profile.jobTitle ?? "",
        country: data.profile.country ?? "",
      });
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: () =>
      saveProfile({
        data: Object.fromEntries(
          Object.entries(form).map(([key, value]) => [key, value.trim() === "" ? null : value.trim()]),
        ) as never,
      }),
    onSuccess: () => {
      toast.success("Profile saved");
      queryClient.invalidateQueries({ queryKey: ["account"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function field(key: keyof FormState) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((prev) => ({ ...prev, [key]: e.target.value })),
    };
  }

  return (
    <Section>
      <SectionHeading eyebrow="Account" title="Profile" />
      {isLoading && <LoadingBlock label="Loading profile" />}
      {error && <ErrorBlock error={error} />}
      {data && (
        <form
          className="max-w-2xl space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="first_name">First name</Label>
              <Input id="first_name" {...field("first_name")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Last name</Label>
              <Input id="last_name" {...field("last_name")} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={data.profile.email ?? ""} disabled />
            <p className="text-xs text-muted-foreground">
              Your email is managed by your login and cannot be changed here.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input id="company" {...field("company")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="job_title">Job title</Label>
              <Input id="job_title" {...field("job_title")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" {...field("phone")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input id="country" {...field("country")} />
            </div>
          </div>
          <Button type="submit" variant="ink" size="lg" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Save profile"}
          </Button>
        </form>
      )}
    </Section>
  );
}
