// Tag filter for the home feed. Chips carry data-tag; entries carry
// data-tags (space-separated). Single-select; "*" shows everything.
export function initFilter() {
  const bar = document.getElementById("filter-bar");
  if (!bar) return;

  const entries = Array.from(document.querySelectorAll(".feed .entry"));

  bar.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;

    bar
      .querySelectorAll(".chip")
      .forEach((c) => c.classList.toggle("active", c === chip));

    const tag = chip.dataset.tag;
    entries.forEach((entry) => {
      const tags = (entry.dataset.tags || "").split(" ").filter(Boolean);
      const show = tag === "*" || tags.includes(tag);
      entry.classList.toggle("hidden", !show);
    });
  });
}
