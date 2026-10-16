import type { FlightProfile } from "./rocketTypes";

export const MAX_FLIGHT_NAME_LENGTH = 32;

/** Shared by the form and radio boundary so invalid values never wrap on the wire. */
export function validateFlightProfile(profile: FlightProfile): void {
    if (typeof profile.flightName !== "string" || !profile.flightName.trim()
        || profile.flightName.length > MAX_FLIGHT_NAME_LENGTH
        || new TextEncoder().encode(profile.flightName).length > MAX_FLIGHT_NAME_LENGTH
        || profile.flightName.includes("\0")) {
        throw new Error("Flight name must contain 1–32 UTF-8 bytes and no NUL characters (maximum 32 characters).");
    }
    for (const channel of [profile.motorIgniterChannel, profile.parachutePyroChannel]) {
        if (!Number.isInteger(channel) || channel < 0 || channel > 255) {
            throw new Error("Pyro channels must be whole numbers from 0 to 255.");
        }
    }
    const components = profile.initialRotation
        ? [profile.initialRotation.x, profile.initialRotation.y, profile.initialRotation.z, profile.initialRotation.w]
        : [];
    if (components.length !== 4 || components.some(value => !Number.isFinite(value))
        || Math.hypot(...components) === 0) {
        throw new Error("Initial rotation must be a finite, non-zero quaternion.");
    }
    for (const value of [profile.PDKp, profile.PDKd, ...components]) {
        const scaled = Math.trunc(value * 100);
        if (!Number.isFinite(value) || scaled < -0x80000000 || scaled > 0x7fffffff) {
            throw new Error("PD gains and rotation must fit signed 32-bit fixed-point values.");
        }
    }
}