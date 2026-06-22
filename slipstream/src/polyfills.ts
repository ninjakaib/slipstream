/**
 * TextDecoder & TextEncoder polyfill for Hermes.
 *
 * Hermes does not ship a full TextDecoder implementation (it lacks
 * encodings like "utf-16le"). Libraries such as h3-js reference
 * TextDecoder("utf-16le") in their compiled bundles and crash on parse.
 *
 * This polyfill must be loaded before any library that uses TextDecoder.
 * It's imported at the top of the Expo Router entry layout.
 *
 * Based on: https://github.com/uber/h3-js/issues/203
 */
import { polyfillGlobal } from "react-native/Libraries/Utilities/PolyfillFunctions";
import { TextDecoder, TextEncoder } from "fast-text-encoding";

polyfillGlobal("TextDecoder", () => TextDecoder);
polyfillGlobal("TextEncoder", () => TextEncoder);
