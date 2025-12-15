import React, { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { domToPng } from "modern-screenshot";

/**
 * Offscreen host
 * - Must be attached to document.body
 * - Must NOT be display:none
 */
function useOffscreenHost() {
    const host = useMemo(() => document.createElement("div"), []);
    useEffect(() => {
        Object.assign(host.style, {
            position: "fixed",
            left: "-10000px",
            top: "0",
            width: "max-content",
            height: "max-content",
            opacity: "0",
            pointerEvents: "none",
            zIndex: "-1",
        });
        document.body.appendChild(host);
        return () => void document.body.removeChild(host);
    }, [host]);
    return host;
}

async function waitForImages(root: HTMLElement) {
    const imgs = Array.from(root.querySelectorAll("img"));
    await Promise.all(
        imgs.map(async (img) => {
            if (img.complete && img.naturalWidth > 0) return;
            await new Promise<void>((resolve, reject) => {
                img.onload = () => {
                    resolve();
                };
                img.onerror = () => {
                    reject(new Error(`Image failed: ${img.src}`));
                };
            });
        }),
    );
    await Promise.allSettled(imgs.map((img) => img.decode()));
}

async function waitForFonts() {
    await document.fonts.ready;
}

function downloadDataUrl(dataUrl: string, filename: string) {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    a.click();
}

export interface ExportImageAPI {
    download: () => Promise<void>;
}

interface ExportImageMountProps {
    children: React.ReactNode;
    onReady?: (api: ExportImageAPI) => void;
    filename?: string;
}

/**
 * Mount once near app root to enable image export functionality
 */
export function ExportImageMount({
    children,
    onReady,
    filename = "export.png",
}: ExportImageMountProps) {
    const host = useOffscreenHost();
    const captureRef = useRef<HTMLDivElement | null>(null);

    const download = React.useCallback(async () => {
        const node = captureRef.current;
        if (!node) return;

        // Allow React commit + layout
        await new Promise((r) => {
            requestAnimationFrame(() => {
                r(null);
            });
        });
        await new Promise((r) => {
            requestAnimationFrame(() => {
                r(null);
            });
        });

        await waitForFonts();
        await waitForImages(node);

        /**
         * modern-screenshot options:
         * - scale: controls resolution
         * - backgroundColor: null for transparent PNG
         */
        const dataUrl = await domToPng(node, {
            scale: Math.min(window.devicePixelRatio || 1, 2),
            backgroundColor: "#ffffff",
        });

        downloadDataUrl(dataUrl, filename);
    }, [filename]);

    useEffect(() => {
        if (onReady) {
            onReady({ download });
        }
    }, [onReady, download]);

    return createPortal(<div ref={captureRef}>{children}</div>, host);
}
