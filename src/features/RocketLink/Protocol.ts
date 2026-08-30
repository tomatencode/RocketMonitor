// Enum values must match the C++ protocol.hpp definition
export enum PacketType {
    PING=0x01,
    PONG=0x02,
    RADIO_SEND=0x10,
    RADIO_SEND_QUEUED=0x11,
    RADIO_RECEIVED=0x12,
    AT_CMD=0x20,
    AT_RESP=0x21
}

export const EXPECTED_RESPONSE: Partial<Record<PacketType, PacketType>> = {
    [PacketType.PING]: PacketType.PONG,
    [PacketType.RADIO_SEND]: PacketType.RADIO_SEND_QUEUED,
    [PacketType.AT_CMD]: PacketType.AT_RESP,
};

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
    PacketType.PING, PacketType.PONG, PacketType.RADIO_SEND, PacketType.RADIO_SEND_QUEUED,
    PacketType.RADIO_RECEIVED, PacketType.AT_CMD, PacketType.AT_RESP,
]);

// CRC-8/SMBUS, poly 0x07
const CRC8_TABLE = (() => {
    const table = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
        let crc = i;
        for (let bit = 0; bit < 8; bit++)
            crc = crc & 0x80 ? (crc << 1) ^ 0x07 : crc << 1;
        table[i] = crc & 0xFF;
    }
    return table;
})();

function crc8(packet: Packet): number {
    let crc = 0;
    crc = CRC8_TABLE[crc ^ packet.type];
    crc = CRC8_TABLE[crc ^ packet.payload.length];
    for (const byte of packet.payload) crc = CRC8_TABLE[crc ^ byte];
    return crc;
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


