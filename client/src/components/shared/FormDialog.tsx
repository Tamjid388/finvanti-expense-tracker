import * as React from "react";
import { cn } from "cn";
import { Dialog as DialogPrimitive } from "radix-ui";

export interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}

/**
 * Shared controlled modal shell for create/edit forms (mobile-first).
 * Wraps radix `Dialog` with the same overlay/content/title tokens as
 * `src/components/ui/alert-dialog.tsx`. Focus is moved into the dialog on
 * open and returned to the trigger on close; Esc and overlay click close by
 * default (PRD §10). Callers render their own form + Cancel/Submit actions
 * as `children`.
 */
export function FormDialog({ open, onOpenChange, title, description, children }: FormDialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal data-slot="form-dialog-portal">
        <DialogPrimitive.Overlay
          data-slot="form-dialog-overlay"
          className={cn(
            "fixed inset-0 z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
          )}
        />
        <DialogPrimitive.Content
          data-slot="form-dialog-content"
          className={cn(
            "fixed top-1/2 left-1/2 z-50 grid max-h-[85vh] w-full max-w-xs -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-xl bg-popover p-4 text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
          )}
        >
          <div
            data-slot="form-dialog-header"
            className={cn("grid gap-1.5 text-left")}
          >
            <DialogPrimitive.Title
              data-slot="form-dialog-title"
              className={cn("font-heading text-base font-medium")}
            >
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description
                data-slot="form-dialog-description"
                className={cn(
                  "text-sm text-balance text-muted-foreground md:text-pretty *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground"
                )}
              >
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
