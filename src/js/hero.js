// Types out the hero prompt command, then reveals the headline + bio.
// Progressive enhancement: with no JS or reduced motion, everything is
// already visible (the reveal classes are only added by this script).
export function initHero() {
  const hero = document.querySelector(".hero");
  if (!hero) return;

  const cmd = hero.querySelector(".prompt .cmd");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!cmd || reduce) return;

  const full = cmd.textContent;
  cmd.textContent = "";
  hero.classList.add("is-typing");

  let i = 0;
  const tick = () => {
    cmd.textContent = full.slice(0, i);
    if (i < full.length) {
      i += 1;
      setTimeout(tick, 38);
    } else {
      hero.classList.remove("is-typing");
      hero.classList.add("reveal");
    }
  };
  setTimeout(tick, 250);
}
