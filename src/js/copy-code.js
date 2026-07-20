// Adds a language tab and a "copy" button to every code block in a post body.
export function enhanceCodeBlocks() {
  const blocks = document.querySelectorAll("article .body pre");
  blocks.forEach((pre) => {
    if (pre.dataset.enhanced) return;
    pre.dataset.enhanced = "true";

    if (pre.dataset.lang) {
      const lang = document.createElement("span");
      lang.className = "code-lang";
      lang.textContent = pre.dataset.lang;
      pre.appendChild(lang);
    }

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "copy-btn";
    btn.textContent = "copy";
    btn.setAttribute("aria-label", "Copy code to clipboard");

    btn.addEventListener("click", async () => {
      const text = pre.cloneNode(true);
      text.querySelectorAll(".copy-btn, .code-lang").forEach((n) => n.remove());
      try {
        await navigator.clipboard.writeText(text.innerText.trimEnd());
        btn.textContent = "copied";
      } catch {
        btn.textContent = "error";
      }
      setTimeout(() => (btn.textContent = "copy"), 1500);
    });

    pre.appendChild(btn);
  });
}
