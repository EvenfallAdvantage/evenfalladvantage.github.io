declare module "mode-s-decoder" {
  interface Message {
    crcOk: boolean;
    icao?: string;
    msg: string;
    msgtype: number;
    msgbits: number;
    crc: string;
    [key: string]: unknown;
  }

  class Decoder {
    constructor();
    parse(data: Buffer, crcOnly?: boolean): Message;
  }

  export default Decoder;
}
