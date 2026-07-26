import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const sanitizeHtml = require('sanitize-html');
export default sanitizeHtml;
