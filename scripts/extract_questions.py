"""Extract PL300_Question_Bank.pdf into src/data/questions.json and validate it.

Usage:  python -I scripts/extract_questions.py <path-to.pdf> [out.json]

Requires `pdftotext` (poppler) on PATH. The PDF has, for each of its 6 sets:
  * "Questions"                 full stem, option texts, select-N hint, case-study text
  * "Answer key"                correct answer(s) and domain per question
  * "Answers and explanations"  topic, a verdict + explanation for EVERY option, concept line

The three parts are parsed separately and cross-checked against each other.
"""
import json
import re
import subprocess
import sys
import tempfile
from collections import Counter
from pathlib import Path

DOMAIN_FULL = {
    "Prepare": "Prepare the data",
    "Model": "Model the data",
    "Visualize": "Visualize and analyze the data",
    "Manage": "Manage and secure Power BI",
}
DOMAINS = list(DOMAIN_FULL.values())
EXPECTED_DOMAIN_COUNTS = {"Prepare the data": 80, "Model the data": 80, "Visualize and analyze the data": 80, "Manage and secure Power BI": 60}
DOMAIN_RE = "|".join(DOMAIN_FULL)

FOOTER = re.compile(r"^PL-300 Practice Question Bank \|.*Page \d+\s*$")
SECTION = re.compile(r"^Set (\d): (Questions|Answer key|Answers and explanations)\s*$")
QUESTION = re.compile(r"^Question (\d+)\s*$")
CASE_HEAD = re.compile(r"^ {2}Case study: (.+?)\s*$")
CASE_RANGE = re.compile(r"\(Questions (\d+) to (\d+)\) refer to this case study")
SELECT = re.compile(r"^Select (one|\d+) answers?\.\s*$")
OPTION = re.compile(r"^([A-E]) (\S.*)$")
KEY_ROW = re.compile(r"(?<!\S)(\d{1,2})\s+([A-E](?:, [A-E])*)\s+(" + DOMAIN_RE + r")(?!\S)")
EXPL_HEAD = re.compile(r"^S(\d)-Q(\d+) (" + DOMAIN_RE + r") \| (.+?)\s*$")
EXPL_OPTION = re.compile(r"^\s+([A-E]) ([✓✗]) (\S.*)$")
CORRECT = re.compile(r"^Correct answer: ([A-E](?:, [A-E])*)\s*$")
CONCEPT = re.compile(r"^Concept: (.+?)\s*$")
WRAP_WIDTH = 90  # a line at least this long is a soft-wrapped line; shorter ones end a paragraph/line


def norm(s):
    return re.sub(r"\s+", " ", s).strip()


def reflow(lines, threshold=WRAP_WIDTH):
    """Join soft-wrapped PDF lines; keep a line break after short lines."""
    out = ""
    for i, line in enumerate(lines):
        out += line
        if i < len(lines) - 1:
            out += "\n" if len(line) < threshold else " "
    return out


CODE_CHARS = re.compile(r"[=()\[\]{}<>/]")
CODE_MARK = "{{code}}"
ROW = re.compile(r"^[A-Z][^:]{2,60}: .* / .* / ")  # "Name: A 1 / B 2 / C 3" result rows in a case study


def looks_like_code(text):
    """DAX/M lines in a stem: short, no sentence punctuation at the end, and containing code symbols."""
    return len(text) < WRAP_WIDTH and not re.search(r"[.?:!]$", text) and bool(CODE_CHARS.search(text))


def build_stem(entries):
    """entries: [(indent, text)]. Returns (stem, code). Code lines become a {{code}} marker in the stem."""
    segments, code_lines, cur = [], [], []  # segments: text lists, or None for the code position
    code_indents = []
    for indent, text in entries:
        if looks_like_code(text):
            if cur:
                segments.append(cur)
                cur = []
            if not segments or segments[-1] is not None:
                segments.append(None)
            code_lines.append(text)
            code_indents.append(indent)
        else:
            cur.append(text)
    if cur:
        segments.append(cur)
    parts = [CODE_MARK if seg is None else reflow(seg) for seg in segments]
    code = None
    if code_lines:
        base = min(code_indents)
        # layout columns are not true spaces: any indentation becomes one level of 4 spaces
        code = "\n".join(("    " if ind > base else "") + line for ind, line in zip(code_indents, code_lines))
    return "\n\n".join(parts), code


