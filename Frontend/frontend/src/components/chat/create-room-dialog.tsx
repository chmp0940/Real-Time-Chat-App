"use client";
import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { X } from "lucide-react";

type CreateRoomDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (room: { id: number; name: string }) => void;
  apiClient: any;
};

function CreateRoomDialog({ open, onClose, onCreated, apiClient }: CreateRoomDialogProps) {
  const [name, setName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  if (!open) return null;

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length < 2) return;

    setIsCreating(true);
    try {
      const res = await apiClient.post("/api/group-chat/rooms", { name: trimmed });
      const room = res?.data?.data;
      onCreated({ id: room.id, name: room.name });
      setName("");
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 mx-4 w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-2xl page-enter">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
        <h3 className="text-lg font-semibold text-foreground">Create Group Room</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Give your room a name. Anyone can join it.
        </p>
        <div className="mt-4 space-y-4">
          <Input
            placeholder="Room name..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleCreate();
            }}
            className="border-border bg-background/60 text-sm"
            autoFocus
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" size="sm" onClick={onClose} className="border-border">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={isCreating || name.trim().length < 2}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isCreating ? "Creating..." : "Create Room"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CreateRoomDialog;
