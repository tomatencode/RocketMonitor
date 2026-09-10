
export enum PacketType {
    PING=0x01,
    PONG=0x02,
    GET_TELEMETRY=0x20,
    TELEMETRY=0x21,
    SET_GIMBAL_POS=0x30,
    SET_GIMBAL_POS_AKC=0x31,
    BEEP_BUZZER=0x41,
    BEEP_BUZZER_ACK=0x42,
    FIRE_PYRO_CHANNEL=0x52,
    FIRE_PYRO_CHANNEL_ACK=0x53,
}

export interface Packet {
    type: PacketType;
    payload: Uint8Array;
}


// TODO: implement Parser and encoder for RocketLink protocol