def read_text(pdf):
    with tempfile.TemporaryDirectory() as td:
        txt = Path(td) / "bank.txt"
        subprocess.run(["pdftotext", "-enc", "UTF-8", "-layout", str(pdf), str(txt)], check=True)
        raw = txt.read_text(encoding="utf-8")
    return [l.rstrip() for l in raw.splitlines() if not FOOTER.match(l.strip())]


def split_sections(lines):
    sections, cur = {}, None
    for line in lines:
        m = SECTION.match(line.strip())
        if m:
            cur = (int(m.group(1)), m.group(2))
            sections[cur] = []
        elif line.strip() in ("Score tracker", "Index by topic"):
            cur = None
        elif cur:
            sections[cur].append(line)
    return sections


def parse_case_text(lines):
    """Case text: blank-separated paragraphs, bullets and short headings -> clean lines."""
    blocks = []  # each block is [kind, text-lines]
    for raw in lines:
        if not raw.strip():
            continue
        s = raw.strip()
        if s.startswith("•"):
            blocks.append(["bullet", [s]])
        elif raw.startswith("       "):  # bullet continuation (deeper indent)
            blocks[-1][1].append(s)
        else:
            prev = blocks[-1] if blocks else None
            prev_line = prev[1][-1] if prev else ""
            continues = (prev and prev[0] == "para" and len(prev_line) >= WRAP_WIDTH - 10 and prev_line[-1] not in ".:"
                         and not ROW.match(prev_line) and not ROW.match(s))
            if continues:
                prev[1].append(s)
            else:
                blocks.append(["para", [s]])
    return "\n".join(norm(" ".join(b[1])) for b in blocks)


def parse_questions(set_no, lines, cases):
    """Returns {number: dict(stem, options, select)} and registers case studies."""
    questions, current, case_lines, case_head = {}, None, None, None

    def finish_case():
        nonlocal case_lines, case_head
        if case_head is None:
            return
        intro = next((l for l in case_lines if CASE_RANGE.search(l)), "")
        rng = CASE_RANGE.search(intro)
        body = [l for l in case_lines if not CASE_RANGE.search(l)]
        cid = f"c{len(cases) + 1}"
        cases.append({"id": cid, "title": case_head, "text": parse_case_text(body), "set": set_no,
                      "first": int(rng.group(1)), "last": int(rng.group(2))})
        case_lines, case_head = None, None

    for line in lines:
        m = QUESTION.match(line.strip())
        if m and not line.startswith(" "):
            finish_case()
            current = {"number": int(m.group(1)), "stem": [], "options": [], "select": None}
            questions[current["number"]] = current
            continue
        ch = CASE_HEAD.match(line)
        if ch:
            current = None
            case_head, case_lines = ch.group(1), []
            continue
        if case_head is not None:
            case_lines.append(line)
            continue
        if current is None or not line.strip():
            continue
        s = line.strip()
        sm = SELECT.match(s)
        if current["select"] is None:
            if sm:
                current["select"] = 1 if sm.group(1) == "one" else int(sm.group(1))
            else:
                current["stem"].append((len(line) - len(line.lstrip()), s))
        else:
            om = OPTION.match(s) if not line.startswith(" ") else None
            if om:
                current["options"].append([om.group(1), om.group(2)])
            elif current["options"]:
                current["options"][-1][1] += " " + s
    finish_case()
    return questions


def parse_answer_key(lines):
    key = {}
    for line in lines:
        for m in KEY_ROW.finditer(line):
            key[int(m.group(1))] = ([k.strip() for k in m.group(2).split(",")], DOMAIN_FULL[m.group(3)])
    return key


