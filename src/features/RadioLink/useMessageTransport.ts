import { useEffect, useRef } from "react";
import { useRocketLink } from "../RocketLink/RocketLinkContext";
import { createParser, encode, feed, take, Message, JobStatus, MessageType } from "./Protocol";
import { useFrameLog } from "./useFrameLog";

export type { LogEntry } from "./useFrameLog";

const MAX_RESPONSE_TIME = 1000;

export enum ResponseStatus {
    SUCCESS,
    FAILURE,
}

interface PendingResponses {
    resolve: (result: { status: ResponseStatus; payload?: any }) => void;
    reject: (err: Error) => void;
    timer?: ReturnType<typeof setTimeout>;
    timeout_ms: number;
    remainingRetries: number;
    message: Message;
}

export function useMessageTransport(onResponse?: () => void) {
    const { sendRadio, onReceiveRadio } = useRocketLink();
    const { log, addLogEntry } = useFrameLog();

    const nextSeqId = useRef(0);
    const nextFrameId = useRef(0);

    const pendingResponses = useRef<Map<number, PendingResponses>>(new Map());

    const sceduledMessages = useRef<Message[]>([]);

    const sendInFlight = useRef(false);
    const receveDeadline = useRef(0);

    const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

    const armTimeout = (seqId: number, timeout_ms: number) => {
        return setTimeout(() => {
            const pending = pendingResponses.current.get(seqId);
            if (!pending) return;

            if (pending.remainingRetries > 0) {
                pending.remainingRetries -= 1;
                sceduledMessages.current.push(pending.message);
                sendFrame(); // rearms the timer once the retry is actually sent
            } else {
                pendingResponses.current.delete(seqId);
                pending.reject(new Error("Timeout"));
            }
        }, timeout_ms);
    };

    useEffect(() => {
        const parser = createParser();

        return onReceiveRadio((data) => {

            let doPing = false;

            for (const byte of data) {
                feed(parser, byte);
                const frame = take(parser);
                if (!frame) continue;

                sendInFlight.current = false;

                const frameId = nextFrameId.current++;
                addLogEntry({ direction: "receive", frameId, ts: Date.now(), messages: frame.messages });

                for (const message of frame.messages) {
                    const pending = pendingResponses.current.get(message.seqId);
                    if (!pending) continue;

                    onResponse?.();

                    // BUSY means the firmware job is still running; extend the timeout and keep waiting
                    if (message.status === JobStatus.BUSY) {
                        clearTimeout(pending.timer);
                        pending.timer = armTimeout(message.seqId, pending.timeout_ms);
                        doPing = true;
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

            if (doPing) {
                sendFrame(); // send a ping frame if any pending responses are still busy to receive the final response
            }
        });
    }, [onReceiveRadio]);

    const queueMessage = (messageType: MessageType, payload?: any, timeout_ms = 500, retrys = 3): Promise<{ status: ResponseStatus; payload?: any }> => {
        const seqId = (nextSeqId.current = (nextSeqId.current + 1) & 0xFF);
        const payloadArr = payload ?? new Uint8Array();
        const message: Message = { type: messageType, payload: payloadArr, seqId, status: JobStatus.BUSY };

        const result = new Promise<{ status: ResponseStatus; payload?: any }>((resolve, reject) => {
            pendingResponses.current.set(seqId, { resolve, reject, timeout_ms, remainingRetries: retrys, message });

            sceduledMessages.current.push(message);
        });
        return result;
    };

    const sendFrame = async () => {
        // wait out any cooldown instead of dropping the messages that were counting on this call to flush them
        while (sendInFlight.current && Date.now() < receveDeadline.current) {
            await delay(receveDeadline.current - Date.now());
        }

        if (pendingResponses.current.size === 0 && sceduledMessages.current.length === 0) return;

        const messages = sceduledMessages.current.splice(0, 16); // even send an empty frame if there are no new messages to allow the rocket to respond
        const frameId = nextFrameId.current++;
        if (messages.length > 0) {
            addLogEntry({ direction: "send", frameId, ts: Date.now(), messages });
        }
        const encodedFrame = Array.from(encode({ messages }));
        messages.forEach((message) => {
            const pending = pendingResponses.current.get(message.seqId);
            if (pending) pending.timer = armTimeout(message.seqId, pending.timeout_ms);
        });
        sendRadio(encodedFrame).catch((err) => {
                for (const message of messages) {
                    const pending = pendingResponses.current.get(message.seqId);
                    if (pending) {
                        clearTimeout(pending.timer);
                        pendingResponses.current.delete(message.seqId);
                        pending.reject(err);
                    }
                }
            });
        
        sendInFlight.current = true;
        receveDeadline.current = Date.now() + MAX_RESPONSE_TIME;
    };

    return { log, queueMessage, sendFrame };
}
