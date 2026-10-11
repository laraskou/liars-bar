/* ==========================================================
   Liar's Bar
   Structure:
   1. Helpers     – random numbers, shuffle, animation restart
   2. Language    – EN/DE toggle
   3. Logo        – header logo from config.js
   4. Sound       – MP3 effects from config.js
   5. Navigation  – tabs, one tool visible at a time
   6. Card type   – King / Queen / Ace
   7. Roulette    – 6 chambers, 1 loaded
   8. Start
   Runs fully in the browser. Only stored value: the selected
   language (localStorage, see Lang).
   ========================================================== */
(() => {
  ("use strict");

  const CONFIG = window.LIARS_BAR_CONFIG;
  const I18N = window.LIARS_BAR_I18N;

  const $ = (id) => document.getElementById(id);
  const prefersReducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- 1. Helpers ---------- */
  /**
   * Uniform random integer in 0...max-1.
   * Uses the browser's crypto RNG; rejection sampling avoids modulo bias.
   */
  function randomInt(max) {
    if (!window.crypto || !window.crypto.getRandomValues) {
      return Math.floor(Math.random() * max);
    }
    const buf = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / max) * max;
    let value;
    do {
      window.crypto.getRandomValues(buf);
      value = buf[0];
    } while (value >= limit);
    return value % max;
  }

  /** Fisher-Yates shuffle: every permutation is equally likely. */
  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /** Re-triggers a CSS animation, even on rapid repeated presses. */
  function restartClass(el, className) {
    el.classList.remove(className);
    void el.offsetWidth;
    el.classList.add(className);
  }

  /* ---------- 2. Language ---------- */
  const Lang = (() => {
    const STORAGE_KEY = "liarsbar.lang";
    const buttons = Array.from(document.querySelectorAll("[data-lang]"));
    const listeners = []; // callbacks run after every language change
    let lang = I18N.defaultLang;

    // Restore the saved language
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && I18N.strings[saved]) lang = saved;
    } catch (e) {}

    /** Returns the text for a key in the current language (English as fallback). */
    function t(key) {
      const current = I18N.strings[lang];
      if (key in current) return current[key];
      return key in I18N.strings.en ? I18N.strings.en[key] : key;
    }

    /** Returns the text for a key in the current language (English as fallback). */
    function apply() {
      document.documentElement.lang = lang;
      document.title = t("page.title");
      document.querySelectorAll("[data-i18n]").forEach((el) => {
        el.textContent = t(el.dataset.i18n);
      });
      document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
        el.setAttribute("aria-label", t(el.dataset.i18nAria));
      });
      buttons.forEach((b) =>
        b.setAttribute("aria-pressed", String(b.dataset.lang === lang)),
      );
      listeners.forEach((fn) => fn());
    }

    /** Switches language, saves it and re-renders. */
    function set(next) {
      if (!I18N.strings[next] || next === lang) return;
      lang = next;
      try {
        localStorage.setItem(STORAGE_KEY, lang);
      } catch (e) {}
      apply();
    }

    buttons.forEach((b) =>
      b.addEventListener("click", () => set(b.dataset.lang)),
    );

    return {
      t,
      apply,
      set,
      // Registers a callback for language changes
      onChange(fn) {
        listeners.push(fn);
      },
    };
  })();

  /* ---------- 3. Logo ---------- */
  $("logoImg").src = CONFIG.logo;

  /* ---------- 4. Sound ---------- */
  /** Creates a play function for one MP3; restarts it on every call. */
  function createSound(src) {
    const audio = new Audio(src);
    audio.preload = "auto";

    return function play() {
      audio.currentTime = 0;
      audio.play();
    };
  }
  const Sound = {
    click: createSound(CONFIG.sounds.click),
    bang: createSound(CONFIG.sounds.bang),
  };

  /* ---------- 5. Navigation ---------- */
  (() => {
    const tabs = Array.from(document.querySelectorAll('[role="tab"]'));

    /** Selects one tab and shows only its panel. */
    function show(tab) {
      tabs.forEach((other) => {
        const on = other === tab;
        other.setAttribute("aria-selected", String(on));
        other.tabIndex = on ? 0 : -1;
        $(other.getAttribute("aria-controls")).hidden = !on;
      });
    }

    tabs.forEach((tab, i) => {
      tab.addEventListener("click", () => show(tab));
      tab.addEventListener("keydown", (e) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        const next =
          tabs[
            (i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length
          ];
        show(next);
        next.focus();
      });
    });
  })();

  /* ---------- 6. Card type ---------- */

  const CARD_TYPES = ["king", "queen", "ace"];

  (() => {
    const card = $("card");
    const inner = $("cardInner");
    const frontImg = $("frontImg");
    const backImg = $("backImg");

    const cardConfig = CONFIG.cards;
    const frontPaths = cardConfig.front;

    let current = null; // last drawn type

    // Match the card's aspect ratio to the back image
    backImg.addEventListener("load", () => {
      card.style.setProperty(
        "--card-ratio",
        backImg.naturalWidth + " / " + backImg.naturalHeight,
      );
    });
    backImg.src = cardConfig.back;

    // Warm the cache so a flip never waits for a download
    Object.values(frontPaths).forEach((src) => {
      new Image().src = src;
    });

    /** Updates the front image alt text; optionally announces the card. */
    function renderLabel(announce) {
      if (!current) return;
      const name = Lang.t("card." + current);
      frontImg.alt = name;
      if (announce) $("cardLive").textContent = Lang.t("card.drawn") + name;
    }

    /** Draws a random card and plays the flip animation. */
    function draw() {
      // Each type has the same 1/3 chance
      current = CARD_TYPES[randomInt(CARD_TYPES.length)];
      frontImg.src = frontPaths[current];
      renderLabel(true);

      // Cancel running animations so a new draw restarts cleanly
      inner.getAnimations().forEach((a) => a.cancel());
      card.getAnimations().forEach((a) => a.cancel());

      const duration = prefersReducedMotion() ? 0 : 380;
      // Flip from back to front
      inner.animate(
        [{ transform: "rotateY(0deg)" }, { transform: "rotateY(180deg)" }],
        { duration, easing: "cubic-bezier(.3,.9,.3,1)", fill: "forwards" },
      );
      // Card lifts up while flipping
      card.animate(
        [
          { transform: "translateY(34px) scale(.9)" },
          { transform: "translateY(-10px) scale(1.03)", offset: 0.55 },
          { transform: "translateY(0) scale(1)" },
        ],
        { duration: duration + 60, easing: "ease-out" },
      );
    }

    $("drawBtn").addEventListener("click", draw);
    Lang.onChange(() => renderLabel(false));
  })();

  /* ---------- 7. Roulette ---------- */

  const Roulette = (() => {
    const CHAMBERS = 6;
    const BANG_RESET_MS = 1600;
    const RELOAD_PROMPT_DELAY_MS = 1500;

    const panel = $("roulettePanel");
    const cylinder = $("cylinder");
    const holes = Array.from(cylinder.querySelectorAll(".hole"));
    const status = $("status");
    const statusTx = $("statusText");
    const hint = $("statusHint");
    const counter = $("counterNum");
    const flash = $("flash");

    // --- Round state ---
    let order = []; // 6 entries, exactly one is true (= loaded)
    let used = 0; // chambers already fired empty this round
    // --- Cylinder visuals ---
    let topSlot = 0; // index of the hole currently at the top
    let angle = 0; // accumulated rotation (always turns the same way)
    let bangTimer = null; // clears the highlighted chamber
    let promptTimer = null; // opens the "Reload?" dialog after BANG
    // Current display, stored as i18n keys so a language switch can re-render

    let view = {
      state: "idle",
      text: "roulette.ready",
      hint: "roulette.hint.idle",
    };

    /** Starts a round: 1 loaded + 5 empty chambers, shuffled. */
    function newRound() {
      order = shuffle([true, false, false, false, false, false]);
      used = 0;
      renderCounter();
    }

    /** Shows "x/6" without revealing the loaded chamber. */
    function renderCounter() {
      counter.textContent = used + " / " + CHAMBERS;
    }

    /** Renders status text and hint; restart replays the text animation. */
    function renderStatus(restart) {
      status.dataset.state = view.state;
      statusTx.textContent = Lang.t(view.text);
      hint.textContent = Lang.t(view.hint);
      if (restart) {
        statusTx.style.animation = "none";
        void statusTx.offsetWidth;
        statusTx.style.animation = "";
      }
    }

    /** Sets a new display state (idle / click / bang) and renders it. */
    function setStatus(state, textKey, hintKey) {
      view = { state, text: textKey, hint: hintKey };
      renderStatus(true);
    }

    /** Removes chamber highlights (used / fired). */
    function clearHoleMarks() {
      clearTimeout(bangTimer);
      bangTimer = null;
      holes.forEach((h) => h.classList.remove("is-used", "is-bang"));
    }

    /** Cancels a pending "Reload?" dialog. */
    function cancelReloadPrompt() {
      clearTimeout(promptTimer);
      promptTimer = null;
    }

    /** Turns the cylinder one chamber further. */
    function rotateToNextSlot() {
      topSlot = (topSlot + 1) % CHAMBERS;
      angle -= 360 / CHAMBERS;
      cylinder.style.transform = "rotate(" + angle + "deg)";
    }

    // Pull trigger
    function pull() {
      cancelReloadPrompt();
      if (bangTimer !== null) clearHoleMarks();

      const isLoaded = order[used];

      if (isLoaded) {
        // ---- BANG! ----
        holes[topSlot].classList.add("is-bang");
        Sound.bang();
        if (navigator.vibrate) navigator.vibrate(160); // not supported on iOS
        restartClass(panel, "is-bang");
        restartClass(flash, "is-on");
        newRound();
        setStatus("bang", "roulette.bang", "roulette.hint.bang");
        bangTimer = setTimeout(clearHoleMarks, BANG_RESET_MS);

        // Ask "Reload?" shortly after, only if the roulette tab is still open
        promptTimer = setTimeout(() => {
          promptTimer = null;
          if (!panel.hidden) askReload(true);
        }, RELOAD_PROMPT_DELAY_MS);
      } else {
        // ---- CLICK ----
        holes[topSlot].classList.add("is-used");
        used += 1;
        renderCounter();
        Sound.click();
        setStatus("click", "roulette.click", "roulette.hint.click");
        rotateToNextSlot();
      }
    }

    /** Starts a fresh round and spins the cylinder once. */
    function reload() {
      cancelReloadPrompt();
      clearHoleMarks();
      newRound();
      setStatus("idle", "roulette.ready", "roulette.hint.reload");

      if (!prefersReducedMotion()) {
        cylinder.classList.add("is-spinning");
        angle -= 360;
        cylinder.style.transform = "rotate(" + angle + "deg)";
        setTimeout(() => cylinder.classList.remove("is-spinning"), 720);
      }
    }

    /** Native confirm dialog; reloads on OK. afterBang selects the message. */
    function askReload(afterBang) {
      cancelReloadPrompt();
      const message = afterBang
        ? Lang.t("reload.afterBang")
        : Lang.t("reload.title") + "\n\n" + Lang.t("reload.text");
      if (window.confirm(message)) reload();
    }

    panel.addEventListener("animationend", (e) => {
      if (e.animationName === "panel-flash") panel.classList.remove("is-bang");
    });
    statusTx.addEventListener("animationend", () => {
      statusTx.style.animation = "none";
    });

    $("triggerBtn").addEventListener("click", pull);
    $("reloadBtn").addEventListener("click", () => askReload(false));
    Lang.onChange(() => renderStatus(false));

    return { newRound };
  })();

  /* ---------- 8. Start ---------- */

  Roulette.newRound();

  Lang.apply();
})();
