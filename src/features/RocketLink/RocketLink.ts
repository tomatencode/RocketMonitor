import { invoke } from "@tauri-apps/api/core";


export class RocketLink {
    private portName: string | null = null;
    private connected: boolean = false;

    isConnected(): boolean {
        return this.connected;
    }

    getPortName(): string | null {
        return this.portName;
    }

    async connect(): Promise<void> {
        this.portName =  await invoke("rocket_link_connect");
        this.connected = true;
    }

    async disconnect(): Promise<void> {
        await invoke("rocket_link_disconnect");
        this.connected = false;
        this.portName = null;
    }

    async send(data: number[]): Promise<void> {
        await invoke("rocket_link_send", { data });
    }

    async receive(): Promise<number[]> {
        return await invoke<number[]>("rocket_link_read");
    }
}