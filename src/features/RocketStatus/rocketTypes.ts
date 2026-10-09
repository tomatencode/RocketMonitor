import type { Quaternion } from "./quaternion";
export type { Quaternion, EulerXYZ } from "./quaternion";
export { normalizeQuaternion, quaternionToEulerXYZ, eulerXYZToQuaternion } from "./quaternion";

export interface IMUData {
    accelX_m_s2: number;
    accelY_m_s2: number;
    accelZ_m_s2: number;
    gyroX_rad_s: number;
    gyroY_rad_s: number;
    gyroZ_rad_s: number;
}

export interface BaroData {
    pressure_Pa: number;
    temperature_C: number;
}

/** Live attitude — a quaternion (x, y, z, w). */
export type RotationData = Quaternion;

export interface GimbalData {
    degX_deg: number;
    degY_deg: number;
}

export interface FlightLocationData {
    posX_m: number;
    posY_m: number;
    velX_m_s: number;
    velY_m_s: number;
    height_m: number;
    verticalVelocity_m_s: number;
}

/** Mirrors the firmware's FlightState enum (stateManagement/FlightStateManager.hpp). */
export enum FlightState {
    IDLE = 0,
    COUNTDOWN = 1,
    BURNING = 2,
    COASTING = 3,
    DESCENDING = 4,
    LANDED = 5,
    ABORTED = 6,
}

export interface FlightProfile {
    countdownDuration_ms: number;
    motorBurnDuration_ms: number;
    initialRotation: Quaternion;
    targetAngle: Quaternion;
    pidKp: number;
    pidKi: number;
    pidKd: number;
    motorIgniterChannel: number;
    parachutePyroChannel: number;
    initialHeight_m: number;
}

/** Mirrors the firmware's ControlPID::PIDParameters (controlPID/ControlPID.hpp). */
export interface PIDParameters {
    kp: number;
    ki: number;
    kd: number;
}

/** Metadata recorded in the firmware log header; timestamp is UNIX seconds. */
export interface LogMetadata {
    timestamp_unix: number;
    initialRotation: Quaternion;
    targetAngle: Quaternion;
    pidKp: number;
    pidKi: number;
    pidKd: number;
    initialHeight_m: number;
}

export interface LogListPage {
    totalFiles: number;
    /** Equal to totalFiles when there are no more pages. */
    nextIndex: number;
    filenames: string[];
}

export interface LogInfo {
    /** Verified payload size, excluding flash framing. Only closed/recovered files are readable. */
    sizeBytes: number;
    maxChunkBytes: number;
}

export interface LogBytes {
    offset: number;
    /** May be shorter than requested near EOF; empty at EOF. */
    bytes: Uint8Array;
}

/** Parameterized reads are on-demand, not recurring telemetry topics. */
export interface RocketLogReader {
    listLogs: (startIndex?: number) => Promise<LogListPage>;
    getLogInfo: (filename: string) => Promise<LogInfo>;
    getLogBytes: (filename: string, offset: number, length: number) => Promise<LogBytes>;
}

/** Read contract implemented by any rocket data source. */
export interface RocketGetters {
    getGimbal: () => Promise<GimbalData>;
    getPyroContinuity: (channel: number) => Promise<boolean>;
    getPyroSoftwareArmed: () => Promise<boolean>;
    getPyroHardwareArmed: () => Promise<boolean>;
    getIMU: () => Promise<IMUData>;
    getBaro: () => Promise<BaroData>;
    getRotation: () => Promise<RotationData>;
    getBaroHeight: () => Promise<number>;
    getFlightLocation: () => Promise<FlightLocationData>;
    getFlightState: () => Promise<FlightState>;
    getCountdownTime: () => Promise<number | null>;
    getPIDParameters: () => Promise<PIDParameters | null>;
    getControlling: () => Promise<boolean>;
    getPIDTarget: () => Promise<Quaternion | null>;
    getBatteryVoltage: () => Promise<number>;
    getLogging: () => Promise<boolean>;
}

/** Mutation contract implemented by any rocket transport. */
export interface RocketCommands {
    setGimbalPos: (degX: number, degY: number) => Promise<void>;
    beepBuzzer: () => Promise<void>;
    firePyroChanel: (channel: number, durationMs?: number) => Promise<void>;
    setPyroSoftwareArmed: (armed: boolean) => Promise<void>;
    setRotation: (quaternion: Quaternion) => Promise<void>;
    setAccumulatingRotation: (accumulating: boolean) => Promise<void>;
    abortFlight: () => Promise<void>;
    endFlight: () => Promise<void>;
    calibrateBaroHeight: (height_m: number) => Promise<void>;
    flashLed: (durationMs?: number) => Promise<void>;
    startCountdown: (profile: FlightProfile) => Promise<void>;
    retryDeployParachute: () => Promise<void>;
    setPIDParameters: (kp: number, ki: number, kd: number) => Promise<void>;
    setControlling: (controlling: boolean) => Promise<void>;
    setPIDTarget: (target: Quaternion) => Promise<void>;
    startLog: (filename: string, metadata: LogMetadata) => Promise<void>;
    finishLog: () => Promise<void>;
}
