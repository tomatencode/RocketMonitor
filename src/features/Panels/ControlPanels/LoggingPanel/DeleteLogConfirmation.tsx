import { Button } from "../../../../shared/components/primitives/Button";

export type LogDeletion = { filename: string } | { all: true };

/** Shared confirmation explicitly identifies what will be removed from the rocket. */
export function DeleteLogConfirmation({ deletion, disabled, onConfirm, onCancel }: {
    deletion: LogDeletion;
    disabled: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    return (
        <div role="alertdialog" aria-label="Confirm log deletion" aria-describedby="log-delete-description"
            className="rounded-lg border border-red-800/50 bg-red-950/30 p-2.5 flex flex-col gap-2">
            <p id="log-delete-description" className="text-[11px] text-red-300 break-all">
                {"all" in deletion
                    ? "Delete ALL logs from the rocket and reclaim flash space? This cannot be undone."
                    : `Delete \"${deletion.filename}\" from the rocket? This cannot be undone and does not reclaim flash space.`}
                {" "}Downloaded files on your computer are not affected.
            </p>
            <div className="flex gap-2">
                <Button variant="danger" className="flex-1 px-2 py-1.5 text-xs" disabled={disabled} onClick={onConfirm}>
                    {"all" in deletion ? "Confirm Delete All" : "Confirm Delete"}
                </Button>
                <Button variant="neutral" className="px-2 py-1.5 text-xs" onClick={onCancel}>Cancel</Button>
            </div>
        </div>
    );
}