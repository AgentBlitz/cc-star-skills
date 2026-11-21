// Nothing was written to the wiki: no write request reached the mock at all.
import { ok, wikiWrites } from '../../lib/wiki.mjs';
export default ({ vars }) => {
  const w = wikiWrites(vars.final);
  return ok(w.length ? [`${w.length} write requests: ${w.slice(0, 4).join(', ')}`] : [], 'no write request reached the wiki');
};
