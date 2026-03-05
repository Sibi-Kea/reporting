"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function GenerateRemindersButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  return (
    <Button
      variant="outline"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        const response = await fetch("/api/notifications/generate", {
          method: "POST",
        });
        setLoading(false);
        if (!response.ok) {
          toast.error("Could not generate reminders");
          return;
        }
        const payload = (await response.json()) as { created: number };
        toast.success(`${payload.created} notification(s) generated`);
        router.refresh();
      }}
    >
      {loading ? "Generating..." : "Generate reminders"}
    </Button>
  );
}

