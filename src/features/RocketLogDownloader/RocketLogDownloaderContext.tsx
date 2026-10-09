import { createContext, useContext, useSyncExternalStore } from "react";
import { RocketLogDownloader } from "./RocketLogDownloader";

const RocketLogDownloaderContext = createContext<RocketLogDownloader | null>(null);

export function RocketLogDownloaderProvider({ downloader, children }: {
    downloader: RocketLogDownloader;
    children: React.ReactNode;
}) {
    return <RocketLogDownloaderContext.Provider value={downloader}>{children}</RocketLogDownloaderContext.Provider>;
}

export function useRocketLogDownloader() {
    const downloader = useContext(RocketLogDownloaderContext);
    if (!downloader) throw new Error("useRocketLogDownloader must be used within a RocketLogDownloaderProvider");
    return downloader;
}

export function useLogDownloadProgress() {
    const downloader = useRocketLogDownloader();
    return useSyncExternalStore(downloader.subscribe, downloader.getProgress, downloader.getProgress);
}