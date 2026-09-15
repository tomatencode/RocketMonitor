import { useEffect, useRef, useState } from "react";
import { useRocketLink } from "../RocketLink/RocketLinkContext";
import { createParser, encode, feed, take, Message, JobStatus } from "./Protocol";

type DataDirection = "send" | "receive";
// frameId groups messages that were carried in the same wire frame
export type LogEntry = { direction: DataDirection; ts: number; frameId: number; message: Message };

const MAX_LOG_ENTRIES = 1000;

export enum ResponseStatus {
    SUCCESS,
    FAILURE,
}

interface PendingResponses {
    resolve: (result: { status: ResponseStatus; payload?: any }) => void;
    reject: (err: Error) => void;
    timer: ReturnType<typeof setTimeout>;
    timeout_ms: number;
}

export function useMessageTransport() {
    const { sendRadio, onReceiveRadio } = useRocketLink();
    const [log, setLog] = useState<LogEntry[]>([]);

    const nextSeqId = useRef(0);
    const nextFrameId = useRef(0);

    const pendingResponses = useRef<Map<number, PendingResponses>>(new Map());

    const sceduledMessages = useRef<Message[]>([]);

    const didRespond = useRef(false);


    const addLogEntry = (entry: LogEntry) => {
        setLog((prev) => {
            const newLog = [...prev, entry];
            if (newLog.length > MAX_LOG_ENTRIES) newLog.shift();
            return newLog;
        });
    };

    const armTimeout = (seqId: number, timeout_ms: number, reject: (err: Error) => void) => {
        return setTimeout(() => {
            pendingResponses.current.delete(seqId);
            reject(new Error("Timeout"));
        }, timeout_ms);
    };

    useEffect(() => {
        const parser = createParser();

        return onReceiveRadio((data) => {
            for (const byte of data) {
                feed(parser, byte);
                const frame = take(parser);
                if (!frame) continue;

                didRespond.current = true;

                const frameId = nextFrameId.current++;
                for (const message of frame.messages) {
                    addLogEntry({ direction: "receive", message, frameId, ts: Date.now() });

                    const pending = pendingResponses.current.get(message.seqId);
                    if (!pending) continue;

                    // BUSY means the firmware job is still running; extend the timeout and keep waiting
                    if (message.status === JobStatus.BUSY) {
                        clearTimeout(pending.timer);
                        pending.timer = armTimeout(message.seqId, pending.timeout_ms, pending.reject);
                        continue;
                    }

                    clearTimeout(pending.timer);
                    pendingResponses.current.delete(message.seqId);
                    const status: ResponseStatus = message.status === JobStatus.SUCCESS ? ResponseStatus.SUCCESS : ResponseStatus.FAILURE;
                    const payload = message.payload;
                    if (payload.length > 0) {
                        pending.resolve({ status, payload });
                    } else {
                        pending.resolve({ status });
                    }
                }
            }
        });
    }, [onReceiveRadio]);

    const sceduleSendAndReceiveMessage = (partial: Pick<Message, "type" | "payload">, timeout_ms = 500): Promise<{ status: ResponseStatus; payload?: any }> => {
        const seqId = (nextSeqId.current = (nextSeqId.current + 1) & 0xFF);
        const message: Message = { ...partial, seqId, status: JobStatus.BUSY };

        const result = new Promise<{ status: ResponseStatus; payload?: any }>((resolve, reject) => {
            const timer = armTimeout(seqId, timeout_ms, reject);
            pendingResponses.current.set(seqId, { resolve, reject, timer, timeout_ms });

            sceduledMessages.current.push(message);
        });
        return result;
    };

    const update = () => {

        if (!didRespond.current) return; // do nothing if the rocket is responding
        if (pendingResponses.current.size === 0) return; // do nothing if there are no pending responses

        const messages = sceduledMessages.current.splice(0, 16); // even send an empty batch if there are no new messages to allow the rocket to respond
        sendRadio(Array.from(encode({ messages: messages }))).catch((err) => {
                for (const message of messages) {
                    const pending = pendingResponses.current.get(message.seqId);
                    if (pending) {
                        clearTimeout(pending.timer);
                        pendingResponses.current.delete(message.seqId);
                        pending.reject(err);
                    }
                }
            });

        didRespond.current = false;

    };

    return { log, sendAndReceiveMessage: sceduleSendAndReceiveMessage, update };
}
