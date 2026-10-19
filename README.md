# PL-300 Practice

A client-side practice app for the Microsoft **PL-300 (Power BI Data Analyst)** exam, built on a bank of **300 questions** (4 domains, 5 case studies, 12 multi-select items, an explanation for every option). It has a practice mode with instant feedback, a timed exam mode, proportional domain sampling, a review screen and local progress tracking. React + Vite + TypeScript + Tailwind CSS v4, no backend, deployable as a static site.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (Vitest)
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build locally
```

Requires Node 20+.

## The question bank

`src/data/questions.json` is generated from `PL300_Question_Bank.pdf` by `scripts/extract_questions.py` and checked on every extraction and in `src/data/bank.test.ts`:

| Item | Result |
| --- | --- |
| Questions | 300 (6 sets of 50) |
| Domains | Prepare 80 / Model 80 / Visualize 80 / Manage 60 |
| Multi-select | 12 (10 × "select 2", 2 × "select 3") |
| Case studies | 5, five questions each (Contoso Retail, Fabrikam Logistics, Wingtip Toys performance, Northwind Outfitters, Tailspin Wholesale) |
| Options with their own explanation | 1212 of 1212 |
| Code snippets (DAX / Power Query M) | 4 questions, shown in monospace blocks with a copy button |

How the PDF is turned into data (the PDF has three parts per set, all parsed and cross-checked):

- **Questions**: full stem, option texts, "select N answers" hint, and the case-study text.
- **Answer key**: correct answers and domain.
- **Answers and explanations**: topic, a ✓/✗ verdict plus explanation for *each* option, and the "Concept" line (stored as `reference`). Long options are cut off with "..." in this part, so the full option text always comes from the Questions part.

The extractor fails (non-zero exit) if anything disagrees: the correct answer must match between the key, the explanation and the ✓ marks, the domain must match, the select hint must equal the number of correct answers, every option must be explained, and the totals (300 / 80-80-80-60 / 12 / 5) must hold.

Notes and decisions:

- **Topics** are the skill-outline topics printed in the PDF (for example "Create reports", "Transform and load the data"). For the case-study questions in sets 1-3 the PDF only prints "Case study: <name>", so that is their topic; sets 4-5 print a real topic, which is used.
- **Option explanations**: in practice mode and in the review, every option shows its own explanation after you check. The question-level `explanation` field is empty for this bank; the UI then shows only the "Concept" line below the options.
- **Code**: code lines are detected by shape (short lines without sentence punctuation that contain code symbols) because the PDF does not mark them reliably; the extractor prints which questions have code (`s1q12`, `s3q32`, `s4q01`, `s5q29`) and the test pins that list. In the stem the snippet sits at a `{{code}}` marker so it appears where it does in the PDF. Code indentation is normalised to one level of 4 spaces.
- **Case studies**: if a quiz includes case questions, those of one case stay together (in the original order) and the case text is shown in a collapsible panel above each of them. When you pick fewer questions than exist, a case may be included only partly; the case text is still shown for each of its questions. You can exclude case-study questions in the setup.
- **IDs** are `s<set>q<number in set>` (for example `s4q42`), and `number` is the overall position 1-300.
- **Weights come from the data**: proportional sampling uses how many questions each domain has (80/80/80/60, the official 27/27/27/20 split of the bank), so asking for 30 gives 8/8/8/6.

**To use a different bank**, replace `src/data/questions.json` with the same schema (below). Domains, counts, case studies and home-screen stats are derived from the file. Update `src/data/bank.test.ts`, which pins the numbers of this bank.

### Re-extracting from the PDF

```bash
python -I scripts/extract_questions.py "path/to/PL300_Question_Bank.pdf"
```

Needs Python 3 and `pdftotext` (poppler) on the PATH. It writes `src/data/questions.json` and prints a validation report.

## Features

- **Practice mode**: *Check answer*, then correct/wrong colouring, the correct answer(s) and an explanation under **every** option, then *Next*.
- **Exam mode**: no feedback, free navigation, flagging, an overview grid, and a confirmation dialog listing unanswered questions before *Finish*. Default pace 1 min 40 s per question as a countdown (auto-finishes at 0).
- **Quiz setup**: domain checkboxes, a number slider/input with presets (10, 25, 50, All), a live distribution preview, shuffle questions/options, optional timer, include/exclude case studies, and three question sources: random mix, **weak areas** (questions you missed come first, worst first, then ones you have not answered) and **missed last time**.
- **Proportional sampling**: the requested count is split across the selected domains with the **largest-remainder method**, so it always sums to exactly the requested number and never exceeds a domain's availability. Questions are picked at random within each domain.
- **Results**: score, percentage, pass/fail at 70%, an *estimated* scaled score, per-domain bars, weak topics, a filterable review (All / Wrong / Correct / Flagged / Unanswered), retry-missed, JSON export and a printable view.
- **Persistence (no account)**: an unfinished quiz survives a refresh; attempt history (last 100), per-question statistics, a progress dashboard (score trend, domain accuracy, weakest topics) and **Reset all data** with confirmation. Data lives in `localStorage` (`pl300.v1.*` keys) and is **mirrored to IndexedDB**; if the browser wipes localStorage but keeps IndexedDB, it is restored on the next start. The app also asks the browser for persistent storage so it is not evicted automatically.
- **Backup / restore**: *Progress → Your data* exports a JSON backup and imports one. Import **merges** (attempts united by id, the most recent per-question statistic wins, nothing is overwritten), so it is also how you move progress between your phone and computer. A banner warns when the browser blocks storage (private mode) or you are in an in-app browser (chat/social apps), whose storage is separate and easily wiped.
- **UX**: Power BI inspired navy/gold identity, light and dark themes (follows the system until you toggle), responsive layout, semantic HTML, ARIA roles, focus rings, reduced-motion support.
- **Keyboard**: `A`-`E` select, `Enter` check/next, `←`/`→` navigate, `F` flag.

### Notes on behaviour

- A multi-select question is correct only when the selected set equals the correct set (no partial credit). Unanswered questions count as wrong.
- The scaled score is `percentage × 10`, floored at 100. The real exam is scored 100-1000 with 700 to pass and Microsoft does not publish the conversion, so it is labelled an estimate.
- The timer only counts while the tab is visible.
- Switching to Exam mode turns the timer on by default; switching to Practice turns it off. You can override either.
- Per-question statistics only count questions you actually answered.
- Storage is per browser **and per address**: `localhost:5173`, `localhost:5174` and the published `github.io` site each start empty, as do other browsers and devices. Without a server there is no automatic sync between them; use the backup file.
- Option order is shuffled per quiz; explanations never refer to options by letter, so shuffling is safe. The A-E letters you see are display positions.

## Data schema

`src/data/questions.json`:

```jsonc
{
  "domains": ["Prepare the data", "Model the data", "Visualize and analyze the data", "Manage and secure Power BI"],
  "cases": [{ "id": "c1", "title": "Contoso Retail", "text": "..." }],
  "questions": [{
    "id": "s1q01", "number": 1, "set": 1, "setNumber": 1,
    "domain": "Model the data", "topic": "Time intelligence and advanced DAX",
    "type": "single",                       // "single" | "multi"
    "caseId": null,                         // or a case id
    "stem": "...", "code": null,            // code: DAX / M snippet in a monospace block, placed at {{code}} in the stem
    "options": [{ "key": "A", "text": "...", "explanation": "..." }],
    "correct": ["D"],
    "explanation": "",                      // optional question-level explanation
    "reference": "DATATABLE function"       // concept / link, optional
  }]
}
```

## Project structure

```
scripts/extract_questions.py   PDF -> questions.json + validation report
src/
  data/        questions.json, bank.ts (typed access), bank integrity test
  lib/         distribution (largest remainder), select (picking/ordering), scoring,
               storage, router, export, format, rng  (+ unit tests)
  state/       AppState.tsx   session reducer, history, stats, theme
  i18n/        en.ts strings, index.ts t()/tn() helpers
  components/  Layout, ui primitives, question parts, charts
  screens/     Home, Setup, Quiz, Results, History
