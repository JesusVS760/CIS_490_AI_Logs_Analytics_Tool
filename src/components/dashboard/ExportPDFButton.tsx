"use client";

import { useState } from "react";
// @radix-ui/react-dialog is already installed as a dependency of the Sheet
// component, so we use it directly here instead of adding a new package.
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Download, FileText, X } from "lucide-react";

export default function ExportPDFButton() {
  // Controls whether the export instructions dialog is visible.
  const [open, setOpen] = useState(false);

  const handleSave = () => {
    // Close the dialog first so it doesn't appear in the printed output.
    // The 150ms delay gives the close animation time to finish before the
    // browser print dialog opens.
    setOpen(false);
    setTimeout(() => window.print(), 150);
  };

  return (
    // Dialog.Root manages open/close state and provides context to children.
    <Dialog.Root open={open} onOpenChange={setOpen}>
      {/* Dialog.Trigger wraps the button that opens the dialog.
          `asChild` passes the open behaviour down to our Button instead of
          rendering a second DOM element. */}
      <Dialog.Trigger asChild>
        {/* no-print hides this button in the printed/PDF output (see globals.css) */}
        <Button variant="outline" size="sm" className="gap-2 no-print">
          <Download className="h-4 w-4" />
          Export PDF
        </Button>
      </Dialog.Trigger>

      {/* Dialog.Portal renders the overlay and content outside the normal DOM
          tree (appended to <body>) so z-index and overflow clipping don't
          interfere with the rest of the page layout. */}
      <Dialog.Portal>
        {/* Semi-transparent backdrop that sits behind the dialog panel */}
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        {/* Centered dialog panel */}
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl bg-background p-6 shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">

          {/* Header row: icon + title/description on the left, close button on the right */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                {/* Dialog.Title and Dialog.Description are required by Radix for
                    accessibility — they are announced by screen readers when the
                    dialog opens. */}
                <Dialog.Title className="text-base font-semibold leading-tight">
                  Export as PDF
                </Dialog.Title>
                <Dialog.Description className="text-sm text-muted-foreground">
                  Save the analytics report to your device.
                </Dialog.Description>
              </div>
            </div>
            {/* Icon-only close button in the top-right corner */}
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" className="-mr-1 -mt-1 h-7 w-7">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>

          {/* Step-by-step instructions for saving as PDF.
              The browser print dialog doesn't offer a direct download, so we
              guide the user to select "Save as PDF" as the destination. */}
          <ol className="mb-5 space-y-2 text-sm text-muted-foreground list-decimal list-inside">
            <li>
              Click <span className="font-medium text-foreground">Save as PDF</span> below.
            </li>
            <li>
              In the print dialog, set{" "}
              <span className="font-medium text-foreground">Destination</span> to{" "}
              <span className="font-medium text-foreground">Save as PDF</span>.
            </li>
            <li>
              Choose a folder and click{" "}
              <span className="font-medium text-foreground">Save</span>.
            </li>
          </ol>

          {/* Footer actions: Cancel dismisses without printing; Save as PDF
              closes the dialog then triggers window.print(). */}
          <div className="flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="outline" size="sm">
                Cancel
              </Button>
            </Dialog.Close>
            <Button size="sm" onClick={handleSave} className="gap-2">
              <Download className="h-4 w-4" />
              Save as PDF
            </Button>
          </div>

        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
// need to push to github