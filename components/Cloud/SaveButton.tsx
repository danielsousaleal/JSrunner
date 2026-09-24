"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hasAccountSession } from "@/lib/account-client";
import { cloudLinkFor, cloudSnapshot, pushCloud, saveCurrentToCloud } from "@/lib/cloud-sync";
import { useAppStore } from "@/lib/store";

export function SaveButton() {
  const workspace = useAppStore((state) => state.workspace);
  const save = useAppStore((state) => state.save);
  const [label, setLabel] = useState("Save");
  const [detail, setDetail] = useState("Save in this browser");

  const onSave = async () => {
    if (!workspace || label === "Saving") return;
    setLabel("Saving");
    setDetail("Saving");
    try {
      await save();
      if (hasAccountSession()) {
        const linked = cloudLinkFor(workspace.id);
        if (linked) {
          const synced = await pushCloud();
          if (!synced) throw new Error(cloudSnapshot().message || "Sync error");
        } else {
          await saveCurrentToCloud();
        }
        setDetail("Saved to cloud");
      } else {
        setDetail("Saved in this browser");
      }
      setLabel("Saved");
      window.setTimeout(() => setLabel("Save"), 1600);
    } catch (caught) {
      setLabel("Save");
      setDetail(caught instanceof Error ? caught.message : "Could not save");
    }
  };

  return (
    <Button
      variant="ghost"
      size="xs"
      className="px-2 text-[11px]"
      aria-label={detail}
      title={detail}
      disabled={!workspace || label === "Saving"}
      onClick={() => void onSave()}
    >
      <Save className="size-3.5" />
      {label}
    </Button>
  );
}
