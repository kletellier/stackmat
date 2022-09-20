import { Packet } from './packet/packet'
import { StackmatSignalProcessor } from './stackmatsignalprocessor'

export class AudioProcessor {
    private readonly callback: (packet: Packet) => void
    private stream?: MediaStream
    private context?: AudioContext
    private source?: MediaStreamAudioSourceNode
    private workletNode?: AudioWorkletNode

    constructor(callback: (packet: Packet) => void) {
        this.callback = callback
    }

    public start() {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                },
            }).then((stream: MediaStream) => {
                this.stream = stream
                this.context = new AudioContext()
                this.source = this.context.createMediaStreamSource(this.stream)
                
                this.context.audioWorklet.addModule(StackmatSignalProcessor).then(() => {
                    if (this.context && this.source) {
                        this.workletNode = new AudioWorkletNode(this.context, 'StackmatSignalProcessor', {numberOfInputs: 1, numberOfOutputs: 1})
                        this.workletNode.port.onmessage = (event: MessageEvent) => {
                         
                            let isValid:boolean = (event.data.state.code!=="X")
                            let packet:Packet = new Packet(isValid,event.data.state.code,event.data.time);
                            this.callback(packet);                           
                        }
                        this.source.connect(this.workletNode)
                        this.workletNode.connect(this.source.context.destination)
                    }
                })
            }).catch((error: Error) => {
                console.error(error)
            })
        }
    }

    public stop() {
        if (this.context && this.source && this.workletNode) {
            this.source.disconnect(this.workletNode)
            this.workletNode.disconnect(this.context.destination)
            this.workletNode = undefined
            this.source = undefined
            this.context.close().finally(() => {
                this.context = undefined
            })
        }

        if (this.stream) {
            this.stream.getTracks().forEach((track: MediaStreamTrack) => track.stop())
            this.stream = undefined
        }
    }
}
