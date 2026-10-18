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
    // The panel is sized in small-viewport units, so its height does not change
    // when a phone's address bar slides away (window.innerHeight does).
    var threshold = hero ? Math.max(40, hero.offsetHeight - hero.firstElementChild.offsetHeight - 10) : 40;
    if (window.scrollY > threshold) nav.classList.add("is-scrolled");
    else nav.classList.remove("is-scrolled");
  };
  document.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  onScroll();

  // Keep anything that sticks under the nav (the menu tabs) flush with the nav's
  // real height, whatever the screen size.
  var syncNavHeight = function () {
    document.documentElement.style.setProperty("--nav-h", nav.offsetHeight + "px");
  };
  syncNavHeight();
  window.addEventListener("resize", syncNavHeight);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncNavHeight);

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

  /* ---------- Pinned sections: hero, heart, iced mocha ----------
     Two ways to run them, so the page stays firm on every device:
     - Touch screens: words appear through ordinary CSS transitions the moment
       you cross a point in the scroll. Nothing is re-positioned frame by frame,
       so nothing drifts or lags behind your finger.
     - Mouse screens: the continuous, eased scroll-linked version, which only
       runs while its section is actually on screen. */
  var touchMode = window.matchMedia("(hover: none), (pointer: coarse)").matches;
  document.documentElement.classList.toggle("is-touch", touchMode);

  // 0 when the section starts pinning, 1 when it lets go. Measured against the
  // pinned panel's own height (not window.innerHeight, which changes on phones
  // as the address bar slides in and out and would make the content jump).
  function pinnedProgress(sectionEl) {
    var sticky = sectionEl.firstElementChild;
    var range = sectionEl.offsetHeight - sticky.offsetHeight;
    var top = sectionEl.getBoundingClientRect().top;
    if (range <= 0) return top <= 0 ? 1 : 0;
    return Math.min(1, Math.max(0, -top / range));
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  // seg: { el, start, end, current, on, mode: "word" | "sideLeft" | "sideRight" | "fade" }
  function applyPop(seg) {
    var c = seg.current;
    var el = seg.el;
    el.style.opacity = c;
    if (seg.mode === "word") {
      el.style.transform = "translateY(" + (1 - c) * 55 + "%) scale(" + (0.94 + c * 0.06) + ")";
    } else if (seg.mode === "sideRight") {
      el.style.transform = "translateX(" + (1 - c) * 70 + "px)";
    } else if (seg.mode === "sideLeft") {
      el.style.transform = "translateX(" + (1 - c) * -50 + "px)";
    } else {
      el.style.transform = "translateY(" + (1 - c) * 14 + "px)";
    }
  }

  // Mouse screens: ease each segment toward its target (lerp), a little each frame.
  function tickSegments(segments, p) {
    segments.forEach(function (seg) {
      if (!seg.el) return;
      var raw = Math.min(1, Math.max(0, (p - seg.start) / (seg.end - seg.start)));
      var target = easeOutCubic(raw);
      seg.current += (target - seg.current) * 0.3;
      if (Math.abs(target - seg.current) < 0.002) seg.current = target;
      applyPop(seg);
    });
  }

  // Touch screens: flip a class when the scroll passes a segment's start.
  function toggleSegments(segments, p, cls) {
    segments.forEach(function (seg) {
      if (!seg.el) return;
      var on = p >= seg.start;
      if (seg.on !== on) {
        seg.on = on;
        seg.el.classList.toggle(cls, on);
      }
    });
  }

  function applyMediaZoom(state, mediaEl, p, maxZoom) {
    if (!mediaEl) return;
    var target = 1 + p * maxZoom;
    state.scale += (target - state.scale) * 0.2;
    mediaEl.style.transform = "scale(" + state.scale + ")";
  }

  var pinned = [];

  function addPinned(section, segments, cls, tick) {
    if (reduceMotion) {
      segments.forEach(function (seg) {
        if (!seg.el) return;
        seg.current = 1;
        applyPop(seg);
        seg.el.classList.add(cls);
      });
      return;
    }
    pinned.push({
      section: section,
      active: false,
      tick: tick,
      touch: function () { toggleSegments(segments, pinnedProgress(section), cls); }
    });
  }

  /* Hero: title pops in word by word. */
  if (hero) {
    var heroWords = document.querySelectorAll(".hero__title .reveal-word");
    var heroSub = document.querySelector("#hero .hero__sub");
    var heroMedia = document.querySelector(".hero__media");
    var heroMediaState = { scale: 1 };

    // Each entry gets a slice of the overall 0 to 1 hero scroll progress; words
    // land one after another, sub-line last, all done by ~75% through the
    // pinned run so the last stretch is pure video before it releases.
    var heroSegments = Array.prototype.map.call(heroWords, function (w, i) {
      return { el: w, start: 0.12 + i * 0.14, end: 0.30 + i * 0.14, current: 0, mode: "word" };
    }).concat([{ el: heroSub, start: 0.60, end: 0.75, current: 0, mode: "fade" }]);

    addPinned(hero, heroSegments, "is-visible", function () {
      var p = pinnedProgress(hero);
      tickSegments(heroSegments, p);
      applyMediaZoom(heroMediaState, heroMedia, p, 0.12);
    });
  }

  /* Heart: a joke slides in from each side of the video. */
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

    addPinned(heart, heartSegments, "is-in", function () {
      var p = pinnedProgress(heart);
      tickSegments(heartSegments, p);
      applyMediaZoom(heartMediaState, heartMedia, p, 0.06);
    });
  }

  /* Iced mocha: words slide in beside (or, on small screens, over) the video.
     The last word lands at ~88% of the pinned run, then the page releases. */
  var mocha = document.getElementById("mocha");
  if (mocha) {
    var mochaWords = mocha.querySelectorAll(".mocha__word");
    var mochaFrame = mocha.querySelector(".mocha__frame");
    var mochaVideo = mocha.querySelector(".mocha__video");
    var mochaZoom = { scale: 1 };
    var mochaCompact = window.matchMedia("(max-width: 900px)");
    var mochaSegments = Array.prototype.map.call(mochaWords, function (w, i) {
      var start = 0.06 + i * (0.68 / mochaWords.length);
      return { el: w, start: start, end: start + 0.14, current: 0, mode: "sideRight" };
    });
    // The video frame eases in from the side on mouse screens only.
    var mochaFrameSeg = { el: mochaFrame, start: 0, end: 0.14, current: 0, mode: "sideLeft" };
    var mochaAll = mochaSegments.concat(touchMode ? [] : [mochaFrameSeg]);

    addPinned(mocha, mochaAll, "is-in", function () {
      var p = pinnedProgress(mocha);
      tickSegments(mochaAll, p);
      if (mochaCompact.matches) {
        // full-screen background on small screens: visible from the first frame
        mochaFrame.style.opacity = 1;
        mochaFrame.style.transform = "none";
      }
      applyMediaZoom(mochaZoom, mochaVideo, p, mochaCompact.matches ? 0.05 : 0.18);
    });
  }

  if (pinned.length) {
    if (touchMode) {
      var touchQueued = false;
      var touchUpdate = function () {
        touchQueued = false;
        pinned.forEach(function (d) { d.touch(); });
      };
      var queueTouch = function () {
        if (!touchQueued) { touchQueued = true; requestAnimationFrame(touchUpdate); }
      };
      window.addEventListener("scroll", queueTouch, { passive: true });
      window.addEventListener("resize", queueTouch);
      window.addEventListener("orientationchange", queueTouch);
      touchUpdate();
    } else {
      var loopRunning = false;
      var loop = function () {
        var any = false;
        pinned.forEach(function (d) { if (d.active) { any = true; d.tick(); } });
        if (any) requestAnimationFrame(loop); else loopRunning = false;
      };
      var wake = function () {
        if (!loopRunning) { loopRunning = true; requestAnimationFrame(loop); }
      };
      if ("IntersectionObserver" in window) {
        var pinIo = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            for (var i = 0; i < pinned.length; i++) {
              if (pinned[i].section === entry.target) pinned[i].active = entry.isIntersecting;
            }
          });
          wake();
        }, { rootMargin: "120px 0px" });
        pinned.forEach(function (d) { pinIo.observe(d.section); });
      } else {
        pinned.forEach(function (d) { d.active = true; });
        wake();
      }
    }
  }

  /* ---------- Autoplay video: plays when in view, pauses when scrolled away ---------- */
  // Built for phones: forced muted + inline playback. Some phones block video
  // autoplay outright (iOS Low Power Mode, data savers). When that happens the
  // clip is swapped for an animated picture of the same footage, which still
  // plays by itself, and the real video takes over if the phone later allows it.
  var lazyAutoplayVideos = Array.prototype.slice.call(document.querySelectorAll("video.js-lazy-video"));
  var blockedVideos = [];

  function prepInline(v) {
    v.muted = true;
    v.defaultMuted = true;
    v.loop = true;
    v.playsInline = true;
    v.setAttribute("muted", "");
    v.setAttribute("playsinline", "");
    v.setAttribute("webkit-playsinline", "");
  }
  function fallbackSrc(v) {
    var landscape = window.innerWidth > window.innerHeight;
    return (landscape && v.dataset.fallbackWide) || v.dataset.fallback || null;
  }
  function hideFallback(v) {
    if (v.__fb) { v.__fb.remove(); v.__fb = null; }
    v.style.visibility = "";
    var i = blockedVideos.indexOf(v);
    if (i > -1) blockedVideos.splice(i, 1);
  }
  function showFallback(v) {
    if (v.__fb || !v.parentNode) return;
    var src = fallbackSrc(v);
    if (!src) return;
    var img = document.createElement("img");
    img.className = v.className.replace("js-lazy-video", "").trim() + " video-fallback";
    img.alt = "";
    img.setAttribute("aria-hidden", "true");
    img.decoding = "async";
    img.src = src;
    v.parentNode.insertBefore(img, v.nextSibling);
    v.__fb = img;
    v.style.visibility = "hidden";
    if (blockedVideos.indexOf(v) < 0) blockedVideos.push(v);
  }
  function startVideo(v) {
    prepInline(v);
    if (!v.getAttribute("src") && v.dataset.src) v.src = v.dataset.src;
    var p = v.play();
    if (p && p.then) {
      p.then(function () { hideFallback(v); }).catch(function () { showFallback(v); });
    }
  }
  function isOnScreen(v) {
    var r = v.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
  }

  lazyAutoplayVideos.forEach(function (v) {
    prepInline(v);
    v.addEventListener("playing", function () { hideFallback(v); });
  });

  if ("IntersectionObserver" in window) {
    var lazyVio = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          var v = entry.target;
          if (entry.isIntersecting) {
            startVideo(v);
            clearTimeout(v.__watch);
            v.__watch = setTimeout(function () {
              if (v.paused && isOnScreen(v)) showFallback(v);
            }, 3500);
          } else {
            clearTimeout(v.__watch);
            v.pause();
          }
        });
      },
      { threshold: 0.05, rootMargin: "300px 0px 300px 0px" }
    );
    lazyAutoplayVideos.forEach(function (v) { lazyVio.observe(v); });
  } else {
    lazyAutoplayVideos.forEach(startVideo);
  }

  // A touch is a real user gesture: if the phone blocked a clip, try the real
  // video again, and it replaces the animated picture as soon as it plays.
  function retryBlocked() {
    blockedVideos.slice().forEach(function (v) { if (isOnScreen(v)) startVideo(v); });
  }
  ["touchend", "click"].forEach(function (ev) {
    document.addEventListener(ev, retryBlocked, { passive: true });
  });
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) {
      lazyAutoplayVideos.forEach(function (v) { if (isOnScreen(v) && v.paused) startVideo(v); });
    }
  });

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
