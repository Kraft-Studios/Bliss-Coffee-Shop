/* Bliss Coffee Roastery: interactive layer.
   Everything here is feature-detected, so each page only runs what it has. */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var body = document.body;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function make(tag, cls, html) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (html) el.innerHTML = html;
    return el;
  }

  /* ---------- Toast ---------- */
  var toastEl = make("div", "toast");
  toastEl.setAttribute("role", "status");
  body.appendChild(toastEl);
  var toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("is-shown");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("is-shown"); }, 2400);
  }

  /* ---------- Current page in the nav ---------- */
  var here = location.pathname.split("/").pop() || "index.html";
  $$(".nav__links a, .nav__mobile a").forEach(function (a) {
    var file = (a.getAttribute("href") || "").split("#")[0];
    if (file && file === here && !a.classList.contains("nav__cta")) {
      a.classList.add("is-current");
      a.setAttribute("aria-current", "page");
    }
  });

  /* ---------- Scroll progress + back to top ---------- */
  var toTop = make("button", "to-top",
    '<svg viewBox="0 0 56 56" aria-hidden="true"><circle class="to-top__bg" cx="28" cy="28" r="26"/><circle class="to-top__fg" cx="28" cy="28" r="26"/></svg>' +
    '<svg class="to-top__arrow" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true" style="transform:none"><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5"/></svg>');
  toTop.type = "button";
  toTop.setAttribute("aria-label", "Back to top");
  body.appendChild(toTop);
  var ring = $(".to-top__fg", toTop);
  toTop.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  });

  var scrollTicking = false;
  function onScrollUI() {
    scrollTicking = false;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    ring.style.strokeDashoffset = 163.4 * (1 - p);
    toTop.classList.toggle("is-shown", window.scrollY > 700);
  }
  window.addEventListener("scroll", function () {
    if (!scrollTicking) { scrollTicking = true; requestAnimationFrame(onScrollUI); }
  }, { passive: true });
  window.addEventListener("resize", onScrollUI);
  onScrollUI();

  /* ---------- Page transitions ---------- */
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (a.target === "_blank" || a.hasAttribute("download")) return;
    if (a.origin !== location.origin) return;
    if (a.pathname === location.pathname) return;
    if (reduceMotion) return;
    e.preventDefault();
    document.documentElement.classList.add("page-leaving");
    setTimeout(function () { location.href = a.href; }, 280);
  });
  window.addEventListener("pageshow", function () {
    document.documentElement.classList.remove("page-leaving");
  });

  /* ---------- Copy buttons ---------- */
  $$("[data-copy]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var text = btn.getAttribute("data-copy");
      var done = function () { toast("Address copied"); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, fallback);
      } else { fallback(); }
      function fallback() {
        var ta = make("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); done(); } catch (err) { toast("Copy failed. Select the address instead."); }
        ta.remove();
      }
    });
  });

  /* ---------- Lightbox ---------- */
  var zoomImgs = $$(".gallery__item img, .media-row__item img, .split__media img, .menu-grid__media img, .feed__item img");
  if (zoomImgs.length) {
    zoomImgs.forEach(function (img) { img.classList.add("is-zoomable"); });
    var lb = make("div", "lightbox");
    lb.setAttribute("role", "dialog");
    lb.setAttribute("aria-modal", "true");
    lb.setAttribute("aria-label", "Image viewer");
    lb.innerHTML =
      '<span class="lightbox__count"></span>' +
      '<button type="button" class="lightbox__btn lightbox__btn--close" aria-label="Close">&times;</button>' +
      '<button type="button" class="lightbox__btn lightbox__btn--prev" aria-label="Previous image">&#8592;</button>' +
      '<img class="lightbox__img" alt="">' +
      '<button type="button" class="lightbox__btn lightbox__btn--next" aria-label="Next image">&#8594;</button>' +
      '<p class="lightbox__cap"></p>';
    body.appendChild(lb);
    var lbImg = $(".lightbox__img", lb), lbCap = $(".lightbox__cap", lb), lbCount = $(".lightbox__count", lb);
    var lbIndex = 0, lbOpen = false, lastFocus = null;

    var show = function (i, swap) {
      lbIndex = (i + zoomImgs.length) % zoomImgs.length;
      var src = zoomImgs[lbIndex];
      var apply = function () {
        lbImg.src = src.currentSrc || src.src;
        lbImg.alt = src.alt || "";
        lbCap.textContent = src.alt || "";
        lbCount.textContent = (lbIndex + 1) + " / " + zoomImgs.length;
        lbImg.classList.remove("is-swapping");
      };
      if (swap) { lbImg.classList.add("is-swapping"); setTimeout(apply, 180); } else { apply(); }
    };
    var openLb = function (i) {
      lastFocus = document.activeElement;
      show(i, false);
      lb.classList.add("is-open");
      lbOpen = true;
      body.style.overflow = "hidden";
      $(".lightbox__btn--close", lb).focus();
    };
    var closeLb = function () {
      lb.classList.remove("is-open");
      lbOpen = false;
      body.style.overflow = "";
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    };
    zoomImgs.forEach(function (img, i) {
      img.addEventListener("click", function () { openLb(i); });
    });
    $(".lightbox__btn--close", lb).addEventListener("click", closeLb);
    $(".lightbox__btn--prev", lb).addEventListener("click", function () { show(lbIndex - 1, true); });
    $(".lightbox__btn--next", lb).addEventListener("click", function () { show(lbIndex + 1, true); });
    lb.addEventListener("click", function (e) { if (e.target === lb) closeLb(); });
    document.addEventListener("keydown", function (e) {
      if (!lbOpen) return;
      if (e.key === "Escape") closeLb();
      else if (e.key === "ArrowLeft") show(lbIndex - 1, true);
      else if (e.key === "ArrowRight") show(lbIndex + 1, true);
    });
    var touchX = null;
    lb.addEventListener("touchstart", function (e) { touchX = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener("touchend", function (e) {
      if (touchX === null) return;
      var dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 50) show(lbIndex + (dx < 0 ? 1 : -1), true);
      touchX = null;
    }, { passive: true });
  }

  /* ---------- Magnetic buttons and image tilt (fine pointers) ---------- */
  if (finePointer && !reduceMotion) {
    $$(".btn, .nav__cta, .picks-btn, .to-top").forEach(function (el) {
      el.addEventListener("mousemove", function (e) {
        var r = el.getBoundingClientRect();
        var x = (e.clientX - (r.left + r.width / 2)) * 0.22;
        var y = (e.clientY - (r.top + r.height / 2)) * 0.3;
        el.style.transform = "translate(" + x + "px," + y + "px)";
      });
      el.addEventListener("mouseleave", function () { el.style.transform = ""; });
    });

    $$(".split__media, .media-row__item, .gallery__item, .menu-grid__media").forEach(function (box) {
      var img = $("img", box);
      if (!img) return;
      box.addEventListener("mousemove", function (e) {
        var r = box.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        img.style.setProperty("--rx", (py * -5) + "deg");
        img.style.setProperty("--ry", (px * 5) + "deg");
      });
      box.addEventListener("mouseleave", function () {
        img.style.setProperty("--rx", "0deg");
        img.style.setProperty("--ry", "0deg");
      });
    });
  }

  /* ---------- Menu: section tabs (scrollspy) ---------- */
  var tabLinks = $$(".menu-tabs a");
  if (tabLinks.length) {
    var tabTargets = tabLinks.map(function (a) { return document.getElementById(a.getAttribute("href").slice(1)); });
    var spyTick = false;
    var spy = function () {
      spyTick = false;
      var offset = 80 + 130;
      var current = 0;
      tabTargets.forEach(function (t, i) {
        if (t && t.getBoundingClientRect().top <= offset) current = i;
      });
      tabLinks.forEach(function (a, i) {
        var on = i === current;
        a.classList.toggle("is-active", on);
        if (on) {
          var wrap = a.parentNode;
          wrap.scrollLeft = a.offsetLeft - (wrap.clientWidth - a.offsetWidth) / 2;
        }
      });
    };
    window.addEventListener("scroll", function () {
      if (!spyTick) { spyTick = true; requestAnimationFrame(spy); }
    }, { passive: true });
    spy();
  }

  /* ---------- Menu: my picks ---------- */
  var menuItems = $$(".menu-grid__item");
  if (menuItems.length) {
    var STORE = "bliss-picks";
    var picks = [];
    try { picks = JSON.parse(localStorage.getItem(STORE) || "[]"); } catch (err) { picks = []; }
    if (!Array.isArray(picks)) picks = [];
    var save = function () { try { localStorage.setItem(STORE, JSON.stringify(picks)); } catch (err) {} };
    var has = function (name) { return picks.some(function (p) { return p.name === name; }); };

    var pickBtn = make("button", "picks-btn", 'My picks <b>0</b>');
    pickBtn.type = "button";
    body.appendChild(pickBtn);
    var panel = make("div", "picks");
    panel.setAttribute("aria-hidden", "true");
    panel.innerHTML =
      '<div class="picks__backdrop"></div>' +
      '<aside class="picks__panel" role="dialog" aria-label="My picks">' +
        '<div class="picks__head"><h3>My picks</h3><button type="button" class="picks__close" aria-label="Close">&times;</button></div>' +
        '<p class="picks__sub">Tap the heart on anything you fancy, then show this list at the counter.</p>' +
        '<ul class="picks__list"></ul>' +
        '<div class="picks__actions"><button type="button" class="btn picks__copy">Copy list</button><button type="button" class="btn btn--outline picks__clear">Clear</button></div>' +
      '</aside>';
    body.appendChild(panel);
    var list = $(".picks__list", panel);
    var favs = [];

    var render = function () {
      $("b", pickBtn).textContent = picks.length;
      pickBtn.style.display = picks.length || panel.classList.contains("is-open") ? "" : "none";
      list.innerHTML = "";
      if (!picks.length) {
        list.appendChild(make("li", "picks__empty", "Nothing yet. Tap a heart to add something."));
      }
      picks.forEach(function (p) {
        var li = make("li", "", "<div><small></small><span></span></div>");
        $("small", li).textContent = p.cat;
        $("span", li).textContent = p.name;
        var rm = make("button", "", "&times;");
        rm.type = "button";
        rm.setAttribute("aria-label", "Remove " + p.name);
        rm.addEventListener("click", function () { toggle(p.name, p.cat); });
        li.appendChild(rm);
        list.appendChild(li);
      });
      favs.forEach(function (f) {
        var on = has(f.name);
        f.btn.setAttribute("aria-pressed", on ? "true" : "false");
      });
    };
    var toggle = function (name, cat) {
      if (has(name)) {
        picks = picks.filter(function (p) { return p.name !== name; });
        toast("Removed " + name);
      } else {
        picks.push({ name: name, cat: cat });
        toast("Added " + name + " to your picks");
        pickBtn.classList.remove("is-bump");
        void pickBtn.offsetWidth;
        pickBtn.classList.add("is-bump");
      }
      save();
      render();
    };
    var heart = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.2-9.3C1.7 8 3.4 5 6.5 5c1.9 0 3.5 1 4.5 2.6h2C14 6 15.600 5 17.500 5c3.100 0 4.800 3 3.700 6.200C19.500 15.900 12 20.500 12 20.500z" stroke-linejoin="round"/></svg>';
    var addFav = function (host, name, cat) {
      var b = make("button", "fav", heart);
      b.type = "button";
      b.setAttribute("aria-label", "Add " + name + " to my picks");
      b.addEventListener("click", function (e) { e.stopPropagation(); toggle(name, cat); });
      host.appendChild(b);
      favs.push({ btn: b, name: name });
    };
    menuItems.forEach(function (item) {
      var name = $("h4", item).textContent.trim();
      var catHead = item.closest(".menu-category");
      var cat = catHead ? $("h3", catHead).textContent.trim() : "Menu";
      addFav($(".menu-grid__media", item), name, cat);
    });
    var mochaFrame = $(".menu-intro__frame");
    if (mochaFrame) {
      mochaFrame.style.position = "relative";
      addFav(mochaFrame, "Iced Mocha", "Cold & Iced");
    }

    var openPanel = function () {
      panel.classList.add("is-open");
      panel.setAttribute("aria-hidden", "false");
      $(".picks__close", panel).focus();
    };
    var closePanel = function () {
      panel.classList.remove("is-open");
      panel.setAttribute("aria-hidden", "true");
      render();
    };
    pickBtn.addEventListener("click", openPanel);
    $(".picks__close", panel).addEventListener("click", closePanel);
    $(".picks__backdrop", panel).addEventListener("click", closePanel);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && panel.classList.contains("is-open")) closePanel(); });
    $(".picks__clear", panel).addEventListener("click", function () { picks = []; save(); render(); toast("Cleared"); });
    $(".picks__copy", panel).addEventListener("click", function () {
      if (!picks.length) { toast("Add something first"); return; }
      var text = "My Bliss picks:\n" + picks.map(function (p) { return "- " + p.name + " (" + p.cat + ")"; }).join("\n");
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { toast("Copied. Show it at the counter."); }, function () { toast("Copy failed"); });
      } else { toast("Copy isn't supported here"); }
    });
    render();
  }

  /* ---------- Coffee finder quiz ---------- */
  var quiz = $("#quiz");
  if (quiz) {
    var stage = $("#quizStage"), quizBar = $("#quizBar");
    var ORIGINS = {
      brazil:   { name: "Brazil",   blurb: "Low on acidity, full in body, with a nutty, chocolatey sweetness." },
      rwanda:   { name: "Rwanda",   blurb: "Bright and juicy, often with a floral lift on the finish." },
      malawi:   { name: "Malawi",   blurb: "Soft, sweet and gentle. A mellow cup that rewards a slow sip." },
      colombia: { name: "Colombia", blurb: "The balanced one. Caramel, nuts and chocolate that are easy to love." }
    };
    var QUESTIONS = [
      { id: "taste", text: "Which flavour sounds best?", opts: [
        { v: "brazil",   t: "Chocolate & nuts", d: "Deep, cosy and rounded." },
        { v: "rwanda",   t: "Bright & fruity",  d: "Lively, juicy, a floral lift." },
        { v: "malawi",   t: "Soft & sweet",     d: "Gentle and mellow." },
        { v: "colombia", t: "Caramel & balance", d: "Easy to love, every time." } ] },
      { id: "milk", text: "How do you take it?", opts: [
        { v: "black", t: "Black",     d: "Straight, so I can taste it." },
        { v: "milk",  t: "With milk", d: "Smooth, creamy, comforting." } ] },
      { id: "where", text: "Where will you drink it?", opts: [
        { v: "counter", t: "At the counter", d: "Made for me, ready to go." },
        { v: "home",    t: "At home",        d: "I'll brew it myself." } ] }
    ];
    var answers = {};
    var step = 0;

    var tipFor = function (a) {
      if (a.where === "home") {
        return a.milk === "milk"
          ? "Brew it in an Aeropress. The concentrated cup stands up well to milk."
          : "Brew it as a pour-over to taste every note it has.";
      }
      return a.milk === "milk"
        ? "Ask for it as a flat white or a latte."
        : "Ask for it as an espresso.";
    };
    var renderQuiz = function () {
      stage.innerHTML = "";
      var wrap = make("div", "quiz__step");
      if (step < QUESTIONS.length) {
        var q = QUESTIONS[step];
        quizBar.style.width = (step / QUESTIONS.length * 100) + "%";
        wrap.appendChild(make("p", "quiz__count", "Question " + (step + 1) + " of " + QUESTIONS.length));
        wrap.appendChild(make("h3", "quiz__q", q.text));
        var opts = make("div", "quiz__opts");
        q.opts.forEach(function (o) {
          var b = make("button", "quiz__opt", "<strong></strong><span></span>");
          b.type = "button";
          $("strong", b).textContent = o.t;
          $("span", b).textContent = o.d;
          b.addEventListener("click", function () {
            answers[q.id] = o.v;
            step += 1;
            renderQuiz();
          });
          opts.appendChild(b);
        });
        wrap.appendChild(opts);
      } else {
        quizBar.style.width = "100%";
        var origin = ORIGINS[answers.taste];
        wrap.className = "quiz__step quiz__result";
        wrap.appendChild(make("p", "quiz__count", "Your bean"));
        wrap.appendChild(make("h3", "quiz__result-name", origin.name));
        wrap.appendChild(make("p", "", origin.blurb));
        wrap.appendChild(make("p", "quiz__tip", tipFor(answers)));
        var actions = make("div", "quiz__actions");
        var again = make("button", "btn btn--outline", "Start again");
        again.type = "button";
        again.addEventListener("click", function () { answers = {}; step = 0; renderQuiz(); });
        var menu = make("a", "btn", "See the menu");
        menu.href = "menu.html";
        actions.appendChild(menu);
        actions.appendChild(again);
        wrap.appendChild(actions);
      }
      stage.appendChild(wrap);
    };
    renderQuiz();
  }

  /* ---------- Brew lab ---------- */
  var lab = $("#lab");
  if (lab) {
    var METHODS = {
      pour: {
        ratio: 16, ratioText: "1 : 16", grind: "Medium",
        note: "A clean, bright cup. Pour in slow circles and keep the bed of grounds level.",
        phases: [
          { name: "Bloom", sec: 30, step: function (g) { return "Pour about " + Math.round(g * 2) + " g of water and let the grounds bloom."; } },
          { name: "Pour", sec: 120, step: function () { return "Pour the rest in slow circles until the water is gone."; } }
        ]
      },
      aero: {
        ratio: 16.7, ratioText: "1 : 16.7", grind: "Medium-fine",
        note: "Rounder and fuller. Stir, steep, then press slowly and steadily.",
        phases: [
          { name: "Steep", sec: 60, step: function () { return "Add all the water, stir, and let it steep."; } },
          { name: "Press", sec: 30, step: function () { return "Press slowly and steadily until you hear the hiss."; } }
        ]
      }
    };
    var method = "pour";
    var water = 300;
    var C = 339.3;
    var ringEl = $("#labRing"), timeEl = $("#labTime"), phaseEl = $("#labPhase"), stepEl = $("#labStep");
    var startBtn = $("#labStart"), resetBtn = $("#labReset"), rangeEl = $("#labRange");
    var running = false, phaseIdx = 0, phaseStart = 0, raf = 0, audio = null;

    var coffeeGrams = function () { return water / METHODS[method].ratio; };
    var fmt = function (s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); };
    var stepText = function (i) {
      var ph = METHODS[method].phases[i];
      return typeof ph.step === "function" ? ph.step(coffeeGrams()) : ph.step;
    };
    var chime = function () {
      try {
        if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
        var o = audio.createOscillator(), g = audio.createGain();
        o.type = "sine"; o.frequency.value = 880;
        g.gain.setValueAtTime(0.0001, audio.currentTime);
        g.gain.exponentialRampToValueAtTime(0.12, audio.currentTime + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.6);
        o.connect(g); g.connect(audio.destination);
        o.start(); o.stop(audio.currentTime + 0.65);
      } catch (err) {}
    };
    var updateStats = function () {
      var m = METHODS[method];
      $("#labWater").textContent = water + " ml";
      $("#labCoffee").textContent = (Math.round(coffeeGrams() * 10) / 10) + " g";
      $("#labGrind").textContent = m.grind;
      $("#labRatio").textContent = m.ratioText;
      $("#labNote").textContent = m.note;
    };
    var idle = function () {
      cancelAnimationFrame(raf);
      running = false;
      phaseIdx = 0;
      var ph = METHODS[method].phases[0];
      ringEl.style.strokeDashoffset = C;
      timeEl.textContent = fmt(ph.sec);
      phaseEl.textContent = ph.name;
      stepEl.textContent = "Press start when the water hits the grounds.";
      startBtn.textContent = "Start timer";
    };
    var frame = function (now) {
      var ph = METHODS[method].phases[phaseIdx];
      var elapsed = (now - phaseStart) / 1000;
      if (elapsed >= ph.sec) {
        chime();
        phaseIdx += 1;
        if (phaseIdx >= METHODS[method].phases.length) {
          running = false;
          ringEl.style.strokeDashoffset = 0;
          timeEl.textContent = "0:00";
          phaseEl.textContent = "Done";
          stepEl.textContent = "Enjoy it. Taste, then adjust the grind or ratio next time.";
          startBtn.textContent = "Start again";
          toast("Your brew is ready");
          return;
        }
        phaseStart = now;
        ph = METHODS[method].phases[phaseIdx];
        elapsed = 0;
        phaseEl.textContent = ph.name;
        stepEl.textContent = stepText(phaseIdx);
      }
      ringEl.style.strokeDashoffset = C * (1 - elapsed / ph.sec);
      timeEl.textContent = fmt(ph.sec - elapsed);
      raf = requestAnimationFrame(frame);
    };
    startBtn.addEventListener("click", function () {
      if (running) return;
      idle();
      running = true;
      try { if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === "suspended") audio.resume(); } catch (err) {}
      phaseIdx = 0;
      phaseStart = performance.now();
      phaseEl.textContent = METHODS[method].phases[0].name;
      stepEl.textContent = stepText(0);
      startBtn.textContent = "Brewing...";
      raf = requestAnimationFrame(frame);
    });
    resetBtn.addEventListener("click", idle);
    rangeEl.addEventListener("input", function () {
      water = parseInt(rangeEl.value, 10);
      updateStats();
      if (!running) idle();
    });
    $$(".seg__btn", lab).forEach(function (b) {
      b.addEventListener("click", function () {
        $$(".seg__btn", lab).forEach(function (o) {
          var on = o === b;
          o.classList.toggle("is-active", on);
          o.setAttribute("aria-checked", on ? "true" : "false");
        });
        method = b.getAttribute("data-method");
        updateStats();
        idle();
      });
    });
    updateStats();
    idle();
  }
})();
