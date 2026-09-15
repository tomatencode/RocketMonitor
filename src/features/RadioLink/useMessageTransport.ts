import { useEffect, useRef, useState } from "react";
import { useRocketLink } from "../RocketLink/RocketLinkContext";
import { createParser, encode, feed, take, Message, MessageType, JobStatus } from "./Protocol";

type DataDirection = "send" | "receive";
// frameId groups messages that were carried in the same wire frame
export type LogEntry = { direction: DataDirection; ts: number; frameId: number; message: Message };

const MAX_LOG_ENTRIES = 1000;

interface PendingRequest {
    resolve: (m: Message) => void;
    reject: (err: Error) => void;
    timer: ReturnType<typeof setTimeout>;
    timeout_ms: number;
}

export function useMessageTransport() {
    const { sendRadio, onReceiveRadio } = useRocketLink();
    const [log, setLog] = useState<LogEntry[]>([]);

    const nextSeqId = useRef(0);
    const nextFrameId = useRef(0);
    const typeMutexes = useRef<Map<MessageType, Promise<void>>>(new Map());
    // Responses reuse the request's MessageType, so correlation is keyed by seqId instead
    const pendingRequests = useRef<Map<number, PendingRequest>>(new Map());

    const addLogEntry = (entry: LogEntry) => {
        setLog((prev) => {
            const newLog = [...prev, entry];
            if (newLog.length > MAX_LOG_ENTRIES) newLog.shift();
            return newLog;
        });
    };

    const armTimeout = (seqId: number, timeout_ms: number, reject: (err: Error) => void) => {
        return setTimeout(() => {
            pendingRequests.current.delete(seqId);
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

                const frameId = nextFrameId.current++;
                for (const message of frame.messages) {
                    addLogEntry({ direction: "receive", message, frameId, ts: Date.now() });

                    const pending = pendingRequests.current.get(message.seqId);
                    if (!pending) continue;

                    // BUSY means the firmware job is still running; extend the timeout and keep waiting
                    if (message.status === JobStatus.BUSY) {
                        clearTimeout(pending.timer);
                        pending.timer = armTimeout(message.seqId, pending.timeout_ms, pending.reject);
                        continue;
                    }

                    clearTimeout(pending.timer);
                    pendingRequests.current.delete(message.seqId);
                    if (message.status === JobStatus.SUCCESS) {
                        pending.resolve(message);
                    } else {
                        pending.reject(new Error(`Job failed for message type ${message.type}`));
                    }
                }
            }
        });
    }, [onReceiveRadio]);

    const sendMessage = async (message: Message): Promise<void> => {
        addLogEntry({ direction: "send", message, frameId: nextFrameId.current++, ts: Date.now() });
        await sendRadio(Array.from(encode({ messages: [message] })));
    };

    const sendAndReceiveMessage = (partial: Pick<Message, "type" | "payload">, timeout_ms = 500): Promise<Message> => {
        const seqId = (nextSeqId.current = (nextSeqId.current + 1) & 0xFF);
        const message: Message = { ...partial, seqId, status: JobStatus.BUSY };

        const prev = typeMutexes.current.get(partial.type) ?? Promise.resolve();
        const result = prev.then(() => new Promise<Message>((resolve, reject) => {
            const timer = armTimeout(seqId, timeout_ms, reject);
            pendingRequests.current.set(seqId, { resolve, reject, timer, timeout_ms });

            sendMessage(message).catch((err) => {
                clearTimeout(timer);
                pendingRequests.current.delete(seqId);
                reject(err);
            });
        }));
        typeMutexes.current.set(partial.type, result.then(() => {}, () => {}));
        return result;
    };

    return { log, sendMessage, sendAndReceiveMessage };
}
