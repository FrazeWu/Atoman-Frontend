# Papers source diagnostics

Source checks run locally in CodeMirror for TeX and LTX documents, after a
420 ms idle debounce. They check explicit brace and environment pairing,
empty or duplicate literal reference definitions, and literal input or
bibliography paths against the current manifest. Comments, escaped tokens
and supported literal environments are masked while preserving offsets.
The checks never save, compile, call a model, or modify the document.

The optional project reference check reads other relevant saved text files
through the normal project API, with a project/account/file/revision fence,
a final project revision check, a 4 MiB read budget and a 100-file limit.
Only literal label and bibliography keys are retained in the editor. A
change to the other-file manifest invalidates that catalog. Missing static
definitions are warnings, not proof of a broken reference. Macros, external
bibliographies, conditional TeX and alternative document roots can make
otherwise valid sources look incomplete to a static scanner.

At most 80 local findings and 12 current, sanitized compile diagnostics
are marked. Current compile diagnostics are added only when the workspace
has a matching saved source revision; all markers clear synchronously on
source changes and are recomputed after the debounce. Collaborative edits
use the same local checks without ordinary save calls. Cross-file scans
and compiler markers are not enabled in live collaboration mode.

Static diagnostics never block editing, saving, or compiling. TeX engine
results remain authoritative. The UI does not expose raw server logs.
