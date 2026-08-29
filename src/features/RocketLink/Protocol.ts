// Enum values must match the C++ protocol.hpp definition
export enum PacketType {
    PING=0x01,                             PONG=0x02,
    SEND_RADIO_REQ=0x10,         SEND_RADIO_ACK=0x11,
    RECEIVE_RADIO_REQ=0x12,  RECEIVE_RADIO_RESP=0x13,
    AT_CMD=0x20,                        AT_RESP=0x21
}

export interface Packet {
    type: PacketType;
    payload: Uint8Array;
}

const enum ParserState { SOF, TYPE, LEN, PAYLOAD, CHECKSUM }

export interface Parser {
    state: ParserState;
    cursor: number;
    ready: boolean;
    pending: Packet;
    pendingPayloadLen: number;
}

const SOF_BYTE = 0xAA;
const MAX_PAYLOAD = 255;

const VALID_TYPES = new Set<number>([
    PacketType.PING, PacketType.PONG, PacketType.SEND_RADIO_REQ, PacketType.SEND_RADIO_ACK,
    PacketType.RECEIVE_RADIO_REQ, PacketType.RECEIVE_RADIO_RESP, PacketType.AT_CMD, PacketType.AT_RESP,
]);

function crc8(packet: Packet): number {
    let crc = packet.type ^ packet.payload.length;
    for (let i = 0; i < packet.payload.length; i++) crc ^= packet.payload[i];
    return crc & 0xFF;
}

export function createParser(): Parser {
    return {
        state: ParserState.SOF,
        cursor: 0,
        ready: false,
        pending: { type: PacketType.PING, payload: new Uint8Array(MAX_PAYLOAD) },
        pendingPayloadLen: 0,
    };
}

export function feed(parser: Parser, byte: number): void {
    switch (parser.state) {
        case ParserState.SOF:
            if (byte === SOF_BYTE) {
                parser.state = ParserState.TYPE;
                parser.cursor = 0;
                parser.ready = false;
            }
            break;
        case ParserState.TYPE:
            if (VALID_TYPES.has(byte)) {
                parser.pending.type = byte as PacketType;
                parser.state = ParserState.LEN;
            } else {
                parser.state = ParserState.SOF;
            }
            break;
        case ParserState.LEN:
            parser.pendingPayloadLen = byte;
            parser.state = byte > 0 ? ParserState.PAYLOAD : ParserState.CHECKSUM;
            break;
        case ParserState.PAYLOAD:
            parser.pending.payload[parser.cursor++] = byte;
            if (parser.cursor >= parser.pendingPayloadLen) parser.state = ParserState.CHECKSUM;
            break;
        case ParserState.CHECKSUM: {
            const view = { type: parser.pending.type, payload: parser.pending.payload.subarray(0, parser.pendingPayloadLen) };
            if (byte === crc8(view)) parser.ready = true;
            parser.state = ParserState.SOF;
            break;
        }
    }
}

export function take(parser: Parser): Packet | null {
    if (!parser.ready) return null;
    parser.ready = false;
    return {
        type: parser.pending.type,
        payload: parser.pending.payload.slice(0, parser.pendingPayloadLen),
    };
}

export function encode(packet: Packet): Uint8Array {
    if (packet.payload.length > MAX_PAYLOAD) throw new Error(`Payload length exceeds maximum of ${MAX_PAYLOAD}`);
    const bytes = new Uint8Array(4 + packet.payload.length);
    bytes[0] = SOF_BYTE;
    bytes[1] = packet.type;
    bytes[2] = packet.payload.length;
    for (let i = 0; i < packet.payload.length; i++) bytes[3 + i] = packet.payload[i];
    bytes[3 + packet.payload.length] = crc8(packet);
    return bytes;
}


