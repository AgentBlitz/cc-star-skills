import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as ph from '../skills/write-guides/scripts/placeholder.mjs';
import { validateGuideSet, createGuideSet, addGuide, addShot } from '../skills/write-guides/scripts/guide-set.mjs';

test('alt text reads "Screen: what to notice"', () => {
  assert.equal(ph.altText('Requests', 'the Request leave dialog'), 'Requests: the Request leave dialog');
  assert.equal(ph.altText('Settings: Notifications', '  three  boxes '), 'Settings Notifications: three boxes');
  assert.throws(() => ph.altText('', 'x'));
  assert.throws(() => ph.altText('x', ''));
  assert.deepEqual(ph.parseAlt('Home: the cards'), { screen: 'Home', notice: 'the cards' });
  assert.equal(ph.parseAlt('no form'), null);
});

test('the SVG card names caption, role and screen, escaped, and is well-formed', () => {
  const svg = ph.placeholderSvg({ id: 'request-dialog', caption: 'The dialog <with> "dates" & a note', role: 'employee', screen: 'Requests' });
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="800" height="450"/);
  assert.match(svg, /role="img" aria-label="Picture to come: Requests, as employee\. The dialog &lt;with&gt; &quot;dates&quot; &amp; a note"/);
  assert.match(svg, /<title>Picture to come: Requests, as employee\./);
  assert.match(svg, />as employee</);
  assert.match(svg, />Requests</);
  assert.match(svg, /data-user-guides-placeholder="request-dialog"/);
  assert.doesNotMatch(svg.replace(/&(amp|lt|gt|quot);/g, ''), /&|<with>/);
  // balanced tags
  const open = (svg.match(/<(?!\/)[a-z]+[^>]*[^/]>/g) || []).length;
  const close = (svg.match(/<\/[a-z]+>/g) || []).length;
  assert.equal(open, close);
  assert.throws(() => ph.placeholderSvg({ id: 'Bad Id', caption: 'x', role: 'r', screen: 's' }), /kebab-case/);
});

test('long captions wrap to at most four lines', () => {
  const lines = ph.wrap('word '.repeat(80), 46, 4);
  assert.equal(lines.length, 4);
  assert.ok(lines.every((l) => l.length <= 46));
  assert.ok(lines[3].endsWith('…'));
});

test('writePlaceholder writes images/<id>.svg and returns its link and alt text', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ph-'));
  const r = ph.writePlaceholder({ root, guidesDir: 'docs/user-guides', id: 'home-cards', screen: 'Home', notice: 'the balance card', role: 'employee', guideFile: 'docs/user-guides/employee.md' });
  assert.equal(r.path, 'docs/user-guides/images/home-cards.svg');
  assert.ok(fs.existsSync(path.join(root, r.path)));
  assert.equal(r.alt, 'Home: the balance card');
  assert.equal(r.markdown, '![Home: the balance card](images/home-cards.svg)');
  // a guide in another folder links across
  assert.equal(ph.imageMarkdown({ alt: r.alt, imagePath: r.path, guideFile: 'docs/wiki/admin.md' }), '![Home: the balance card](../user-guides/images/home-cards.svg)');
  // the shot entry it implies is valid against the contract
  const s = createGuideSet();
  addGuide(s, { id: 'employee', type: 'role-guide', file: 'docs/user-guides/employee.md', title: 'E' }, { by: 'write-guides' });
  addShot(s, { id: 'home-cards', alt: r.alt, as: 'employee', path: r.path, target: { what: 'the balance card', locator: null }, guides: ['employee'] }, { by: 'write-guides' });
  assert.deepEqual(validateGuideSet(s).errors, []);
  fs.rmSync(root, { recursive: true });
});

test('the CLI prints the markdown link', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ph-cli-'));
  const script = new URL('../skills/write-guides/scripts/placeholder.mjs', import.meta.url).pathname;
  const out = execFileSync('node', [script, '--dir', 'docs/user-guides', '--id', 'inbox', '--screen', 'Inbox', '--notice', 'two requests waiting', '--role', 'manager'], { cwd: root, encoding: 'utf8' });
  assert.equal(out.trim(), '![Inbox: two requests waiting](images/inbox.svg)');
  assert.ok(fs.existsSync(path.join(root, 'docs/user-guides/images/inbox.svg')));
  fs.rmSync(root, { recursive: true });
});
