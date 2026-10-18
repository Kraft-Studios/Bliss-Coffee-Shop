(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hero = document.getElementById("hero");
  var heart = document.getElementById("heart");

  /* ---------- Nav scroll state ---------- */
  // On the homepage the hero stays pinned full-screen for a long scroll run,
  // so the nav should only go solid once that pinned run has actually
  // finished. Pages without a hero just use a small fixed threshold.
  var nav = document.getElementById("nav");
  var onScroll = function () {
    var threshold = hero ? Math.max(40, hero.offsetHeight - window.innerHeight - 10) : 40;
    if (window.scrollY > threshold) nav.classList.add("is-scrolled");
    else nav.classList.remove("is-scrolled");
  };
  document.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  onScroll();

  /* ---------- Mobile menu ---------- */
  var toggle = document.getElementById("navToggle");
  var mobile = document.getElementById("navMobile");
  toggle.addEventListener("click", function () {
    var open = toggle.classList.toggle("is-open");
    mobile.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
  mobile.querySelectorAll("a").forEach(function (a) {
    a.addEventListener("click", function () {
      toggle.classList.remove("is-open");
      mobile.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });

  /* ---------- Word-level stagger for statement (hero/heart handled separately) ---------- */
  var wordGroups = document.querySelectorAll(".statement__text");
  wordGroups.forEach(function (group) {
    group.querySelectorAll(".reveal-word").forEach(function (word, i) {
      word.style.setProperty("--wd", (i * 0.045) + "s");
    });
  });

  /* ---------- Scroll reveal (everything except the pinned hero/heart sections) ---------- */
  // Word spans are clipped inside an overflow:hidden ancestor while translated
  // out of view, so they can never self-report as intersecting, observe their
  // (unclipped) container instead and reveal all child words together.
  var revealTargets = Array.prototype.filter.call(
    document.querySelectorAll(".reveal, .reveal-scale"),
    function (el) { return !el.closest("#hero") && !el.closest("#heart"); }
  );
  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealTargets.forEach(function (el) { el.classList.add("is-visible"); });
    wordGroups.forEach(function (group) {
      group.querySelectorAll(".reveal-word").forEach(function (w) { w.classList.add("is-visible"); });
    });
  } else {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.18, rootMargin: "0px 0px -6% 0px" }
    );
    revealTargets.forEach(function (el) { io.observe(el); });

    var wordIo = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.querySelectorAll(".reveal-word").forEach(function (w) {
              w.classList.add("is-visible");
            });
            wordIo.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    wordGroups.forEach(function (group) { wordIo.observe(group); });
  }

  /* ---------- Shared pinned-scroll helpers ----------
     Used by any full-screen "sticky" section (hero, heart): 0 at the moment
     the section starts pinning, 1 exactly when it releases back into normal
     scroll, independent of how far down the page the section sits. */
  function pinnedProgress(sectionEl) {
    var rect = sectionEl.getBoundingClientRect();
    var range = sectionEl.offsetHeight - window.innerHeight;
    if (range <= 0) return rect.top <= 0 ? 1 : 0;
    return Math.min(1, Math.max(0, -rect.top / range));
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  // seg: { el, start, end, current, mode: "word" | "zoom" | "fade" }
  function applyPop(seg) {
    var c = seg.current;
    var el = seg.el;
    if (seg.mode === "word") {
      el.style.opacity = c;
      el.style.transform = "translateY(" + (1 - c) * 55 + "%) scale(" + (0.94 + c * 0.06) + ")";
    } else if (seg.mode === "sideRight") {
      el.style.opacity = c;
      el.style.transform = "translateX(" + (1 - c) * 70 + "px)";
    } else if (seg.mode === "sideLeft") {
      el.style.opacity = c;
      el.style.transform = "translateX(" + (1 - c) * -50 + "px)";
    } else if (seg.mode === "zoom") {
      el.style.opacity = c;
      el.style.transform = "scale(" + (0.75 + c * 0.25) + ")";
    } else {
      el.style.opacity = c;
      el.style.transform = "translateY(" + (1 - c) * 14 + "px)";
    }
  }

  // Eases + smooths (lerp) each segment's local progress toward its target
  // every frame, so reveals settle fluidly instead of snapping to the
  // scrollbar. Runs every frame (not just on scroll) so that settling
  // continues for a moment after the user stops scrolling.
  function tickSegments(segments, p) {
    segments.forEach(function (seg) {
      if (!seg.el) return;
      var raw = Math.min(1, Math.max(0, (p - seg.start) / (seg.end - seg.start)));
      var target = easeOutCubic(raw);
      seg.current += (target - seg.current) * 0.18;
      if (Math.abs(target - seg.current) < 0.001) seg.current = target;
      applyPop(seg);
    });
  }

  function applyMediaZoom(state, mediaEl, p, maxZoom) {
    if (!mediaEl) return;
    var target = 1 + p * maxZoom;
    state.scale += (target - state.scale) * 0.12;
    mediaEl.style.transform = "scale(" + state.scale + ")";
  }

  /* ---------- Hero: title pops in word by word, video creeps in slightly ---------- */
  if (hero) {
    var heroEyebrow = document.querySelector("#hero .eyebrow");
    var heroWords = document.querySelectorAll(".hero__title .reveal-word");
    var heroSub = document.querySelector("#hero .hero__sub");
    var heroMedia = document.querySelector(".hero__media");
    var heroMediaState = { scale: 1 };

    // Each entry gets a slice of the overall 0–1 hero scroll progress; words
    // land one after another, sub-line last, all done by ~75% through the
    // pinned run so the last stretch is pure video before it releases.
    var heroSegments = [
      { el: heroEyebrow, start: 0.00, end: 0.16, current: 0, mode: "fade" }
    ].concat(
      Array.prototype.map.call(heroWords, function (w, i) {
        return { el: w, start: 0.12 + i * 0.14, end: 0.30 + i * 0.14, current: 0, mode: "word" };
      })
    ).concat([
      { el: heroSub, start: 0.60, end: 0.75, current: 0, mode: "fade" }
    ]);

    if (reduceMotion) {
      heroSegments.forEach(function (seg) {
        if (seg.el) { seg.current = 1; applyPop(seg); }
      });
    } else {
      var tickHero = function () {
        var p = pinnedProgress(hero);
        tickSegments(heroSegments, p);
        applyMediaZoom(heroMediaState, heroMedia, p, 0.12);
        requestAnimationFrame(tickHero);
      };
      requestAnimationFrame(tickHero);
    }
  }

  /* ---------- Heart: a joke slides in from each side of the video ---------- */
  if (heart) {
    var heartMedia = heart.querySelector(".heart__media");
    var heartMediaState = { scale: 1 };
    var leftParts = heart.querySelectorAll(".heart__side--left .heart__eyebrow, .heart__side--left .heart__line");
    var rightParts = heart.querySelectorAll(".heart__side--right .heart__eyebrow, .heart__side--right .heart__line");

    // [eyebrow, setup, punchline] for each side; left joke first, then right.
    var leftTimes = [[0.04, 0.18], [0.10, 0.28], [0.26, 0.42]];
    var rightTimes = [[0.46, 0.58], [0.50, 0.66], [0.64, 0.80]];
    var heartSegments = [];
    Array.prototype.forEach.call(leftParts, function (el, i) {
      heartSegments.push({ el: el, start: leftTimes[i][0], end: leftTimes[i][1], current: 0, mode: "sideLeft" });
    });
    Array.prototype.forEach.call(rightParts, function (el, i) {
      heartSegments.push({ el: el, start: rightTimes[i][0], end: rightTimes[i][1], current: 0, mode: "sideRight" });
    });

    if (reduceMotion) {
      heartSegments.forEach(function (seg) { seg.current = 1; applyPop(seg); });
    } else {
      var tickHeart = function () {
        var p = pinnedProgress(heart);
        tickSegments(heartSegments, p);
        applyMediaZoom(heartMediaState, heartMedia, p, 0.06);
        requestAnimationFrame(tickHeart);
      };
      requestAnimationFrame(tickHeart);
    }
  }

  /* ---------- Lazy autoplay video: loads + plays once near viewport, pauses when scrolled away ---------- */
  // Used for background-style clips (hero, heart, the iced mocha feature,
  // and any video on the secondary pages) that just play on their own
  // timeline, same as every other video on the site.
  var lazyAutoplayVideos = document.querySelectorAll("video.js-lazy-video");
  if (lazyAutoplayVideos.length) {
    if ("IntersectionObserver" in window) {
      var lazyVio = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            var v = entry.target;
            if (entry.isIntersecting) {
              if (!v.src && v.dataset.src) {
                v.src = v.dataset.src;
                v.load();
              }
              var p = v.play();
              if (p && p.catch) p.catch(function () {});
            } else {
              v.pause();
            }
          });
        },
        { threshold: 0.1, rootMargin: "300px 0px 300px 0px" }
      );
      lazyAutoplayVideos.forEach(function (v) { lazyVio.observe(v); });
    } else {
      lazyAutoplayVideos.forEach(function (v) {
        if (v.dataset.src) v.src = v.dataset.src;
      });
    }
  }

  /* ---------- Mocha: pinned, words slide in sideways beside the video ---------- */
  // Each word slides in from the right in turn as the section is scrolled
  // (same eased follow as the hero); the video frame eases in from the left
  // and its picture zooms gently. The last word lands at ~88% of the pinned
  // run, then the page releases into the next section.
  var mocha = document.getElementById("mocha");
  if (mocha) {
    var mochaWords = mocha.querySelectorAll(".mocha__word");
    var mochaFrame = mocha.querySelector(".mocha__frame");
    var mochaVideo = mocha.querySelector(".mocha__video");
    var mochaZoom = { scale: 1 };
    var mochaSegments = [{ el: mochaFrame, start: 0, end: 0.14, current: 0, mode: "sideLeft" }]
      .concat(Array.prototype.map.call(mochaWords, function (w, i) {
        var start = 0.06 + i * (0.68 / mochaWords.length);
        return { el: w, start: start, end: start + 0.14, current: 0, mode: "sideRight" };
      }));

    if (reduceMotion) {
      mochaSegments.forEach(function (seg) { seg.current = 1; applyPop(seg); });
    } else {
      var tickMocha = function () {
        var p = pinnedProgress(mocha);
        tickSegments(mochaSegments, p);
        applyMediaZoom(mochaZoom, mochaVideo, p, 0.18);
        requestAnimationFrame(tickMocha);
      };
      requestAnimationFrame(tickMocha);
    }
  }

  /* ---------- Smooth in-page anchor scroll (respects reduced motion) ---------- */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      var id = a.getAttribute("href").slice(1);
      var target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    });
  });
})();
