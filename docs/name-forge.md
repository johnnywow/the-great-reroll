# Name Forge generation

`data/name-grammar.js` defines race-specific first-name syllables, surname roots,
endings, nouns and humor vocabularies. `js/name-engine.js` combines these into
virtual Cartesian decks; it does not build a giant list of every possible name.
A random offset and coprime step visit each deck entry at most once per engine.
Existing complete jokes in `data/names.js` remain intact alongside generated names.

Serious combines pronounceable race-specific first names with race surnames, or
race/class hybrid surnames when Class Themed is on. Clever selects complete, reviewed wordplay names with a documented reference or
double meaning. It never combines random name halves, occupations, or surnames.
Race and class eligibility tags filter this smaller catalog; Class Themed requires
a class match. Adult mode also uses complete phrases rather than random templates. Silly uses titles,
nicknames, adjectives and comic compounds. Race influences all three modes.
Adult vocabulary is only eligible when that toggle is enabled in a humor mode.
The first and last parts stay alphabetic, at most 14 letters each (29 total with
the space); these are readability limits, not a claim about server naming rules.

Name Forge and the draft's `generateName` wrapper share one engine and history.
Names shown are stored, case-insensitively, in localStorage under
`war-table-name-history-v1`, with no 80-name rolling eviction. Current old-session
history and previously saved favorites are imported when available. Each batch
prefers different first names and surnames; deferred unseen candidates remain
eligible. Exhaustion returns fewer results and a message, never recycled names
or numeric suffixes.

History is local to the browser and origin. Clearing browser data resets it;
other browsers/visitors have independent histories. Sequential tabs merge saved
history before generating; simultaneous tabs do not have a distributed lock.
This is neither a global reservation service nor an in-game availability check.
If storage is blocked or full, in-page protection continues and the UI reports
that it will not survive a reload. Generation itself makes no network requests.

Validation: `node --test tests/name-engine.test.cjs` covers 5,000 names per Serious/Silly style,
all supported race/class/style/toggle combinations, persisted history and reloads,
legacy history, storage failures, exhaustion, per-batch variety, the actual
Name Forge UI/draft-wrapper integration, and exhaustive catalog eligibility and
non-repetition checks for Clever, including after settings changes and exhaustion. Run all tests with
`node --test tests/*.test.cjs`.
