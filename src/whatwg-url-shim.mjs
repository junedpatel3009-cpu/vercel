import { createMultiByteDecoder } from "@exodus/bytes/multi-byte.js";
import { setMultibyteDecoder } from "@exodus/bytes/fallback/encoding.js";

setMultibyteDecoder(createMultiByteDecoder);

export {
  TextDecoder,
  TextEncoder,
  normalizeEncoding,
  getBOMEncoding,
  labelToName,
  legacyHookDecode,
} from "@exodus/bytes/fallback/encoding.js";
