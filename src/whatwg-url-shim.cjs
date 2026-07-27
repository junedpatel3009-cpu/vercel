const { createMultibyteDecoder } = require("@exodus/bytes/multi-byte.js");
const { setMultibyteDecoder } = require("@exodus/bytes/fallback/encoding.js");

setMultibyteDecoder(createMultibyteDecoder);

const {
  TextDecoder,
  TextEncoder,
  normalizeEncoding,
  getBOMEncoding,
  labelToName,
  legacyHookDecode,
} = require("@exodus/bytes/fallback/encoding.js");

module.exports = {
  TextDecoder,
  TextEncoder,
  normalizeEncoding,
  getBOMEncoding,
  labelToName,
  legacyHookDecode,
};
