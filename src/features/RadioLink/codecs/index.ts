/**
 * Codec helpers for the radio-link wire format, mirroring the firmware's
 * `radioLink/requestHandlers/*Codec.hpp` headers.
 *
 * - {@link ./littleEndian.ts} — raw little-endian integers
 * - {@link ./fixedPoint.ts} — scaled integers (two decimals, ×100)
 * - {@link ./floatCodec.ts} — raw IEEE-754 floats
 * - {@link ./quaternion.ts} — attitude quaternions + Euler conversions
 */

export * as littleEndian from "./littleEndian";
export * as fixedPoint from "./fixedPoint";
export * as floatCodec from "./floatCodec";
export * as quaternionCodec from "./quaternion";