def parse_explanations(set_no, lines, problems):
    """Returns {number: dict(domain, topic, correct, options{key: (mark, text, expl)}, concept)}."""
    blocks, cur = [], None
    for line in lines:
        m = EXPL_HEAD.match(line.strip())
        if m:
            cur = {"set": int(m.group(1)), "number": int(m.group(2)), "domain": DOMAIN_FULL[m.group(3)],
                   "topic": m.group(4), "lines": []}
            blocks.append(cur)
        elif cur is not None:
            cur["lines"].append(line)
    return blocks


def parse_expl_block(block, option_text, problems):
    """Split a block into correct keys, per-option (mark, explanation) and concept."""
    ref = f"S{block['set']}-Q{block['number']:02d}"
    lines = [l for l in block["lines"] if l.strip()]
    correct, concept, opts, i = None, None, {}, 0
    while i < len(lines):
        s = lines[i].strip()
        cm = CORRECT.match(s)
        if cm:
            correct = [k.strip() for k in cm.group(1).split(",")]
            i += 1
            continue
        km = CONCEPT.match(s)
        if km:
            concept = km.group(1)
            i += 1
            continue
        om = EXPL_OPTION.match(lines[i])
        if om:
            key, mark, text = om.group(1), om.group(2), om.group(3).strip()
            i += 1
            full = option_text.get(key)
            # The option text may wrap onto following lines, and long options are cut off with "..."
            # in this section. Consume lines until the text is complete or ends with the cut-off marker.
            def is_prefix(t):
                return norm(full).startswith(norm(t).removesuffix("...").rstrip())

            while (full is not None and norm(text) != norm(full) and not norm(text).endswith("...")
                   and is_prefix(text) and i < len(lines) and not EXPL_OPTION.match(lines[i])):
                text += " " + lines[i].strip()
                i += 1
            if full is not None and not (norm(text) == norm(full) or (norm(text).endswith("...") and is_prefix(text))):
                problems.append(f"{ref}: option {key} text differs between questions and explanations")
            expl = []
            while i < len(lines) and not EXPL_OPTION.match(lines[i]) and not CONCEPT.match(lines[i].strip()):
                expl.append(lines[i].strip())
                i += 1
            opts[key] = (mark == "✓", norm(" ".join(expl)))
            continue
        i += 1  # truncated stem preview and other lines
    return correct, opts, concept


