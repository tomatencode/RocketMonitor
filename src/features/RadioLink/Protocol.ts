// Mirrors the C++ radioLink/Protocol.hpp/.cpp framing (frames of multiple messages)
export enum MessageType {
    PING = 0x00,
    TELEMETRY = 0x01,
    GET_GIMBAL = 0x02,
    SET_GIMBAL = 0x03,
    DO_BEEP = 0x04,
    FIRE_PYRO = 0x05,
    GET_IMU = 0x06,
    GET_BARO = 0x07,
    GET_ROTATION = 0x08,
    SET_ROTATION = 0x09,
}

// Responses reuse the request's MessageType/seqId; status distinguishes request vs. outcome
export enum JobStatus {
    BUSY = 0x00,
    SUCCESS = 0x01,
    FAILURE = 0x02,
}

export interface Message {
    type: MessageType;
    seqId: number;
    status: JobStatus; // only meaningful on responses
    payload: Uint8Array;
}

export interface Frame {
    messages: Message[];
}

const START_BYTE = 0xAA;
const MAX_MESSAGES_PER_FRAME = 16;
const MAX_FRAME_MESSAGES_LEN = 1024;
const MAX_MESSAGE_PAYLOAD = 255; // messageLen is a single byte
const CRC16_INITIAL = 0xFFFF;

function updateCrc16(crc: number, byte: number): number {
    crc ^= (byte << 8) & 0xFFFF;
    for (let i = 0; i < 8; i++) {
        crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
    }
    return crc;
}

const enum FrameState { START, LEN_LOW, LEN_HIGH, NUM_MESSAGES, MESSAGE, CRC_LOW, CRC_HIGH }
const enum MessageState { TYPE, SEQ_ID, STATUS, MESSAGE_LEN, PAYLOAD }

export interface Parser {
    frameState: FrameState;
    messageState: MessageState;
    crc: number;
    crcLow: number;
    numMessages: number;
    messagesExpectedLen: number;
    messagesBytesCount: number;
    messages: Message[];
    currentMessage: Message;
    messagePayloadIndex: number;
    ready: boolean;
    pendingFrame: Frame;
}

export function createParser(): Parser {
    return {
        frameState: FrameState.START,
        messageState: MessageState.TYPE,
        crc: CRC16_INITIAL,
        crcLow: 0,
        numMessages: 0,
        messagesExpectedLen: 0,
        messagesBytesCount: 0,
        messages: [],
        currentMessage: { type: MessageType.TELEMETRY, seqId: 0, status: JobStatus.BUSY, payload: new Uint8Array(0) },
        messagePayloadIndex: 0,
        ready: false,
        pendingFrame: { messages: [] },
    };
}

function resetParseState(parser: Parser): void {
    parser.frameState = FrameState.START;
    parser.messageState = MessageState.TYPE;
    parser.crc = CRC16_INITIAL;
    parser.numMessages = 0;
    parser.messagesExpectedLen = 0;
    parser.messagesBytesCount = 0;
    parser.messages = [];
}

function feedMessage(parser: Parser, byte: number): Message | null {
    switch (parser.messageState) {
        case MessageState.TYPE:
            parser.currentMessage = { type: byte as MessageType, seqId: 0, status: JobStatus.BUSY, payload: new Uint8Array(0) };
            parser.messageState = MessageState.SEQ_ID;
            break;
        case MessageState.SEQ_ID:
            parser.currentMessage.seqId = byte;
            parser.messageState = MessageState.STATUS;
            break;
        case MessageState.STATUS:
            parser.currentMessage.status = byte as JobStatus;
            parser.messageState = MessageState.MESSAGE_LEN;
            break;
        case MessageState.MESSAGE_LEN:
            parser.currentMessage.payload = new Uint8Array(byte);
            parser.messagePayloadIndex = 0;
            if (byte > 0) {
                parser.messageState = MessageState.PAYLOAD;
            } else {
                parser.messageState = MessageState.TYPE;
                return parser.currentMessage;
            }
            break;
        case MessageState.PAYLOAD:
            parser.currentMessage.payload[parser.messagePayloadIndex++] = byte;
            if (parser.messagePayloadIndex >= parser.currentMessage.payload.length) {
                parser.messageState = MessageState.TYPE;
                return parser.currentMessage;
            }
            break;
    }
    return null;
}

