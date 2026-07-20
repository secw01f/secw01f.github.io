// Cmd-K / Ctrl-K command palette to jump between posts.
// Reads the build-injected #site-index JSON; any [data-cmdk] element opens it.
export function initPalette() {
  const el = document.getElementById("site-index");
  if (!el) return;

  let index = [];
  try {
    index = JSON.parse(el.textContent);
  } catch {
    return;
  }
  if (!Array.isArray(index) || index.length === 0) return;

  const overlay = document.createElement("div");
  overlay.className = "cmdk-overlay";
  overlay.innerHTML = `
    <div class="cmdk" role="dialog" aria-modal="true" aria-label="Search posts">
      <input class="cmdk-input" type="text" placeholder="jump to a post…" aria-label="Search posts">
      <ul class="cmdk-list"></ul>
    </div>`;
  document.body.appendChild(overlay);

  const input = overlay.querySelector(".cmdk-input");
  const list = overlay.querySelector(".cmdk-list");
  let active = 0;

  const esc = (s) =>
    String(s).replace(/[&<>"]/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
    })[c]);

  function render(query) {
    const q = query.trim().toLowerCase();
    const matches = index.filter((post) => {
      if (!q) return true;
      const hay = `${post.title} ${post.type} ${(post.tags || []).join(" ")}`;
      return hay.toLowerCase().includes(q);
    });
    active = 0;

    if (matches.length === 0) {
      list.innerHTML = `<li class="cmdk-empty">no matches</li>`;
      return;
    }
    list.innerHTML = matches
      .map(
        (post, i) =>
          `<li class="cmdk-item${i === 0 ? " active" : ""}" role="option" data-url="/posts/${post.id}/">
            <span>${esc(post.title)}</span><span class="t">${esc(post.type)}</span>
          </li>`
      )
      .join("");
  }

  const items = () => Array.from(list.querySelectorAll(".cmdk-item"));

  function move(delta) {
    const nodes = items();
    if (!nodes.length) return;
    active = (active + delta + nodes.length) % nodes.length;
    nodes.forEach((n, i) => n.classList.toggle("active", i === active));
    nodes[active].scrollIntoView({ block: "nearest" });
  }

  function go() {
    const node = items()[active];
    if (node) window.location.href = node.dataset.url;
  }

  const isOpen = () => overlay.classList.contains("open");
  function open() {
    overlay.classList.add("open");
    input.value = "";
    render("");
    input.focus();
  }
  function close() {
    overlay.classList.remove("open");
  }

  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      isOpen() ? close() : open();
      return;
    }
    if (!isOpen()) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      move(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      move(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      go();
    }
  });

  input.addEventListener("input", () => render(input.value));
  list.addEventListener("click", (e) => {
    const item = e.target.closest(".cmdk-item");
    if (item) window.location.href = item.dataset.url;
  });
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  document
    .querySelectorAll("[data-cmdk]")
    .forEach((btn) => btn.addEventListener("click", open));
}
