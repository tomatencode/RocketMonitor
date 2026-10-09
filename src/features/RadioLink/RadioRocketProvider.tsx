import { useEffect, useRef } from "react";
import { useRadioLink } from "./RadioLinkContext";
import { RocketStatusProvider } from "../RocketStatus/RocketStatusContext";
import { RocketStatusStore, type TopicPollers } from "../RocketStatus/RocketStatusStore";
import { RocketCommander } from "../RocketCommander/RocketCommander";
import { RocketCommanderProvider } from "../RocketCommander/RocketCommanderContext";
import { RocketLogDownloader } from "../RocketLogDownloader/RocketLogDownloader";
import { RocketLogDownloaderProvider } from "../RocketLogDownloader/RocketLogDownloaderContext";

/** The bridge between the rocket application API and the radio transport. */
export function RadioRocketProvider({ children }: { children: React.ReactNode }) {
    const radio = useRadioLink();
    const radioRef = useRef(radio);
    radioRef.current = radio;
    const services = useRef<{ store: RocketStatusStore; commander: RocketCommander; downloader: RocketLogDownloader } | null>(null);
    if (!services.current) {
        const getPollers = (): TopicPollers => {
            const r = radioRef.current;
            return {
                imu: r.getIMU, baro: r.getBaro, rotation: r.getRotation, gimbal: r.getGimbal,
                baroHeight: r.getBaroHeight, flightLocation: r.getFlightLocation,
                flightState: r.getFlightState, countdownTime: r.getCountdownTime,
                batteryVoltage: r.getBatteryVoltage, pyroContinuity: r.getPyroContinuity,
                pyroHardwareArmed: r.getPyroHardwareArmed, pyroSoftwareArmed: r.getPyroSoftwareArmed,
                pidParameters: r.getPIDParameters, pidTarget: r.getPIDTarget, controlling: r.getControlling,
                logging: r.getLogging,
            };
        };
        const store = new RocketStatusStore(getPollers);
        const downloader: RocketLogDownloader = new RocketLogDownloader(
            () => radioRef.current, store,
            { acquireDownload: () => radioRef.current.acquireDownload() },
            () => commander.waitForIdle(),
        );
        const commander: RocketCommander = new RocketCommander(
            () => radioRef.current, store, () => radioRef.current,
            downloader,
        );
        services.current = { store, commander, downloader };
    }
    const { store, commander, downloader } = services.current;
    useEffect(() => {
        store.setConnected(radio.connected);
        return () => store.suspend();
    }, [store, radio.connected]);
    useEffect(() => () => downloader.stopDownload(), [downloader]);

    return <RocketStatusProvider store={store}>
        <RocketCommanderProvider commander={commander}>
            <RocketLogDownloaderProvider downloader={downloader}>{children}</RocketLogDownloaderProvider>
        </RocketCommanderProvider>
    </RocketStatusProvider>;
}