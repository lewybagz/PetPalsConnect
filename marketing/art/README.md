# Illustrations

The seven pieces the pages reference, as PNG, 2048px on the long edge:

| File | Where | Ratio |
| --- | --- | --- |
| `hero.png` | landing hero | 4:3 |
| `dog.png` | landing, "matching" cell | 1:1 |
| `park.png` | landing, "somewhere to meet" cell | 1:1 |
| `care.png` | landing care section and `/care` hero | 3:2 |
| `arizona.png` | landing waitlist band and `/where-we-are` hero | 4:3 |
| `safety.png` | landing safety strip and `/safety` hero | 1:1 |
| `install.png` | landing close, and the Open Graph image | 16:9 |

Prompts and the style block are in `.claude/plans/marketing-site-art-prompts.md`.
`npm run art` encodes these into `public/art/`; a piece that is not here yet
renders as a labelled slot, so the page can be built and looked at before
the set is complete.
