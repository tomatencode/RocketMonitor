# Rocket application API

Application features read `useRocketStatus(topic)`, check `useRocketConnected()`,
and invoke mutations through `useRocketCommander()`. They do not import the radio
transport. `rocketTypes.ts` and `quaternion.ts` contain transport-independent
contracts, values, and attitude helpers.

`RadioRocketProvider` is the adapter installed by the app. A simulator or another
transport can instead construct `RocketStatusStore` and `RocketCommander`, and
provide them with `RocketStatusProvider` and `RocketCommanderProvider`.

## Topics

- Demand-driven telemetry: `imu`, `baro`, `rotation`, `gimbal`, `baroHeight`,
  `flightLocation`, `flightState`, `countdownTime`, `batteryVoltage`.
- Physical inputs: `pyroHardwareArmed` and `pyroContinuity:<channel>` poll every
  1500 ms while subscribed. `useRocketPyroContinuity(channels)` supports variable
  channel lists with a shared poller per channel.
- Configuration: `pidParameters`, `pidTarget`, `controlling`, and
  `pyroSoftwareArmed` are read once successfully per connection session, on demand.
  This assumes only this app changes them, not autonomous firmware or other clients.

- `logging` is likewise session-cached and refreshed by `startLog`/`finishLog`.

## Firmware log access

`useRocketCommander()` exposes `startLog(filename, metadata)` and `finishLog()`;
`useRocketStatus("logging")` reports whether a firmware log is currently open.
Metadata includes a UNIX timestamp in **seconds**, initial/target quaternions,
PID gains, and initial height. Filenames use 1..32 UTF-8 bytes, without NUL.

On-demand reads are also available on commander so callers need no radio imports:

- `listLogs(startIndex = 0)` returns `{ totalFiles, nextIndex, filenames }`.
  Continue from `nextIndex` until it equals `totalFiles`. Only completed/recovered
  files are listed; the open log is excluded.
- `getLogInfo(filename)` returns `{ sizeBytes, maxChunkBytes }` after firmware
  verifies the file. Unknown, open, or corrupt files reject the operation.
- `getLogBytes(filename, offset, length)` returns `{ offset, bytes }`. Request
  sequential chunks of 1..`maxChunkBytes` (currently at most 240), with **one
  outstanding chunk request**. Near EOF, the returned bytes may be shorter;
  at EOF they are empty. These are raw log payload bytes, without flash framing.

RadioLink also exposes the firmware-named `isLogging()` and its status-compatible
alias `getLogging()`. Log contents are not decoded into events by this API, and
this update does not add a log-management UI or automatically start recording.
Firmware restricts start/finish and file info/byte reads to ground operation;
logging-state and file-list queries are also allowed during flight. Refused
operations reject their promises rather than appearing successful.

## Status lifecycle

All subscribers share reads. Cached configuration survives component unmounts.
Disconnects clear snapshots, stop polling, and invalidate old responses; reconnects
read subscribed topics again. Failed reads retry with a 250 ms backoff.

Snapshots include `value`, `error`, `hasValue`, and `lastUpdatedAt`. `hasValue`
distinguishes a valid null (unconfigured PID or inactive countdown) from an unread
topic. Ordinary polling failures retain the last good reading and expose the error.

## Commands

Commander forwards all setters/actions and refreshes affected topics after successful
acknowledgment, even without subscribers. A readback uses the firmware's value,
not the command arguments, so quantization is reflected accurately. Configuration
has no recurring polling after successful readback. Flight commands also invalidate
related configuration conservatively.

Refresh clears affected snapshots until confirmed and prevents older in-flight reads
from overwriting them. A readback failure is a **status error**, not a command failure:
do not retry a successful fire/launch action just because its readback failed.
Mutations are not globally queued, so aborts are not blocked by unrelated commands.
As before, firmware owns safety interlocks and the transport owns delivery/retries.
A lost acknowledgment can mean an unknown command outcome. A device reset that
does not produce an observed disconnect cannot be detected by this cache alone.

## Validation

Run `npm test` from the repository root (Node >=22.15 required by the built-in
module hooks used to load TypeScript), and `npm run build`. Tests use Node's built-in
test runner and the existing TypeScript dependency; no test library was added.