def main():
    pdf = Path(sys.argv[1])
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("src/data/questions.json")
    lines = read_text(pdf)
    sections = split_sections(lines)
    problems, cases, questions = [], [], []

    for set_no in range(1, 7):
        qs = parse_questions(set_no, sections[(set_no, "Questions")], cases)
        key = parse_answer_key(sections[(set_no, "Answer key")])
        expl = {b["number"]: b for b in parse_explanations(set_no, sections[(set_no, "Answers and explanations")], problems)}
        if len(qs) != 50 or len(key) != 50 or len(expl) != 50:
            problems.append(f"Set {set_no}: questions={len(qs)} key={len(key)} explanations={len(expl)} (expected 50 each)")
        set_cases = [c for c in cases if c["set"] == set_no]

        for n in sorted(qs):
            q = qs[n]
            ref = f"S{set_no}-Q{n:02d}"
            if n not in expl or n not in key:
                problems.append(f"{ref}: missing explanation or answer key")
                continue
            b = expl[n]
            option_text = {k: norm(t) for k, t in q["options"]}
            correct, opt_expl, concept = parse_expl_block(b, option_text, problems)
            key_correct, key_domain = key[n]
            ticks = sorted(k for k, (ok, _) in opt_expl.items() if ok)
            if correct != key_correct:
                problems.append(f"{ref}: explanation says {correct}, answer key says {key_correct}")
            if ticks != sorted(correct or []):
                problems.append(f"{ref}: tick marks {ticks} differ from correct answer {correct}")
            if b["domain"] != key_domain:
                problems.append(f"{ref}: domain {b['domain']} vs answer key {key_domain}")
            if sorted(opt_expl) != sorted(option_text):
                problems.append(f"{ref}: options {sorted(option_text)} vs explained {sorted(opt_expl)}")
            if q["select"] != len(correct or []):
                problems.append(f"{ref}: select hint {q['select']} vs {len(correct or [])} correct answers")
            case = next((c for c in set_cases if c["first"] <= n <= c["last"]), None)
            if (case is not None) != (b["topic"].startswith("Case study:") or " | Case: " in b["topic"]):
                problems.append(f"{ref}: case-study membership disagrees with topic '{b['topic']}'")
            # Sets 4-5 print "<skill topic> | Case: <title>"; sets 1-3 only "Case study: <title>".
            topic = b["topic"].split(" | Case: ")[0]

            stem, code = build_stem(q["stem"])
            questions.append({
                "id": f"s{set_no}q{n:02d}",
                "number": len(questions) + 1,
                "set": set_no,
                "setNumber": n,
                "domain": b["domain"],
                "topic": topic,
                "type": "single" if len(correct) == 1 else "multi",
                "caseId": case["id"] if case else None,
                "stem": stem,
                "code": code,
                "options": [
                    {"key": k, "text": norm(t), "explanation": opt_expl[k][1] if k in opt_expl else None}
                    for k, t in q["options"]
                ],
                "correct": correct,
                "explanation": "",
                "reference": concept,
            })

    case_out = [{"id": c["id"], "title": c["title"], "text": c["text"]} for c in cases]
    data = {
        "meta": {
            "source": "PL-300 Practice Question Bank (300 original questions, 6 sets, 5 case studies)",
            "notes": "id is s<set>q<number in set>. Every option carries its own explanation; 'reference' holds the Concept line.",
        },
        "domains": DOMAINS,
        "cases": case_out,
        "questions": questions,
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    # ---- validation report ----
    dc = Counter(q["domain"] for q in questions)
    multi = [q["id"] for q in questions if q["type"] == "multi"]
    if len(questions) != 300:
        problems.append(f"expected 300 questions, got {len(questions)}")
    for d, n in EXPECTED_DOMAIN_COUNTS.items():
        if dc[d] != n:
            problems.append(f"domain {d}: expected {n}, got {dc[d]}")
    if len(multi) != 12:
        problems.append(f"expected 12 multi-select questions, got {len(multi)}")
    if len(case_out) != 5:
        problems.append(f"expected 5 case studies, got {len(case_out)}")
    for q in questions:
        if not q["correct"]:
            problems.append(f"{q['id']}: no correct answer")
        for o in q["options"]:
            if not o["explanation"]:
                problems.append(f"{q['id']}{o['key']}: missing option explanation")
        if len(q["options"]) < 3 or not q["stem"]:
            problems.append(f"{q['id']}: bad stem/options")

    print("VALIDATION REPORT")
    print(f"  questions extracted : {len(questions)} (expected 300)")
    for d in DOMAINS:
        print(f"  {d:34s}: {dc[d]} (expected {EXPECTED_DOMAIN_COUNTS[d]})")
    print(f"  multi-select        : {len(multi)} (expected 12)  {multi}")
    print(f"  case studies        : {len(case_out)} (expected 5), questions: {sum(1 for q in questions if q['caseId'])}")
    print(f"  options             : {sum(len(q['options']) for q in questions)}, with explanation: "
          f"{sum(1 for q in questions for o in q['options'] if o['explanation'])}")
    print(f"  code snippets       : {sum(1 for q in questions if q['code'])} {[q['id'] for q in questions if q['code']]}")
    print(f"  with reference      : {sum(1 for q in questions if q['reference'])}")
    print(f"  topics              : {len({q['topic'] for q in questions})}")
    print(f"  problems            : {len(problems)}")
    for p in problems[:60]:
        print("    " + p)
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
