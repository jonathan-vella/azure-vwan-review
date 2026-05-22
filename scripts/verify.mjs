#!/usr/bin/env node
// Anchor-resolution check for the VWAN Review pack.
// Matches GitHub's heading-slug rules (does NOT collapse whitespace).
// Skips link-looking patterns inside inline-code spans.
//
// Exit codes:
//   0 — all anchors resolve
//   1 — at least one broken anchor or missing file

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(new URL(".", import.meta.url).pathname, "..");
const FILES = [
  "README.md",
  "01-vwan-review-checklist.md",
  "02-vwan-review-addendum.md",
  "03-vwan-waf-cheatsheet.md",
  "prompts/README.md",
  "prompts/00-blueprint.prompt.md",
  "prompts/refresh-sources.prompt.md",
  "prompts/add-or-update-control.prompt.md",
  "prompts/verify-pack.prompt.md",
];

// GitHub-compatible heading slug: lowercase, drop non `\w\s-`, replace each
// whitespace char with `-` (do NOT collapse — that's why " — " or " & "
// produce "--" in the resulting slug).
const slug = (heading) =>
  heading
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s/g, "-");

// Strip inline-code spans (single `...`) and fenced code blocks so we don't
// mistake template placeholders for real links.
function stripCode(src) {
  let out = "";
  let inFence = false;
  for (const line of src.split("\n")) {
    if (/^```/.test(line)) {
      inFence = !inFence;
      out += "\n";
      continue;
    }
    if (inFence) {
      out += "\n";
      continue;
    }
    out += line.replace(/`[^`]*`/g, " ") + "\n";
  }
  return out;
}

const anchors = {};
for (const rel of FILES) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    console.error(`MISSING FILE: ${rel}`);
    process.exit(1);
  }
  const src = fs.readFileSync(abs, "utf8");
  const set = new Set();
  for (const m of src.matchAll(/^#{1,6}\s+(.+?)\s*$/gm)) set.add(slug(m[1]));
  anchors[rel] = set;
}

let bad = 0;
for (const rel of FILES) {
  const raw = fs.readFileSync(path.join(ROOT, rel), "utf8");
  const src = stripCode(raw);
  const dir = path.dirname(rel);
  for (const m of src.matchAll(/\]\(([^)]+)\)/g)) {
    const target = m[1].trim();
    if (/^(https?:|mailto:|#)/.test(target) || target.startsWith("<")) continue;
    let [file, frag] = target.split("#");
    if (!file) file = rel;
    // Resolve relative to the source file's directory, then make repo-relative.
    const resolvedAbs = path.resolve(ROOT, dir, file);
    const repoRel = path.relative(ROOT, resolvedAbs);
    if (!frag) {
      // Plain file link — just confirm the file exists in the repo.
      if (!fs.existsSync(resolvedAbs) || repoRel.startsWith("..")) {
        console.error(`MISS-FILE ${rel} -> ${target}`);
        bad++;
      }
      continue;
    }
    const known = anchors[repoRel];
    if (!known) {
      console.error(`MISS-FILE ${rel} -> ${target} (resolved: ${repoRel})`);
      bad++;
      continue;
    }
    if (!known.has(frag)) {
      console.error(`MISS-ANCHOR ${rel} -> ${repoRel}#${frag}`);
      bad++;
    }
  }
}

if (bad === 0) {
  console.log(`OK: ${FILES.length} files, all anchors resolve.`);
  process.exit(0);
} else {
  console.error(`FAIL: ${bad} broken anchor(s) / missing file(s).`);
  process.exit(1);
}
