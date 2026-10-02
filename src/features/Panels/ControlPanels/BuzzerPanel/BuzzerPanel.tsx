import { Card } from "../../../../shared/components/elements/Card";
import { PanelHeader } from "../../../../shared/components/elements/PanelHeader";
import { Button } from "../../../../shared/components/primitives/Button";
import { useRadioLink } from "../../../RadioLink/RadioLinkContext";

export function BuzzerPanel({ className = "" }: { className?: string }) {
    const { connected, beepBuzzer } = useRadioLink();
    return (
        <Card className={`p-3 flex flex-col gap-2 ${className}`}>
            <PanelHeader
                icon="B"
                title="Buzzer"
                subtitle={undefined}
                alert={false}
                connected={true}
            />
            <Button variant="ghost" className="px-3 py-1.5 text-xs w-full" disabled={!connected} onClick={beepBuzzer} title="Beep the buzzer">
                Beep Buzzer
            </Button>
        </Card>
    );
}