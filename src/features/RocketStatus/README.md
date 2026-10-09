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
  chunks of 1..`maxChunkBytes` (currently at most 240). Near EOF, the returned bytes may be shorter;
  at EOF they are empty. These are raw log payload bytes, without flash framing.

RadioLink also exposes the firmware-named `isLogging()` and its status-compatible
alias `getLogging()`. Log contents are not decoded into events by this API.
The test screen's Rocket Logs panel provides recording controls and file downloads.
Recording is started only by the user, never automatically.
Firmware restricts start/finish and file info/byte reads to ground operation;
logging-state and file-list queries are also allowed during flight. Refused
operations reject their promises rather than appearing successful.

`deleteLog(filename)` and `deleteAllLogs()` are exposed through commander and
RadioLink, matching firmware `DELETE_LOG` (0x26) and `DELETE_ALL_LOGS` (0x27).
Both are ground-only. Single deletion removes a closed log entry but does not
reclaim flash space. Delete-all removes all log entries and reclaims space; it
is refused while recording and is not a secure flash wipe.

## Logging panel

The test screen lists all completed/recovered logs, with Refresh, Start/Stop Logging,
download progress and cancellation. New recordings use a timestamped filename and
current attitude, PID target/gains and barometric height as metadata; unavailable
values use identity attitude/zero gains/zero height (target defaults to current attitude).
Downloads concatenate batched raw chunks and save into the OS Downloads directory
through the Tauri `save_rocket_log` command, with a `.rcktlog` suffix. No bytes or
headers are added. Existing downloads are never overwritten: a numbered suffix is
used on collision. The displayed path confirms a completed save. Canceling a transfer
does not save a partial file; saving itself is not cancelable once dispatched.

Each file row also has a Delete button; Delete All Logs is available only when
recording is confirmed stopped. Both require explicit confirmation naming the
affected rocket logs. The Delete button changes to a yellow "Confirm?" on the first
press; press the same button again within five seconds to delete. Selecting another
log requires its own second press. Pending confirmations reset on reconnect, recording/ground
state changes, refresh, or another operation. Deletion cannot run alongside a
download or other panel mutation. After success the list refreshes; failures are
shown without optimistically removing files. Local `.rcktlog` downloads are never
deleted by these commands.

## Exclusive, batched downloads

The panel runs its transfer inside `commander.withLogDownload(reader => ..., signal)`.
This pauses all status polls (without clearing the last readings), stops idle radio
pings, rejects unrelated commander requests, and waits for previously started
requests to settle before downloading. The callback receives a scoped reader for
log info/bytes; normal commander read APIs remain blocked. Leases are released in
`finally` on success, error, cancellation, or disconnect; expired scoped readers
cannot be reused. File saving happens after radio exclusivity is released.

`downloadLog` issues each batch synchronously so the transport combines requests
in one frame. Responses are assembled at their verified offsets, even if they arrive
out of order. Batch size respects 16 messages and the firmware's 1024-byte full
response-frame limit: four 240-byte chunks produce a 998-byte response frame.
Smaller chunk sizes allow more messages. The next batch starts only after all
responses settle, including failures/retries; cancellation also drains the current
batch rather than leaving radio requests running behind resumed polling.

Log-byte requests use a 5-second timeout, since a nearly 1 KB response exceeds
one second at 9600 baud before turnaround and flash verification. All other requests
retain their existing timeout. Abort Flight is an intentional emergency exception:
it cancels the download and remains sendable immediately. Telemetry is stale while
paused, and downloads should only be initiated on the ground. Hardware throughput
and timing should be measured before further tuning chunk size/timeouts.

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