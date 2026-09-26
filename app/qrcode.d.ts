declare module "qrcode" {
  type QROptions = { errorCorrectionLevel?: "L" | "M" | "Q" | "H"; margin?: number; width?: number };
  const QRCode: { toDataURL(text: string, options?: QROptions): Promise<string> };
  export default QRCode;
}
