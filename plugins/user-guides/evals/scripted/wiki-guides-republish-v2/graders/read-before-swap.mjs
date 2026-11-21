import { readBeforeSwap, ok } from '../../lib/wiki.mjs';
export default ({ toolCalls }) => ok(readBeforeSwap(toolCalls, ['settings']), 'the retaken PNG read before the swap');
