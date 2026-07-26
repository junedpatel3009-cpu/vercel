declare module "@/lib/sanitize-html-shim.mjs" {
  import sanitizeHtml = require("sanitize-html");
  const fn: typeof sanitizeHtml;
  export default fn;
}
