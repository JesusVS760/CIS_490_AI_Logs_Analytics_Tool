"use client";

import { useState } from "react";
// @radix-ui/react-dialog is already installed as a dependency of the Sheet
// component, so we use it directly here instead of adding a new package.
import * as Dialog from "@radix-ui/react-dialog";
// Chart is imported to access live chart instances via ChartJS.getChart().
// chart.js is already bundled by the dashboard chart components so this
// import adds no extra weight.
import { Chart as ChartJS } from "chart.js";
import { Button } from "@/components/ui/button";
import { Download, FileText, X } from "lucide-react";

/**
 * ExportPDFButton
 *
 * Renders an "Export PDF" button that opens a guided dialog before triggering
 * the browser's print-to-PDF flow. The dialog explains the three steps the
 * user must take in the native print dialog to save the file locally.
 *
 * Canvas handling:
 * Chart.js draws into <canvas> elements, which most browsers render as blank
 * in window.print(). handleSave works around this by converting every canvas
 * inside .print-area to a static PNG <img> before printing, then restoring
 * the canvases once the print dialog closes (afterprint event).
 *
 * Print layout:
 * The .no-print class on the trigger button hides it from the PDF output.
 * The .print-area class on the dashboard section and the @media print rules
 * in globals.css control what appears on the page and how it is laid out.
 */
