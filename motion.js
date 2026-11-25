// Progressive enhancement: chapters stay readable without an observer or CSS animation.
export function initMotion({ document, window }) {
  if (!window.IntersectionObserver || !window.matchMedia) return;
  const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const chapters = [
    ...document.querySelectorAll(
      "#question, #findings, #analysis, #methodology",
    ),
  ];
  const seen = new Set();
  const observer = new window.IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        seen.add(entry.target);
        if (!preference.matches) entry.target.classList.add("scroll-arrival");
        observer.unobserve(entry.target);
      }
    },
    { threshold: 0, rootMargin: "0px 0px -32px 0px" },
  );

  function applyPreference() {
    observer.disconnect();
    for (const chapter of chapters) {
      if (preference.matches) {
        chapter.classList.remove("scroll-arrival");
      } else if (!seen.has(chapter)) {
        // Do not replay an entrance for content already in view or above a deep link.
        if (chapter.getBoundingClientRect().top < window.innerHeight) {
          seen.add(chapter);
        } else {
          observer.observe(chapter);
        }
      }
    }
  }
  applyPreference();
  preference.addEventListener("change", applyPreference);
}
