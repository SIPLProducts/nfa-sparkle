declare module "mammoth/mammoth.browser" {
  interface MammothResult {
    value: string;
    messages: Array<{ type: string; message: string }>;
  }
  interface MammothBrowser {
    convertToHtml(
      input: { arrayBuffer: ArrayBuffer },
      options?: { includeDefaultStyleMap?: boolean },
    ): Promise<MammothResult>;
  }
  const mammoth: MammothBrowser;
  export default mammoth;
}