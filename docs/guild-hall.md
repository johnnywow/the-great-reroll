# Guild Hall roster planner

Open `/guild-hall/`, or choose Guild Hall from the War Table homepage. The page source lives in `guild-hall/index.html`; the former `/guild-hall.html` URL forwards to the clean address, preserving query strings and fragments. A relative base URL keeps shared scripts, styles, images, and home links working from the nested route. Browser storage remains on the same origin and key, preserving rosters and raid plans. The previous two-stage roster draft remains available from the Roster draft link (`/?guild-draft=1`).

## Planning model

- One record represents one member’s planned character. Player name (a real name or nickname) and character name are separate fields; either can be entered first. Class, race, and primary spec can remain undecided. Multiple alternate characters per player are not modeled.
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

## Interface

Guild Hall uses three keyboard-accessible views: Roster, Composition, and Spec coverage. The roster is a compact editable table with a role summary alongside it on desktop; narrow screens show member cards. Status is editable directly, while Details reveals backup specs and notes. Guild name and faction live in the guild settings dialog. New rosters see a short onboarding state instead of empty metrics. Coverage defaults to classes with active members; missing classes and count explanations are opt-in controls. The same storage key and backup format preserve existing rosters.

Player names appear above character names in editable roster rows. Search matches either name, and coverage and lineup details identify both. Paste names accepts either player names (default) or character names. Existing `name` fields remain character names; the optional `playerName` field is included in JSON backups and has its own CSV column. Old backups load with blank player names.

## Saved raid boards

The Raid board tab stores up to 20 named compositions with 5, 10, 20, 25, or 40 slots grouped in fives. Players can drag roster members or class/race cards into slots, move or swap cards, and edit a slot’s planned spec. Select-then-place controls also support keyboard and touch. An expanded view gives more room. Each plan can be renamed, duplicated, resized, annotated, or deleted. Undo restores up to 30 board edits during the session; changing the roster or reloading clears undo history. Shrinking a plan is blocked while removed groups contain cards.

Class cards are reusable placeholders with their own class, race, and spec. A class card can be filled by a buddy through its editor. Roster cards keep the roster’s class and race; their planned spec belongs only to this plan. Each roster member can appear at most once per plan. Guild bench members can be selected manually for a particular plan without changing their guild status. Role counts include placeholders and describe this plan, not confirmed attendance.

Plans and the active plan ID are included in the existing local storage and JSON backup. Member IDs now remain stable through normalization and removal so imported plans cannot shift to another buddy. Removed members are cleared from all plans; invalid race/spec choices and duplicate assignments are sanitized on load. Legacy backups receive one empty Raid night board. CSV remains an export of the guild roster. The earlier roster-wide role planner is available below the board.

Raid tests cover stable references, plan persistence, swaps, duplicate prevention, class/race eligibility, per-plan specs, independent copies, bench inclusion, resize protection, and malformed imports.