export function feed(parser: Parser, byte: number): void {
    switch (parser.frameState) {
        case FrameState.START:
            if (byte === START_BYTE) {
                resetParseState(parser);
                parser.frameState = FrameState.LEN_LOW;
            }
            break;
        case FrameState.LEN_LOW:
            parser.crc = updateCrc16(parser.crc, byte);
            parser.messagesExpectedLen = byte;
            parser.frameState = FrameState.LEN_HIGH;
            break;
        case FrameState.LEN_HIGH:
            parser.crc = updateCrc16(parser.crc, byte);
            parser.messagesExpectedLen |= byte << 8;
            if (parser.messagesExpectedLen > MAX_FRAME_MESSAGES_LEN) {
                parser.frameState = FrameState.START;
                break;
            }
            parser.frameState = FrameState.NUM_MESSAGES;
            break;
        case FrameState.NUM_MESSAGES:
            parser.crc = updateCrc16(parser.crc, byte);
            parser.numMessages = byte;
            if (parser.numMessages > MAX_MESSAGES_PER_FRAME) {
                parser.frameState = FrameState.START;
                break;
            }
            parser.frameState = parser.numMessages > 0 ? FrameState.MESSAGE : FrameState.CRC_LOW;
            break;
        case FrameState.MESSAGE: {
            parser.crc = updateCrc16(parser.crc, byte);
            parser.messagesBytesCount++;
            const message = feedMessage(parser, byte);
            if (message) parser.messages.push(message);

            if (parser.messages.length === parser.numMessages) {
                parser.frameState = parser.messagesBytesCount === parser.messagesExpectedLen ? FrameState.CRC_LOW : FrameState.START;
            } else if (parser.messagesBytesCount > parser.messagesExpectedLen) {
                parser.frameState = FrameState.START;
            }
            break;
        }
        case FrameState.CRC_LOW:
            parser.crcLow = byte;
            parser.frameState = FrameState.CRC_HIGH;
            break;
        case FrameState.CRC_HIGH: {
            const receivedCrc = (byte << 8) | parser.crcLow;
            if (receivedCrc === parser.crc) {
                parser.pendingFrame = { messages: parser.messages };
                parser.ready = true;
            }
            parser.frameState = FrameState.START;
            break;
        }
    }
}

export function take(parser: Parser): Frame | null {
    if (!parser.ready) return null;
    parser.ready = false;
    return parser.pendingFrame;
}

export function encode(frame: Frame): Uint8Array {
    if (frame.messages.length > MAX_MESSAGES_PER_FRAME) throw new Error(`Frame exceeds maximum of ${MAX_MESSAGES_PER_FRAME} messages`);

    let messagesLen = 0;
    for (const message of frame.messages) {
        if (message.payload.length > MAX_MESSAGE_PAYLOAD) throw new Error(`Message payload exceeds maximum of ${MAX_MESSAGE_PAYLOAD}`);
        messagesLen += 4 + message.payload.length;
    }

    const bytes = new Uint8Array(4 + messagesLen + 2);
    bytes[0] = START_BYTE;
    bytes[1] = messagesLen & 0xFF;
    bytes[2] = (messagesLen >> 8) & 0xFF;
    bytes[3] = frame.messages.length;

    let cursor = 4;
    for (const message of frame.messages) {
        bytes[cursor++] = message.type;
        bytes[cursor++] = message.seqId;
        bytes[cursor++] = message.status;
        bytes[cursor++] = message.payload.length;
        bytes.set(message.payload, cursor);
        cursor += message.payload.length;
    }

    let crc = CRC16_INITIAL;
    for (let i = 1; i < cursor; i++) crc = updateCrc16(crc, bytes[i]);
    bytes[cursor++] = crc & 0xFF;
    bytes[cursor++] = (crc >> 8) & 0xFF;

    return bytes;
}
