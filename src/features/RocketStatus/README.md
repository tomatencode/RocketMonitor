# Rocket application API

Application features read `useRocketStatus(topic)`, check `useRocketConnected()`,
and invoke mutations through `useRocketCommander()`. They do not import the radio
transport. `rocketTypes.ts` and `quaternion.ts` contain transport-independent
contracts, values, and attitude helpers.

`RadioRocketProvider` is the adapter installed by the app. A simulator or another
transport can instead construct `RocketStatusStore`, `RocketCommander`, and
`RocketLogDownloader`, and provide them with their corresponding providers.

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
- `getLogSize(filename)` returns the verified payload size in bytes via
  `GET_LOG_SIZE` (0x24), whose response is exactly four little-endian bytes.
  Unknown, open, or corrupt files reject the operation.

The old `getLogInfo`/`getLogBytes` APIs and message 0x25 are removed, matching
the current firmware. Full-file transfers use the session protocol below, through
the downloader rather than Commander. Log payloads have no flash framing.

RadioLink also exposes the firmware-named `isLogging()` and its status-compatible
alias `getLogging()`. Log contents are not decoded into events by this API.
The test screen's Rocket Logs panel provides recording controls and file downloads.
Recording is started only by the user, never automatically.
Firmware restricts start/finish, file-size queries and download sessions to ground operation;
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

`RocketLogDownloader` owns transfers separately from Commander and the panel.
`useRocketLogDownloader()` exposes:

- `startDownload(filename): Promise<Uint8Array>` starts one exclusive transfer and
  resolves with verified raw bytes. Concurrent starts reject rather than queueing.
- `stopDownload(): void` requests cancellation; safe when idle or already stopping.
- `isRunning(): boolean` stays true until outstanding requests have drained.
- `getProgress()` returns a stable snapshot containing `filename`, `running`,
  `received`, `total`, `state`, and `error`. States are `idle`, `downloading`,
  `stopping`, `completed`, `cancelled`, and `failed`; byte totals are unknown (zero)
  until START responds. Completed/failed/cancelled snapshots are retained until
  the next transfer. An empty file completes with zero received/total bytes.

`useLogDownloadProgress()` subscribes React consumers to those snapshots using
`useSyncExternalStore`; non-React consumers can use `subscribe(listener)`.
User cancellation rejects the start promise with `AbortError`; connection changes
may instead reject with a connection-change error. Failures also reject and are
reflected in the snapshot. Firmware remains responsible for ground-state checks.

### Firmware session wire format

`RocketLogDownloadTransport` is implemented by the radio command wrappers.
All integers below are unsigned little-endian:

| Message | Request | Success response |
| --- | --- | --- |
| `START_LOG_DOWNLOAD` (0x28) | StringCodec filename + u32 client token | u32 session ID + u32 size + u16 chunk bytes + u32 chunk count (14 bytes) |
| `GET_LOG_CHUNK` (0x29) | u32 session ID + u32 zero-based chunk index | u32 session ID + u32 index + raw bytes |
| `STOP_LOG_DOWNLOAD` (0x2A) | u32 session ID | Empty |

The service generates a new client token per start; transport retries resend the
same request/token, allowing firmware to return the same active session. Session
IDs must be nonzero. Chunk count must equal `ceil(size / chunkBytes)`, with chunk
bytes in 1..240. Each response must match its requested session/index and exact
expected length (only the last chunk can be shorter). Empty files have zero chunks
but still require STOP. Firmware remains active after EOF for retry safety.

After all pending chunks settle, the service sends STOP on success, failure, and
user cancellation, including a late START response received after cancellation.
Both local leases remain held until STOP settles. A disconnected/changed connection
skips STOP rather than sending an old session ID to a new connection. Firmware
expires idle sessions after 60 seconds; STOP is ground-only and may be refused if
the rocket enters flight. Cleanup errors are displayed and local leases are still
released. A STOP failure after otherwise successful transfer rejects the download,
so the panel does not silently report a successful save with a stuck remote session.
If START times out before a session ID is received, its remote outcome is unknown;
the service cannot safely send STOP without the ID, and a new start may be refused
until the firmware session expires. There is no automatic fallback to the old protocol.

The service pauses all status polls (without clearing the last readings), stops
idle radio pings, rejects unrelated commander requests, and waits for previously
started requests to settle before downloading. Commander only uses the minimal
`LogDownloadControl` interlock and exposes `waitForIdle()` for draining its existing
operations; no transfer protocol lives in Commander. The radio adapter wires the
session transport, traffic lease, status store, and command-drain callback into the service.
Leases are released in `finally` on success, error, cancellation, or disconnect.
The service lives at provider level: panel unmounts do not cancel a transfer, and
the initiating handler still saves successfully received bytes locally. Disconnect,
provider teardown, and Abort Flight request cancellation. Local file saving happens
after radio exclusivity is released and is not part of download progress/lifetime.

The service's `downloadLog` protocol helper issues each batch synchronously so the transport combines requests
in one frame. Responses are assembled at offsets derived from verified chunk indices, even if they arrive
out of order. Batch size respects 16 messages and the firmware's 1024-byte full
response-frame limit: four 240-byte chunks produce a 1014-byte response frame
(`6 + 4 * (4 + 8 + 240)`). Requests are 12 bytes each, including their message headers.
Smaller chunk sizes allow more messages. The next batch starts only after all
responses settle, including failures/retries; cancellation also drains the current
batch rather than leaving radio requests running behind resumed polling.

START, chunk, and file-size requests use a 5-second timeout for flash verification
and nearly 1 KB batched responses, which exceed one second at 9600 baud before
turnaround. Other requests retain their existing timeout. Abort Flight is an intentional emergency exception:
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