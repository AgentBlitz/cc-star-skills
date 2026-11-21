// It reads every PNG back (one Read each) before swapping them into the guides.
import { readBeforeSwap, ok } from '../../lib/wiki.mjs';
export default ({ toolCalls }) => ok(readBeforeSwap(toolCalls, ['home-first-look', 'request-dialog', 'my-requests', 'settings', 'inbox']), 'every PNG read before the swap');
