import { UAParser } from "ua-parser-js";
import { createFileRoute } from "@tanstack/react-router";
import { Button, Link, Stack, Typography } from "@mui/material";
import downloadWindowsURL from "#media/download_windows.png";
import downloadMacURL from "#media/download_mac.png";
import downloadLinuxURL from "#media/download_linux.png";
import type { FC } from "react";

export const Route = createFileRoute("/downloads")({
    component: RouteComponent,
});

const getOS = (): "Linux" | "Windows" | "Mac OS" | "Unknown" => {
    const a = UAParser(navigator.userAgent);
    // Based on https://github.com/faisalman/ua-parser-js/blob/b9a710978e88ff1d5480886c2552efaccdad78ae/src/enums/ua-parser-enums.js
    switch (a.os.name?.toLowerCase()) {
        case "linux":
        case "arch":
        case "debian":
        case "fedora":
        case "gentoo":
        case "gnu":
        case "kubuntu":
        case "manjaro":
        case "raspbian":
        case "ubuntu":
        case "xubuntu":
            return "Linux";
        case "windows":
            return "Windows";
        case "macos":
            return "Mac OS";
        default:
            return "Unknown";
    }
};

function RouteComponent() {
    const os = getOS();
    return (
        <Stack gap={1} alignItems="center">
            <meta
                name="description"
                content="Download Prism Overlay - a statistics overlay for Hypixel BedWars. Prism Overlay is a free and open-source overlay that provides real-time statistics when playing bedwars, and automatically tracks your stats."
            />
            <link rel="canonical" href="https://prismoverlay.com/downloads" />
        </Stack>
    );
}

const latestWindowsLink = "/downloads/prism/prism-v1.9.0-windows.exe";

const windowsdownloads = [
    {
        name: "Windows",
        releasedAt: "2023-10-01",
        link: latestWindowsLink,
    },
];

const DownloadWindows = (latestWindowsLink: string) => {
    <a href={latestWindowsLink} download>
        <img src={downloadWindowsURL} alt="Prism Overlay logo" />
    </a>;
};
