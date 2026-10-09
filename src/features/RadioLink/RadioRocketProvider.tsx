import { useEffect, useRef } from "react";
import { useRadioLink } from "./RadioLinkContext";
import { RocketStatusProvider } from "../RocketStatus/RocketStatusContext";
import { RocketStatusStore, type TopicPollers } from "../RocketStatus/RocketStatusStore";
import { RocketCommander } from "../RocketCommander/RocketCommander";
import { RocketCommanderProvider } from "../RocketCommander/RocketCommanderContext";

/** The bridge between the rocket application API and the radio transport. */
export function RadioRocketProvider({ children }: { children: React.ReactNode }) {
    const radio = useRadioLink();
    const radioRef = useRef(radio);
    radioRef.current = radio;
    const services = useRef<{ store: RocketStatusStore; commander: RocketCommander } | null>(null);
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
        services.current = { store, commander: new RocketCommander(
            () => radioRef.current, store, () => radioRef.current,
            { acquireDownload: () => radioRef.current.acquireDownload() },
        ) };
    }
    const { store, commander } = services.current;
    useEffect(() => {
        store.setConnected(radio.connected);
        return () => store.suspend();
    }, [store, radio.connected]);

    return <RocketStatusProvider store={store}>
        <RocketCommanderProvider commander={commander}>{children}</RocketCommanderProvider>
    </RocketStatusProvider>;
}