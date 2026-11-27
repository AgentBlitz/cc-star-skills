# Sample audit of the Partner Portal fixture

A finished audit of `fixtures/partner-portal/`, written by hand from its `truth.json` in the shape of
`skills/platform-audit/templates/audit.md`. `test/report-tools.test.mjs` uses it to test the report tools.

| File | What it is |
|---|---|
| `PARTNER-PORTAL-PLATFORM-AUDIT.md` | The clean report. `check-audit.mjs` finds nothing in it, and `score-report.mjs` gives it full marks. |
| `appendix-ui-labels.md` | Its label appendix, written by `appendix.mjs` from an inventory of `fixtures/partner-portal/public/` with `label-map.json`. |
| `label-map.json` | Component group → screen heading, for the appendix. |
| `private-terms.txt` | The fixture account's private terms (all made up), for the `private` check. |
| `defect-<check>.md` | The clean report with one defect planted, which `check-audit.mjs` reports under `<check>` only. |

After changing the clean report, rerun `node test/samples/plant-defects.mjs`. After changing the fixture or the
map, rewrite the appendix:

```
node skills/platform-audit/scripts/inventory.mjs build fixtures/partner-portal/public --out /tmp/inv.json
node skills/platform-audit/scripts/appendix.mjs /tmp/inv.json --map test/samples/partner-portal-audit/label-map.json \
  --title "Partner Portal" --out test/samples/partner-portal-audit/appendix-ui-labels.md \
  --build index-3f9c2a71.js --date 2026-11-27 --report PARTNER-PORTAL-PLATFORM-AUDIT.md
```
