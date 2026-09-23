import { Button } from "../../../shared/components/primitives/Button";
import { dividerBorder } from "../../../shared/styles";
import { MessageType } from "../../RadioLink/Protocol";

const DEFAULT_FILTER_MESSAGE_TYPES = [
    MessageType.PING,
    MessageType.TELEMETRY,
    MessageType.GET_IMU,
    MessageType.GET_BAROMETER,
];

interface RadioLogFilterProps {
    messageTypes: MessageType[];
    excludedTypes: Partial<Record<MessageType, boolean>>;
    onToggle: (messageType: MessageType) => void;
    isOpen: boolean;
}

export function RadioLogFilter({ messageTypes, excludedTypes, onToggle, isOpen }: RadioLogFilterProps) {
    return (
        <div className={`grid shrink-0 transition-[grid-template-rows] duration-200 ease-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr] pointer-events-none"}`}>
            <div className="overflow-hidden">
                <div className={`h-9 flex items-center gap-1.5 px-2 border-b transition-[transform,opacity] duration-200 ease-out ${isOpen ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"} ${dividerBorder}`}>
                    {messageTypes.map(messageType => (
                        <Button
                            key={messageType}
                            variant="ghost"
                            className={`shrink-0 px-2.5 py-1 text-xs ${excludedTypes[messageType] ? "line-through" : ""}`}
                            onClick={() => onToggle(messageType)}
                            aria-pressed={excludedTypes[messageType] ?? false}
                        >
                            {MessageType[messageType]}
                        </Button>
                    ))}
                </div>
            </div>
        </div>
    );
}

export function getFilterMessageTypes(presentTypes: Iterable<MessageType>): MessageType[] {
    const messageTypes = new Set<MessageType>(DEFAULT_FILTER_MESSAGE_TYPES);
    for (const messageType of presentTypes) {
        messageTypes.add(messageType);
    }
    return [...messageTypes];
}