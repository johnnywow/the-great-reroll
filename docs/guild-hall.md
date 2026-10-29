# Guild Hall roster planner

Open `guild-hall.html`, or choose Guild Hall from the War Table homepage. The previous two-stage roster draft remains available from the new page's Roster draft link (`index.html?guild-draft=1`).

## Planning model

- One record represents one member's planned character. Class, race, and primary spec can remain undecided.
- Race eligibility, class colors, class icons, artwork, and spec labels reuse `data/characters.js`. These are the site's current planning assumptions, not a claim that current game rules or spec viability have been independently verified.
- Primary specs count once in the active role totals. Explicit backup specs are shown separately. Bench members are excluded from all coverage and lineup calculations.
- Spec coverage lists primary assignments, explicit backups, and all active members of that class as potential options. Potential counts overlap; they are not additive.
- Lineups use maximum bipartite matching between active members and customizable role slots. Each member can fill at most one slot. The primary/backup mode allows any class spec when the primary is undecided; all-class mode explores every available class spec. Spec suggestions outside declared primary/backup choices are marked for confirmation. This is a role feasibility planner, not an optimized buff, performance, or raid-balance simulation.
- Applying a suggested lineup updates listed primary specs and retains old primary specs as backups. Members outside the lineup keep their current status and assignments.

## Persistence

The browser stores one working roster at `war-table-guild-roster-v1`. JSON backup/import allows transfer or sharing; CSV provides a readable export. This version has no account service or shared real-time edits. Invalid backup structures, future versions, excessive member counts, and excessive total targets are rejected. Cross-tab edits pause saving to avoid overwriting another tab.

Limits: 100 members, 100 target slots, 80-character names, 500-character notes, and a 1 MB import file size. Dynamic text is escaped before rendering. CSV formula prefixes are neutralized.

## Verification

Run `node --test tests/*.test.cjs`. Guild coverage tests include competing flexible roles, bench exclusion, declared vs. potential availability, import normalization, safe CSV output, backup roundtrips, and 100 distinct assigned members.
