# Guild Hall roster planner

Open `/guild-hall/`, or choose Guild Hall from the War Table homepage. The page source lives in `guild-hall/index.html`; the former `/guild-hall.html` URL forwards to the clean address, preserving query strings and fragments. A relative base URL keeps shared scripts, styles, images, and home links working from the nested route. Browser storage remains on the same origin and key, preserving rosters and raid plans. The previous two-stage roster draft remains available from the Roster draft link (`/?guild-draft=1`).

## Planning model

- One member record represents a character; `playerId` links multiple characters to one friend. Each player has exactly one `isMain` character and a shared player name. Old records receive distinct stable player IDs, even when names match. Players can add an alt, link an existing character in Details, separate a character into a new player, or choose a different main. Classes, races, and specs can remain undecided. Removing a main promotes a surviving alt; deleting a character clears only that character’s plan placements.
- Race eligibility, class colors, class icons, artwork, and spec labels reuse `data/characters.js`. These are the site's current planning assumptions, not a claim that current game rules or spec viability have been independently verified.
- Main characters count once in the active roster role totals. Linked alts and selected backup specs are shown as additional options, deduplicated by player. Bench members are excluded from all coverage and lineup calculations.
- Spec coverage lists primary assignments, explicit backups, and all active members of that class as potential options. Potential counts overlap; they are not additive.
- Lineups use maximum bipartite matching between active members and customizable role slots. Each person can fill at most one slot across all their characters. The primary/backup mode allows any class spec when the primary is undecided; all-class mode explores every available class spec. Spec suggestions outside declared primary/backup choices are marked for confirmation. This is a role feasibility planner, not an optimized buff, performance, or raid-balance simulation.
- Applying a roster-wide suggested lineup makes each selected character the player’s main, updates its primary spec, and retains old specs as backups. Members outside the lineup keep their current status and assignments.

## Persistence

The browser stores one working roster at `war-table-guild-roster-v1`. JSON backup/import allows transfer or sharing; CSV provides a readable export. This version has no account service or shared real-time edits. Invalid backup structures, future versions, excessive member counts, and excessive total targets are rejected. Cross-tab edits pause saving to avoid overwriting another tab.

Limits: 100 characters, 100 target slots, 80-character names, 500-character notes, and a 1 MB import file size. Dynamic text is escaped before rendering. CSV formula prefixes are neutralized.

## Verification

Run `node --test tests/*.test.cjs`. Guild coverage tests include competing flexible roles, bench exclusion, declared vs. potential availability, import normalization, safe CSV output, backup roundtrips, and 100 distinct assigned members.

## Interface

Guild Hall uses three keyboard-accessible views: Roster, Raid board, and Spec coverage. The roster groups editable character cards beneath a larger player portrait and name. A current-plan summary opens the board, and the main-roster role summary distinguishes main coverage from alt/backup options. The layout adapts to narrow screens. Status is editable directly, while Details reveals backup specs and notes. Guild name and faction live in the guild settings dialog. New rosters see a short onboarding state instead of empty metrics. Coverage defaults to classes with active members; missing classes and count explanations are opt-in controls. The same storage key and backup format preserve existing rosters.

Player names appear in the group header above their editable main and alternate character cards. Search matches either name, and coverage and lineup details identify both. Paste names accepts either player names (default) or character names. Existing `name` fields remain character names; the optional `playerName` field is included in JSON backups and has its own CSV column. Old backups load with blank player names.

## Saved raid boards

The Raid board tab stores up to 20 named compositions with 5, 10, 20, 25, or 40 slots grouped in fives. Players can drag roster members or class/race cards into slots, move or swap cards, and edit a slot’s planned spec. Select-then-place controls also support keyboard and touch. An expanded view gives more room. Each plan can be renamed, duplicated, resized, annotated, or deleted. Undo restores up to 30 board edits during the session; changing the roster or reloading clears undo history. Shrinking a plan is blocked while removed groups contain cards.

Class cards are reusable placeholders with their own class, race, and spec. A class card can be filled by a buddy through its editor. Roster cards keep the roster’s class and race; their planned spec belongs only to this plan. Each person can appear at most once per plan, across all their linked characters. Used friends and their alts are disabled in the palette; edit the existing board card to change characters. Imports and explicit roster relinking retain the first placement when two characters belong to the same person; the linking UI warns before removing duplicate placements. Guild bench members can be selected manually for a particular plan without changing their guild status. Role counts include placeholders and describe this plan, not confirmed attendance.

Plans and the active plan ID are included in the existing local storage and JSON backup. Member IDs now remain stable through normalization and removal so imported plans cannot shift to another buddy. Removed members are cleared from all plans; invalid race/spec choices and duplicate assignments are sanitized on load. Legacy backups receive one empty Raid night board. CSV remains an export of the guild roster. The earlier roster-wide role planner is available below the board.

Raid tests cover stable references, plan persistence, swaps, duplicate prevention, class/race eligibility, per-plan specs, independent copies, bench inclusion, resize protection, and malformed imports.

## Live lineup guidance

Each plan owns editable Tank, Healer, Melee, and Ranged targets. Starting mixes depend on group size and are planning suggestions, not official raid requirements. Targets may total less than the size for flexible spots, but cannot exceed it. Choosing a new group size in the settings resets the suggested mix. Targets persist in backups and duplicated plans.

Guidance counts real assigned players; class placeholders do not fill player-role gaps. For a missing role, it considers active characters’ primary/backup specs and flexible undecided characters. Unplaced bench characters are excluded; an already placed player can explore their other characters. Options for the same friend overlap. No suggestions claim actual attendance, buff optimization, or damage performance.

Show options (or select an open role) to highlight candidate roster cards and preview a specific change. Previews show character/spec, destination, role counts before and after, and gaps introduced by a switch. They may fill an empty slot or replace a class placeholder, and never replace another friend. A friend already placed is updated in their existing slot. Apply affects only this plan, is revalidated, and supports board Undo. Direct card edits show the same role impact.

Run `node --test tests/*.test.cjs`. Friend/alt tests cover legacy migration, name collisions, unique mains, stable IDs, deletion, one-person matching/placement, coverage deduplication, placeholder semantics, backup choices, tradeoffs, bench and undecided behavior, stale previews, and independent plan targets. Desktop and mobile browser QA covers alt creation, main switching, name edits, search, slot switching, previews, Undo, reload, tap-to-place, and native drag-and-drop.