```

All UI strings live in `src/i18n/en.ts` (plural keys use `_one` / `_other`). To translate, add a sibling file with the same keys and point `strings` in `src/i18n/index.ts` at it.

## Tests

`npm test` runs Vitest (50 tests):

- `distribution.test.ts`: sums exactly, per-domain availability, floor/ceil of each quota for **every** subset of domains and **every** request size on both the 300-question layout (80/80/80/60) and a 13/15/15/7 layout, plus 500 random pools, ties and edge cases.
- `select.test.ts`: exact counts for every N from 1 to 300 without duplicates, proportionality (30 → 8/8/8/6, 300 → 80/80/80/60), single/two-domain pools, small counts (5, 7), bank order when not shuffling, the *wrong* source and the *weak* source (missed questions first, worst miss rate first, then unseen, then mastered), case-study clustering and exclusion on the real bank, option shuffling.
- `scoring.test.ts`: exact-set grading for multi-select, pass mark at exactly 70%, scaled estimate, domain totals, weak topics, statistics.
- `bank.test.ts`: integrity of the extracted bank (counts, keys, option explanations, cases, code snippets, no leaked page footers).

## Deploy

The build uses relative asset paths (`base: './'`) and hash routing, so the same `dist/` works at a domain root or under a sub-path with no server rewrites.

**GitHub Pages**: `.github/workflows/deploy.yml` builds and publishes on every push to `main`. In the repository go to *Settings → Pages → Build and deployment → Source: GitHub Actions*. If this project is a sub-folder of a larger repo, move the workflow to the repo root and set `working-directory`/paths accordingly.

**Netlify**: build command `npm run build`, publish directory `dist`.

**Vercel**: framework preset *Vite* (build `npm run build`, output `dist`).

To force a specific base path, build with `VITE_BASE=/my-repo/ npm run build`.

## Disclaimer

Independent practice tool, not affiliated with or endorsed by Microsoft. The questions are original practice material and are not real exam questions.
