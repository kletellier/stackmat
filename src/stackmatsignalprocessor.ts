
export const StackmatSignalProcessor = URL.createObjectURL(new Blob([ '(', function() {

const THRESHOLD_EDGE = 0.7

class StackmatSignalProcessor extends AudioWorkletProcessor {
  bitSampleRate
  sign = 1
  signalDuration = 0
  signalBuffer:number[] = []
  byteBuffer:string[] = []
  bits = new BitStream()

  constructor() {
    super()
    this.bitSampleRate = sampleRate / 1200 
    this.signalBuffer.length = Math.ceil(this.bitSampleRate / 6)     
  }

  process(inputs:Float32Array[][]):boolean {
    let power
    let gain
    let lastPower = 1
    let agcFactor = 0.0001

    inputs[0][0].forEach(input => {
      power = input * input
      lastPower = Math.max(agcFactor, lastPower + (power-lastPower) * agcFactor)
      gain = 1 / Math.sqrt(lastPower)
      this.processSignal(input*gain)
    })
  
    return true
  }

  processSignal(signal:number):void {
    this.signalBuffer.unshift(signal)
    let lastSignal:number | undefined =  this.signalBuffer.pop()
    this.signalDuration++;

    if (this.signalIsEdge(signal, lastSignal)) {
      for (let i = 0; i < Math.round(this.signalDuration / this.bitSampleRate); i++) {
        this.bits.append(this.sign)

        if (this.bits.isEmpty()) {
          this.byteBuffer = [] // align byte blocks
        }
        
        if (this.bits.isFull()) {
          this.byteBuffer.push(this.bits.dump())

          if (this.byteBuffer.length >= 10) {
            this.processByteBlock()
          }
        }
      }
      this.sign ^= 1
      this.signalDuration = 0
    }
  }

  signalIsEdge(signal:number, lastSignal:number | undefined):boolean {
    if(lastSignal)
    {
        return Math.abs(lastSignal - signal) > THRESHOLD_EDGE && this.signalDuration > this.bitSampleRate * 0.6
    }
    else
    {
        return false;
    }    
  }

  processByteBlock() {
    const state = decodeByteBlock(this.byteBuffer) || {...StackmatStates.get('X')}
    this.byteBuffer = []

    this.port.postMessage(state)
  }
}

class BitStream {
  buffer:number[] = []
  idleValue:number = 0
  lastBit = 0
  lastBitLength = 0

  append(bit:number) {
    this.buffer.push(bit)
    this.lastBitLength = bit === this.lastBit ? this.lastBitLength + 1 : 1
    this.lastBit = bit

    if (this.lastBitLength > 10) {
      this.idleValue = bit
      this.reset()
    }
  }

  reset() {
    this.buffer = []
  }

  isEmpty() {
    return this.buffer.length === 0
  }

  isFull() {
    if (this.buffer.length >= 10) {
      if (this.buffer[0] == this.idleValue || this.buffer[9] != this.idleValue) {
        this.buffer = this.buffer.slice(1)
        return false
      } else {
        return true
      }
    }
    return false
  }

  toByte():string {
    let byte = 0
    for (var i = 8; i > 0; i--) {
      let rightop = (this.buffer[i] === this.idleValue) ? 1 : 0 ;
      byte = byte << 1 | rightop;
    }
    return String.fromCharCode(byte)
  }

  dump() {
    const byte = this.toByte()
    this.reset()

    return byte
  }
}


function decodeByteBlock(byteBuffer:string[]) {
  let sum = 64
  let time = 0
  const reIsDigit = RegExp('[0-9]')
  const reIsValidState = RegExp('[ ACILSR]')
  const state:string | undefined = byteBuffer.shift()
  const digits = byteBuffer.splice(0,6)
  const checksum:string | undefined = byteBuffer.shift()
  const semantics = byteBuffer

  if (state && !reIsValidState.test(state)) {
    return
  }

  for (let i = 0; i < digits.length; i++) {
    if (!reIsDigit.test(digits[i])) {
      return
    }
    sum += ~~digits[i]
  }

  if (checksum && checksum.charCodeAt(0) !== sum) {
    return
  }

  time += ~~digits[0]*60000 // minutes
  time += 1000*(~~digits[1]*10 + ~~digits[2]) // seconds
  time += ~~digits[3]*100 + ~~digits[4]*10 + ~~digits[5] // milliseconds

  let pState = (state!==undefined) ? state : "X";
  return {
    ...StackmatStates.get(pState),
    time: time,
    isReset: time === 0,
  }
}

const StackmatStates = {
  base: {
    state: {
      id: -1,
      descriptor: "ERROR",
      code: "X"
    },
    rightHand: false,
    leftHand: false,
    bothHands: false,
    isReset: false,
    isRunning: false,
    time: 0
  },
  get: (stateCode:string) => {
    switch(stateCode) {
      case " ":
        StackmatStates.base.isRunning = true
        StackmatStates.base.isReset = false
        return {
          ...StackmatStates.base,
          state: {
            id: 1,
            descriptor: "RUNNING",
            code: " "
          },
        }
      case "A":
        return {
          ...StackmatStates.base,
          state: {
            id: 2,
            descriptor: "STARTING",
            code: "A"
          },
          rightHand: true,
          leftHand: true,
          bothHands: true,
        }
      case "C":
        StackmatStates.base.isRunning = false
        return {
          ...StackmatStates.base,
          state: {
            id: 3,
            descriptor: "BOTH_HANDS",
            code: "C"
          },
          rightHand: true,
          leftHand: true,
          bothHands: true,
        }
      case "I":
        StackmatStates.base.isRunning = false
        return {
          ...StackmatStates.base,
          state: {
            id: 4,
            descriptor: "IDLE",
            code: "I"
          },
        }
      case "L":
        return {
          ...StackmatStates.base,
          state: {
            id: 6,
            descriptor: "LEFT",
            code: "L"
          },
          leftHand: true,
        }
      case "S":
        StackmatStates.base.isRunning = false
        return {
          ...StackmatStates.base,
          state: {
            id: 7,
            descriptor: "STOPPED",
            code: "S"
          },
          rightHand: true,
          leftHand: true,
          bothHands: true,
        }
      case "R":
        return {
          ...StackmatStates.base,
          state: {
            id: 8,
            descriptor: "RIGHT",
            code: "R"
          },
          rightHand: true,
        }
      default:
        return {
          ...StackmatStates.base,
          state: {
            id: -1,
            descriptor: "ERROR",
            code: "X"
          },
        }
    }
  }
}
registerProcessor('StackmatSignalProcessor', StackmatSignalProcessor)
}.toString(), ')()' ], { type: 'application/javascript' }))