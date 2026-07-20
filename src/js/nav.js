// Marks the header nav link matching the current path as active.
export function markActiveNav() {
  const path = window.location.pathname;
  const links = document.querySelectorAll("nav.links a");

  links.forEach((a) => {
    const href = a.getAttribute("href");
    if (!href || href.startsWith("http")) return;

    const isHome = href === "/" && (path === "/" || path.startsWith("/posts/"));
    const isSection = href !== "/" && path.startsWith(href);

    if (isHome || isSection) a.classList.add("active");
  });
}
