import { useEffect, useMemo } from "react";
import html2canvasModule from "html2canvas";

// Work around module resolution issues
const html2canvas = html2canvasModule as unknown as (
    element: HTMLElement,
    options?: {
        backgroundColor?: string;
        scale?: number;
        useCORS?: boolean;
        allowTaint?: boolean;
        removeContainer?: boolean;
    },
) => Promise<HTMLCanvasElement>;

export function useOffscreenContainer() {
    const el = useMemo(() => document.createElement("div"), []);
    useEffect(() => {
        el.setAttribute("data-export-root", "true");

        // Key detail: NOT display:none. Keep it offscreen and non-interactive.
        Object.assign(el.style, {
            position: "fixed",
            left: "-10000px",
            top: "0",
            width: "0",
            height: "0",
            overflow: "hidden",
            pointerEvents: "none",
            opacity: "0",
            zIndex: "-1",
        });

        document.body.appendChild(el);
        return () => {
            document.body.removeChild(el);
        };
    }, [el]);

    return el;
}

export async function waitForImages(root: HTMLElement) {
    const imgs = Array.from(root.querySelectorAll("img"));
    await Promise.all(
        imgs.map(async (img) => {
            // If already loaded, decode() might still help for rendering correctness.
            if (img.complete && img.naturalWidth > 0) return;
            await new Promise<void>((resolve, reject) => {
                img.onload = () => {
                    resolve();
                };
                img.onerror = () => {
                    reject(new Error(`Image failed to load: ${img.src}`));
                };
            });
        }),
    );

    // Decode step helps avoid capturing before rasterization completes in some browsers.
    // Image.decode is a standard method and should be available in modern browsers
    await Promise.allSettled(imgs.map((img) => img.decode()));
}

export async function waitForFonts() {
    // Supported in modern browsers; harmless to skip if unavailable.
    // Document.fonts is a standard API in modern browsers
    await document.fonts.ready;
}

export function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 100);
}

export async function captureAndDownload(
    node: HTMLElement,
    filename: string,
): Promise<void> {
    await waitForFonts();
    await waitForImages(node);

    const canvas = await html2canvas(node, {
        backgroundColor: "#ffffff",
        scale: window.devicePixelRatio,
        useCORS: true,
        allowTaint: false,
        removeContainer: true,
    });

    const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/png");
    });
    if (!blob) throw new Error("Failed to create PNG blob");
    downloadBlob(blob, filename);
}
