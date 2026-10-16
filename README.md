# Tauri + React + Typescript

## Flight profile radio contract

The flight form sends only `flightName`, `initialRotation`, `PDKp`, `PDKd`,
`motorIgniterChannel`, and `parachutePyroChannel`. Initial X/Y/Z angles are entered
in degrees and converted to an XYZ quaternion before sending. Names must be
non-blank, contain no NUL, and fit in 32 UTF-8 bytes (at most 32 characters;
multibyte characters consume more than one byte).

`START_COUNTDOWN` retains message ID `0x16`, but uses this **new, incompatible**
payload layout. Let `N` be the UTF-8 name length and `B = 1 + N`:

| Byte offset | Encoding | Field |
| --- | --- | --- |
| 0 | uint8 | Name byte length, 1–32 |
| 1 | N UTF-8 bytes, no terminator | Flight name |
| B | 4 × little-endian int32, scaled by 100 | Initial quaternion x/y/z/w |
| B + 16 | little-endian int32, scaled by 100 | Kp |
| B + 20 | little-endian int32, scaled by 100 | Kd |
| B + 24 | uint8 | Motor igniter channel |
| B + 25 | uint8 | Parachute pyro channel |

Total payload length is `27 + N` bytes (28–59). Countdown/burn durations, target
attitude, and initial height are no longer sent, including as hidden defaults.
The commander forwards the typed profile unchanged; the radio boundary validates
it before encoding. Existing pyro arming and two-click launch confirmation remain.

**Firmware coordination required:** rocket firmware is not included in this
repository. Its `START_COUNTDOWN` handler must adopt this layout and provide its
own behavior for the removed fields before using this monitor to launch. Do not
use this payload with a handler expecting the previous 54-byte profile.

This template should help get you started developing with Tauri, React and Typescript in Vite.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