export default function ExportPDFButton() {
  /** Controls whether the export instructions dialog is visible. */
  const [open, setOpen] = useState(false);

  /**
   * Represents one canvas that has been replaced by a static image for
   * printing. Both references are kept so the swap can be fully reversed
   * after the print dialog closes.
   */
  type Snapshot = { canvas: HTMLCanvasElement; img: HTMLImageElement; wasResponsive: boolean };

  /**
   * handleSave
   *
   * Async replacement for the original handleSave. The key difference from the
   * original is that all canvas → img swaps happen BEFORE window.print() is
   * called, and we await every image's onload event before proceeding. This
   * eliminates the race condition where the browser captured the print layout
   * before data-URL images had finished decoding, causing charts to appear blank.
   *
   * Execution order:
   *   1. Close the dialog and wait for its exit animation to finish (150 ms).
   *   2. Query every Chart.js canvas inside .print-area.
   *   3. For each canvas: freeze responsive mode, snapshot to PNG, insert a
   *      decoded <img> in its place, and hide the canvas.
   *   4. Await Promise.all so every image is fully decoded before printing.
   *   5. Register afterprint to restore canvases once the dialog closes.
   *   6. Call window.print() — the browser sees fully-painted <img> elements
   *      instead of canvases, so all charts render correctly in the PDF.
   */
  const handleSave = async () => {
    // Close the instructions dialog first so it doesn't appear in the PDF.
    setOpen(false);

    // Wait for the dialog's close animation to complete before manipulating
    // the DOM. Without this delay the dialog overlay may still be visible
    // when the print layout is captured.
    await new Promise(resolve => setTimeout(resolve, 150));

    // Accumulates canvas ↔ img pairs so afterprint can fully reverse the swap.
    const snapshots: Snapshot[] = [];

    // Only target canvases inside .print-area so charts outside the export
    // region (e.g. hidden debug charts) are never touched.
    const canvases = Array.from(
      document.querySelectorAll<HTMLCanvasElement>(".print-area canvas")
    );

    // Build one <img> per canvas and collect a Promise for each image's load
    // event. We must await all of them before printing; if even one image is
    // still decoding when window.print() fires it will appear blank in the PDF.
    const loadPromises = canvases.map(canvas => {
      // Retrieve the Chart.js instance that owns this canvas, if any.
      // Returns undefined for non-Chart.js canvases (e.g. custom drawings).
      const chart = ChartJS.getChart(canvas);

      // Remember the original responsive setting so we can restore it later.
      const wasResponsive = chart?.options.responsive ?? true;

      if (chart) {
        // Freeze responsive mode so the print-CSS layout change (which resizes
        // the container) does not trigger Chart.js's ResizeObserver. Without
        // this, Chart.js would clear and re-draw the canvas mid-snapshot,
        // potentially producing a blank or half-rendered image.
        chart.options.responsive = false;

        // Force a synchronous re-render so the canvas reflects the latest data
        // before we snapshot it. "none" skips animations for an instant update.
        chart.update("none");
      }

      // Create the replacement <img> element that the browser will print.
      const img = document.createElement("img");

      // Scale to the full container width; height follows proportionally so
      // the chart's aspect ratio is preserved in the PDF output.
      img.style.width = "100%";
      img.style.height = "auto";
      img.style.display = "block";

      // Resolve as soon as the browser finishes decoding the data-URL image.
      // We resolve on onerror too so a single failed chart never blocks the
      // entire export — it will just appear blank for that one chart.
      const loaded = new Promise<void>(resolve => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
      });

      // chart.toBase64Image() is Chart.js's own snapshot method and accounts
      // for the internal pixel-ratio scaling that toDataURL() does not.
      // Fall back to toDataURL() for any canvases not managed by Chart.js.
      img.src = chart
        ? chart.toBase64Image()
        : canvas.toDataURL("image/png");

      // Insert the img directly before the canvas so it occupies the same
      // position in the layout, then hide the canvas from the print view.
      canvas.parentElement?.insertBefore(img, canvas);
      canvas.style.display = "none";

      // Record both elements plus the original responsive flag for teardown.
      snapshots.push({ canvas, img, wasResponsive });

      return loaded;
    });

    // Block until every replacement image has been fully decoded by the browser.
    // This is the critical guarantee that was missing in the original
    // beforeprint approach — window.print() is only called after this resolves.
    await Promise.all(loadPromises);

    /**
     * restore
     *
     * Reverses every canvas-to-img swap and re-enables responsive mode so
     * Chart.js resumes tracking container size for the live dashboard view.
     * Fires via afterprint, which runs once the print dialog closes whether
     * the user saved or cancelled. The listener removes itself afterwards so
     * it does not accumulate across multiple export sessions.
     */
    const restore = () => {
      for (const { canvas, img, wasResponsive } of snapshots) {
        // Remove the temporary img element that was inserted for printing.
        img.remove();

        // Make the original canvas visible again.
        canvas.style.display = "";

        // Re-enable responsive mode and trigger a fresh render at the current
        // screen dimensions so the live chart looks correct after printing.
        const chart = ChartJS.getChart(canvas);
        if (chart) {
          chart.options.responsive = wasResponsive;
          chart.update("none");
        }
      }

      // Clear the array so the next export session starts with a clean slate.
      snapshots.length = 0;

      // Remove the listener so it only ever runs once per export session.
      window.removeEventListener("afterprint", restore);
    };

    // Register afterprint before window.print() so it is guaranteed to fire
    // for this exact print call and not missed if the dialog opens very quickly.
    window.addEventListener("afterprint", restore);

    // Open the browser's native print dialog. At this point every canvas has
    // been replaced by a fully-decoded <img>, so all charts render correctly.
    window.print();
  };

  return (
    /**
     * Dialog.Root — manages open/close state and provides context to all
     * Dialog.* children. Controlled via the `open` state variable.
     */
    <Dialog.Root open={open} onOpenChange={setOpen}>

      {/**
       * Dialog.Trigger — wraps the button that opens the dialog.
       * `asChild` forwards the trigger behaviour onto our Button component
       * instead of rendering an extra DOM wrapper element.
       */}
      <Dialog.Trigger asChild>
        {/* no-print class hides this button in the printed/PDF output (globals.css) */}
        <Button variant="outline" size="sm" className="gap-2 no-print">
          <Download className="h-4 w-4" />
          Export PDF
        </Button>
      </Dialog.Trigger>

      {/**
       * Dialog.Portal — mounts the overlay and panel as a direct child of
       * <body> so they are not clipped by any overflow:hidden ancestor and
       * always stack above all other content via z-50.
       */}
      <Dialog.Portal>

        {/* Dimmed full-screen backdrop rendered behind the dialog panel */}
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        {/* Centered dialog panel — translate(-50%,-50%) from the viewport midpoint */}
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl bg-background p-6 shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">

          {/* Header: icon + title/description on the left, close (×) on the right */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                {/**
                 * Dialog.Title and Dialog.Description are required by Radix UI
                 * for accessibility. Screen readers announce them when the
                 * dialog receives focus.
                 */}
                <Dialog.Title className="text-base font-semibold leading-tight">
                  Export as PDF
                </Dialog.Title>
                <Dialog.Description className="text-sm text-muted-foreground">
                  Save the analytics report to your device.
                </Dialog.Description>
              </div>
            </div>

            {/* Icon-only close button — dismisses without printing */}
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" className="-mr-1 -mt-1 h-7 w-7">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>

          {/**
           * Step-by-step instructions.
           * window.print() opens the browser's native print dialog; the user
           * must manually set the destination to "Save as PDF" to download the
           * file. These steps guide them through that process.
           */}
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

          {/* Footer: Cancel closes the dialog; Save as PDF triggers handleSave */}
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