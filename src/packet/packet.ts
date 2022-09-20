export enum PacketStatus {
    IDLE = 'I',
    STARTING = 'A',
    RUNNING = ' ',
    STOPPED = 'S',
    LEFT_HAND = 'L',
    RIGHT_HAND = 'R',
    BOTH_HANDS = 'C',
    INVALID = 'X',
}

export interface PacketInterface {
    isValid: boolean
    status: PacketStatus
    timeInMilliseconds: number
    isLeftHandDown: boolean
    isRightHandDown: boolean
    areBothHandsDown: boolean
}

export class Packet implements PacketInterface {
    public readonly isValid: boolean
    public readonly status: PacketStatus
    public readonly timeInMilliseconds: number

    constructor(isValid: boolean, status?: PacketStatus,  timeInMilliseconds?: number) {
        this.isValid = isValid
        this.status = status || PacketStatus.INVALID
        this.timeInMilliseconds = timeInMilliseconds || 0
    }    

    get isLeftHandDown(): boolean {
        return this.status === PacketStatus.LEFT_HAND || this.status === PacketStatus.BOTH_HANDS || this.status === PacketStatus.STARTING
    }

    get isRightHandDown(): boolean {
        return this.status === PacketStatus.RIGHT_HAND || this.status === PacketStatus.BOTH_HANDS || this.status === PacketStatus.STARTING
    }

    get areBothHandsDown(): boolean {
        return this.status === PacketStatus.BOTH_HANDS || this.status === PacketStatus.STARTING
    }
}

// The "stackmat signal" is essentially just a RS232 serial signal (1200 baud, 8 databits, no parity bits, one stop bit). This signal is converted to TTL level (5V/0V) by the MAX232 level shifter IC, so the Atmel microprocessor can understand it.

// The payload is transmitted in 9 byte packets:
// 1: command byte as ASCII character ('I','A','S','L','R','C' or ' ')
// 2-6: time in ASCII chars (2:34:56)
// 7: checksum (64 + sum of time digits)
// 8: CR (carriage return, ASCII code 0x0D)
// 9: LF (line feed, ASCII code 0x0A)
// Example:
// S02527P[CR][LF]
// time: 0:25:27
// checksum: 64 + 0 + 2 + 5 + 2 + 7 = 64 + 16 = 80 = 'P' (chechsuk OK)
// Command bytes:
// 'I': timer initialized and reset to 0 (both hand pads open)
// 'A': timer ready to begin, both hand-pads covered
// ' ': timer running/counting (both hand-pads open)
// 'S': timing complete (both hand-pads open)
// 'L': left hand-pad covered (overrides 'I', ' ', 'S')
// 'R': right hand-pad covered (overrides 'I', ' ', 'S')
// 'C': both hand-pads covered (overrides 'I', ' ', 'S')