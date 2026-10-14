# Manual browser regression checklist

Run with a disposable browser profile so existing IndexedDB data is not changed.

## Layout and input

- [ ] Windows Chrome/Edge at 320, 360, 390, 430, 768, and 1024 CSS px: no horizontal overflow, overlap, clipped labels, or missing navigation icons.
- [ ] Measure navigation left/right spacing and interactive control heights; controls are at least 44 CSS px high.
- [ ] Android Chrome at the same widths: bottom navigation respects the safe area and does not cover content or the soft keyboard.
- [ ] Mouse and touch drawing follow the pointer at DPR 1, 2, and 3; rotate the device, then test undo, clear, and redraw.
- [ ] Keyboard navigation shows a visible focus ring; Enter submits once and advances once.

## Speech and OCR

- [ ] Test system voice list arriving late, missing English voice, missing speech synthesis, and online TTS network failure.
- [ ] Tap play repeatedly, stop during playback, switch tabs, and move to the next word; no stale playback continues.
- [ ] Confirm playback status reports completion only after audio ends and reports failures without claiming success.
- [ ] Test OCR CDN load failure, first worker setup, recognition timeout, retry, blank canvas, and low-confidence/mismatched text; edit the prefilled answer before submission.
- [ ] Verify that playback, hints, and OCR alone do not change learning totals.

## Data and plan statistics

- [ ] Complete, partially answer, skip, and quit a plan; refresh and reopen it; confirm state and recorded attempts.
- [ ] Cover done, todo, redo, and unmarked plans; repeated words within a task count once, while the same word in separate tasks counts separately.
- [ ] Do a historical task on a different calendar date; confirm records remain attached to the selected task date.
- [ ] Change the plan date filter; confirm lifetime totals remain unchanged.
- [ ] Confirm existing IndexedDB data remains readable and compare totals against the fixture-based `plan-stats.test.js` cases.
- [ ] Compare the home plan completion count against all 262 task statuses; the home percentage should not change when the plan date filter changes.
- [ ] Verify today's answered/target bar uses the actual daily record and shows a no-target message if no planned word count exists.
- [ ] Filter the plan date range and confirm completed, todo, redo, unmarked, and percentage values all match the visible dates.
- [ ] Cycle one task through each state; only that badge and the summary should update, and the selected date list should not jump or reorder.
- [ ] Reload after changing a status and confirm the same persisted status and progress are shown.

## Motion and status design

- [ ] First page load shows final progress values without animating from zero; later value changes animate smoothly.
- [ ] Change one task status and confirm the local card feedback is brief without moving surrounding cards.
- [ ] Enable the operating system's reduced-motion preference and confirm page, card, metric, and progress animations are disabled or nearly instant.
- [ ] Confirm status text and icons remain understandable with color vision differences and at 320 CSS px.

## Runtime and deployment

- [ ] Check browser console and network errors during refresh, module switching, date changes, dictation, and page reload.
- [ ] Verify GitHub Pages entry and asset paths on the deployed site after an authorized deployment.
