/* Seerah Lens — offline-first PWA. No ads, no trackers, no account: all user data stays in localStorage on this device. */
(function () {
  "use strict";

  // ---------------------------------------------------------------- strings
  // English is complete. Other UI languages switch on as soon as their strings are added here.
  var STR = {
    en: {
      today: "Today", read: "Read", salah: "Salah", journal: "Journal",
      streak: "day streak", settings: "Settings",
      pledge: "No ads, ever. Your reading, journal and progress stay on this device.",
      startReading: "Start today’s reading", continueReading: "Continue reading",
      finished: "I’ve finished today’s reading", lensNext: "Your Seerah Lens card opens next.",
      openLens: "Open the Seerah Lens", allDays: "All days", lensAfter: "Seerah Lens after you finish",
      translit: "Transliteration", english: "English",
      offline: "You’re offline. Everything you’ve opened still works.",
      install: "Install the app", installHint: "Add Seerah Lens to your home screen. It works offline.",
      pendingTitle: "Seerah Lens card in preparation",
      pendingBody: "This card is being sourced and graded for the scholar panel. Nothing is shown until its excerpts are verified, so the Prophet ﷺ is never quoted from an unchecked report.",
      saveJournal: "Save to journal", saved: "Saved", reflect: "Reflect", fromSources: "From the sources",
      summary: "Quick summary", forYou: "What’s in it for you", concern: "Report a concern about this card",
      saveNote: "Save review note"
    }
  };
  var LANGS = [["en", "English"], ["hi", "हिन्दी"], ["ur", "اردو"], ["te", "తెలుగు"]];

  // ---------------------------------------------------------------- state
  var KEY = "seerahLens.v2";
  var D = null, SURAHS = {}, CACHE = {};
  var S = load();
  var installEvt = null;

  function base() {
    return { onboarded: false, plan: "juz30", done: {}, dates: [], journal: [], notes: [], lessons: {},
      salahSet: { s112: true, s108: true, s103: true }, translit: true, english: true,
      lang: "en", theme: "auto", qscale: 1 };
  }
  function load() {
    var b = base();
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) { var o = JSON.parse(raw); for (var k in b) if (!(k in o)) o[k] = b[k]; return o; }
    } catch (e) {}
    return b;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  function T(k) { return (STR[S.lang] && STR[S.lang][k]) || STR.en[k] || k; }

  // ---------------------------------------------------------------- helpers
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function arNum(n) { return String(n).replace(/[0-9]/g, function (d) { return "٠١٢٣٤٥٦٧٨٩"[d]; }); }
  function iso(d) { d = d || new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function meta(n) { return SURAHS[n]; }
  function plan(id) { return D.plans.filter(function (p) { return p.id === id; })[0] || D.plans[0]; }
  function dayKey(pid, day) { return pid + "-" + day; }
  function isDone(pid, day) { return !!S.done[dayKey(pid, day)]; }
  function cardsFor(pid, day) { return D.cards.filter(function (c) { return c.plan === pid && c.day === day; }); }
  function cardById(id) { if (id === D.salahCard.id) return D.salahCard; return D.cards.filter(function (c) { return c.id === id; })[0]; }
  function nextDay(pid) { var p = plan(pid); for (var i = 1; i <= p.days.length; i++) if (!isDone(pid, i)) return i; return 0; }
  function doneCount(pid) { var p = plan(pid), n = 0; for (var i = 1; i <= p.days.length; i++) if (isDone(pid, i)) n++; return n; }
  function segLabel(seg) { var m = meta(seg.s); return m.tr + (seg.a ? " " + seg.a[0] + "–" + seg.a[1] : ""); }
  function dayLabel(pid, day) { return plan(pid).days[day - 1].map(segLabel).join(", "); }
  function hijri() {
    try { return new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { day: "numeric", month: "long", year: "numeric" }).format(new Date()).replace(/\s*AH$/, "") + " AH"; }
    catch (e) { return ""; }
  }
  function toast(msg) { var t = document.getElementById("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(function () { t.hidden = true; }, 2200); }

  // Streak with grace: one missed day is forgiven per 7 days of reading, so a single slip never resets the habit.
  function streak() {
    var set = {}; S.dates.forEach(function (d) { set[d] = 1; });
    var d = new Date(), n = 0, misses = 0;
    if (!set[iso(d)]) d.setDate(d.getDate() - 1);
    for (var guard = 0; guard < 4000; guard++) {
      if (set[iso(d)]) { n++; }
      else {
        var prev = new Date(d); prev.setDate(prev.getDate() - 1);
        if (!set[iso(prev)] || misses >= 1 + Math.floor(n / 7)) break;
        misses++;
      }
      d.setDate(d.getDate() - 1);
    }
    return n;
  }

  function getSurah(n) {
    if (CACHE[n]) return Promise.resolve(CACHE[n]);
    return fetch("data/quran/" + n + ".json").then(function (r) { if (!r.ok) throw new Error("surah " + n); return r.json(); })
      .then(function (s) { CACHE[n] = s; return s; });
  }

  // ---------------------------------------------------------------- Salah score
  function salahLessons() { return D.lessons.filter(function (l) { return l.id.charAt(0) !== "s" || S.salahSet[l.id]; }); }
  function salahScore() {
    var tot = 0, known = 0;
    salahLessons().forEach(function (l) { tot += l.words.length; if (S.lessons[l.id]) known += l.words.length; });
    return { tot: tot, known: known, pct: tot ? Math.round(known * 100 / tot) : 0 };
  }
  function ring(pct) {
    var r = 32, c = 2 * Math.PI * r, off = c * (1 - pct / 100);
    return '<svg class="ring" viewBox="0 0 76 76" role="img" aria-label="' + pct + ' percent understood">' +
      '<circle cx="38" cy="38" r="' + r + '" fill="none" stroke="var(--line)" stroke-width="7"/>' +
      '<circle cx="38" cy="38" r="' + r + '" fill="none" stroke="var(--lapis)" stroke-width="7" stroke-linecap="round" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '" transform="rotate(-90 38 38)"/>' +
      '<text x="38" y="43" text-anchor="middle" font-size="16" font-weight="600" fill="var(--ink)" font-family="Instrument Sans, system-ui, sans-serif">' + pct + '%</text></svg>';
  }

  // ---------------------------------------------------------------- views
  function viewWelcome() {
    var h = '<div class="welcome"><svg class="mark"><use href="#khatam"/></svg><div class="stack-sm"><span class="eyebrow">Assalamu alaikum</span><h1>Read today. See it lived.</h1>' +
      '<p class="lead" style="margin:0">Each day, read a short portion of the Quran. Then see a moment from the life of the Prophet ﷺ that shows it revealed or lived, and learn the words you say in Salah.</p></div>';
    h += '<section class="stack-sm"><div class="eyebrow">Where would you like to start?</div><div class="choice">';
    D.plans.forEach(function (p, i) {
      h += '<label><input type="radio" name="plan" value="' + p.id + '"' + (i === 0 ? " checked" : "") + '><span><b>' + esc(p.title) + '</b><br><span class="small muted">' + esc(p.sub) + ' · ' + p.days.length + ' days</span></span></label>';
    });
    h += '</div></section><section class="stack-sm"><div class="eyebrow">Which short surahs do you recite in Salah?</div><div class="choice">';
    [["s112", "Al-Ikhlas (112)"], ["s108", "Al-Kawthar (108)"], ["s103", "Al-‘Asr (103)"]].forEach(function (o) {
      h += '<label><input type="checkbox" data-wset="' + o[0] + '" checked><span>' + o[1] + '</span></label>';
    });
    h += '</div><span class="small muted">Al-Fatiha and the prayer phrases are always included.</span></section>';
    h += '<div class="pledge"><svg width="20" height="20"><use href="#i-shield"/></svg><span>' + T("pledge") + ' No account needed.</span></div>';
    h += '<button class="btn primary block" id="beginBtn">Begin</button></div>';
    return h;
  }

  function viewToday() {
    var p = plan(S.plan), day = nextDay(p.id), total = p.days.length, done = doneCount(p.id), sc = salahScore();
    var h = '<div class="stack"><div class="dayhead"><span class="hijri">' + esc(hijri()) + '</span>';
    if (day) {
      h += '<h1>Day ' + day + ' of ' + total + '</h1><p class="lead" style="margin:0">' + esc(p.title) + ' · ' + esc(p.blurb) + '</p></div>';
      h += '<section class="panel stack"><div class="eyebrow">Today’s reading</div><div class="surahchips">';
      p.days[day - 1].forEach(function (seg) {
        var m = meta(seg.s), count = seg.a ? seg.a[1] - seg.a[0] + 1 : m.count;
        h += '<span class="surahchip"><span class="ar" lang="ar">' + esc(m.ar) + '</span><span>' + esc(segLabel(seg)) + ' <span class="muted small">' + count + ' ayat</span></span></span>';
      });
      h += '</div><a class="btn primary block" href="#read/' + p.id + '/' + day + '">' + T("startReading") + '</a>';
      h += '<div class="stack-sm"><div class="row" style="justify-content:space-between"><span class="small muted">' + esc(p.title) + ' progress</span><span class="small muted">' + done + ' of ' + total + ' days</span></div><div class="track"><i style="width:' + (done * 100 / total) + '%"></i></div></div></section>';
      var cs = cardsFor(p.id, day);
      if (cs.length) {
        var c0 = cs[0];
        h += '<section class="lensteaser"><div class="eyebrow">' + T("lensAfter") + '</div><h3>' + esc(c0.title) + '</h3><p class="small muted" style="margin:0">' +
          (c0.pending ? "In preparation for scholar review" : esc(c0.type)) + ' · ' + esc(meta(c0.surah).tr) + ' ' + esc(c0.ayahs) + (cs.length > 1 ? ' · and one more card' : '') + '</p></section>';
      }
    } else {
      h += '<h1>' + esc(p.title) + ' complete</h1><p class="lead" style="margin:0">You have read all ' + total + ' days. Revisit any day, or <a href="#plans">start another plan</a>.</p></div>';
    }
    h += '<section class="panel meter">' + ring(sc.pct) + '<div class="stack-sm"><div class="eyebrow">Understand your Salah</div><div>You know <b>' + sc.known + '</b> of the <b>' + sc.tot + '</b> words you say in prayer.</div><a href="#salah" class="small">Next lesson</a></div></section>';
    h += lastWeek();
    if (installEvt) h += '<section class="notice"><span><b>' + T("install") + '.</b> ' + T("installHint") + '</span><button class="btn" id="installBtn">Install</button></section>';
    h += '<div class="pledge"><svg width="20" height="20"><use href="#i-shield"/></svg><span>' + T("pledge") + '</span></div></div>';
    return h;
  }
  function lastWeek() {
    var set = {}; S.dates.forEach(function (d) { set[d] = 1; });
    var h = '<section class="stack-sm"><div class="eyebrow">Last 7 days</div><div class="weekdots">';
    for (var i = 6; i >= 0; i--) { var d = new Date(); d.setDate(d.getDate() - i); h += '<span class="' + (set[iso(d)] ? "on" : "") + '" title="' + iso(d) + '">' + "SMTWTFS".charAt(d.getDay()) + '</span>'; }
    return h + '</div></section>';
  }

  function viewPlans() {
    var h = '<div class="stack"><div class="stack-sm"><span class="eyebrow">Reading plans</span><h1>What are you reading?</h1></div><div class="plans">';
    D.plans.forEach(function (p) {
      var dc = doneCount(p.id);
      h += '<a class="plan' + (p.id === S.plan ? " current" : "") + '" href="#plan/' + p.id + '"><div class="row"><h3>' + esc(p.title) + '</h3>' +
        (p.id === S.plan ? '<span class="pill lapis">Current</span>' : '') + '</div><span class="small muted">' + esc(p.sub) + ' · ' + p.days.length + ' days · ' + dc + ' done</span>' +
        '<div class="track"><i style="width:' + (dc * 100 / p.days.length) + '%"></i></div></a>';
    });
    return h + '</div></div>';
  }

  function viewPlan(pid) {
    var p = plan(pid), nd = nextDay(p.id);
    var h = '<div class="stack"><div class="stack-sm"><a href="#plans" class="small">← All plans</a><span class="eyebrow">' + p.days.length + '-day plan</span><h1>' + esc(p.title) + '</h1><p class="lead" style="margin:0">' + esc(p.blurb) + '</p>';
    if (p.id !== S.plan) h += '<div><button class="btn primary" data-useplan="' + p.id + '">Make this my daily plan</button></div>';
    h += '</div><div class="daylist">';
    p.days.forEach(function (_, i) {
      var day = i + 1, cs = cardsFor(p.id, day), done = isDone(p.id, day), cls = done ? "done" : (day === nd ? "next" : "");
      var href = '#read/' + p.id + '/' + day;
      h += '<div class="dayrow ' + cls + '"><a class="num" href="' + href + '" style="text-decoration:none;color:inherit" aria-label="Read day ' + day + '">' + (done ? "✓" : day) + '</a>' +
        '<a class="t" href="' + href + '" style="text-decoration:none;color:inherit"><div>' + esc(dayLabel(p.id, day)) + '</div><div>' + esc(cs.map(function (c) { return c.title; }).join(" · ")) + '</div></a>' +
        (cs.length ? '<a class="lenslink" href="#lens/' + p.id + '/' + day + '">Seerah Lens</a>' : '') + '</div>';
    });
    return h + '</div></div>';
  }

  function viewRead(pid, day) {
    var p = plan(pid), segs = p.days[day - 1];
    if (!segs) return Promise.resolve(viewPlan(pid));
    return Promise.all(segs.map(function (seg) { return getSurah(seg.s); })).then(function (list) {
      var h = '<div class="stack"><div class="readerbar"><div class="stack-sm"><a href="#plan/' + p.id + '" class="small">← ' + esc(p.title) + '</a><span class="eyebrow">Day ' + day + ' of ' + p.days.length + '</span><h2>' + esc(dayLabel(p.id, day)) + '</h2></div>' +
        '<div class="row"><label class="toggle"><input type="checkbox" id="tTranslit"' + (S.translit ? " checked" : "") + '>' + T("translit") + '</label><label class="toggle"><input type="checkbox" id="tEnglish"' + (S.english ? " checked" : "") + '>' + T("english") + '</label></div></div>';
      segs.forEach(function (seg, k) {
        var s = list[k], from = seg.a ? seg.a[0] : 1, to = seg.a ? seg.a[1] : s.verses.length;
        if (from === 1) {
          h += '<section><div class="surahhead"><span class="ar" lang="ar" dir="rtl">سورة ' + esc(s.ar) + '</span><span><b>' + s.n + '. ' + esc(s.tr) + '</b> <span class="muted">· ' + esc(s.en) + ' · ' + (s.type === "meccan" ? "Makki" : "Madani") + ' · ' + s.verses.length + ' ayat</span></span></div>';
          if (s.n !== 1 && s.n !== 9) h += '<div class="basmala" lang="ar" dir="rtl">بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ</div>';
        } else {
          h += '<section><div class="surahhead"><span class="ar" lang="ar" dir="rtl">سورة ' + esc(s.ar) + '</span><span><b>' + s.n + '. ' + esc(s.tr) + '</b> <span class="muted">· ' + esc(s.en) + '</span></span><span class="ayahrange">Ayat ' + from + '–' + to + '</span></div>';
        }
        s.verses.slice(from - 1, to).forEach(function (v) {
          h += '<div class="verse" id="v' + s.n + '-' + v[0] + '"><div class="ar" lang="ar" dir="rtl">' + esc(v[1]) + '<span class="marker">' + arNum(v[0]) + '</span></div>' +
            '<div class="tl"' + (S.translit ? "" : " hidden") + '>' + esc(v[2]) + '</div>' +
            '<div class="en"' + (S.english ? "" : " hidden") + '><b>' + s.n + ':' + v[0] + '</b>' + esc(v[3]) + '</div></div>';
        });
        h += '</section>';
      });
      var done = S.done[dayKey(p.id, day)];
      h += '<div class="finish">' + (done
        ? '<span class="pill ok" style="justify-self:center">Read on ' + esc(done) + '</span><a class="btn gold block" href="#lens/' + p.id + '/' + day + '">' + T("openLens") + '</a>'
        : '<button class="btn gold block" id="finishBtn" data-plan="' + p.id + '" data-day="' + day + '">' + T("finished") + '</button><span class="small muted">' + T("lensNext") + '</span>') + '</div>';
      return h + '</div>';
    });
  }

  function excerptHtml(x) {
    var short = x.arabic.length < 160;
    return '<div class="excerpt"><div class="ar' + (short ? " short" : "") + '" lang="ar" dir="rtl">' + esc(x.arabic) + '</div>' +
      '<div class="refline"><span class="src">' + esc(x.ref) + '</span>' + (x.grade ? '<span class="pill ok">' + esc(x.grade) + '</span>' : '') +
      '<a href="' + esc(x.url) + '" target="_blank" rel="noopener">Read the full text ↗</a></div>' +
      '<div class="pending">Verbatim Arabic. Licensed English translation of this excerpt to be added.</div></div>';
  }

  function cardHtml(c) {
    var s = meta(c.surah);
    if (c.pending) {
      return '<article class="lens pending"><div class="lens-band"><span><svg class="star" style="width:16px;height:16px"><use href="#khatam"/></svg>Seerah Lens</span><span>Pending scholar review</span></div><div class="lens-body">' +
        '<div class="lens-title"><span class="small muted">' + esc(s.tr) + ' · ' + c.surah + ':' + esc(c.ayahs) + '</span><h2>' + esc(c.title) + '</h2></div>' +
        '<div class="notice"><span><b>' + T("pendingTitle") + '.</b> ' + T("pendingBody") + '</span></div>' + reflectHtml(c, "What stayed with you from today’s reading?") + '</div></article>';
    }
    var h = '<article class="lens"><div class="lens-band"><span><svg class="star" style="width:16px;height:16px"><use href="#khatam"/></svg>Seerah Lens</span><span>' + esc(c.type) + '</span></div><div class="lens-body">';
    h += '<div class="lens-title"><span class="small muted">' + esc(s.tr) + ' · ' + c.surah + ':' + esc(c.ayahs) + '</span><h2>' + esc(c.title) + '</h2></div>';
    h += '<div class="stack-sm"><div class="section-label">' + T("summary") + '</div><p class="summary" style="margin:0">' + esc(c.summary) + '</p><span class="tiny muted">Our words, written only from the excerpts below.</span></div>';
    h += '<div class="stack-sm"><div class="section-label">' + T("forYou") + '</div><ul class="foryou">' + c.you.map(function (y) { return "<li><span>" + esc(y) + "</span></li>"; }).join("") + '</ul></div>';
    h += '<details class="stack-sm"><summary class="section-label" style="cursor:pointer">' + T("fromSources") + ' (' + c.x.length + ')</summary><div class="stack" style="margin-top:10px">' + c.x.map(excerptHtml).join("") + '</div></details>';
    h += reflectHtml(c, c.reflect);
    h += '<details class="concern"><summary>' + T("concern") + '</summary><textarea id="concern-' + c.id + '" placeholder="Source, grade, wording or summary issue"></textarea><div class="row"><button class="btn" data-concern="' + c.id + '">' + T("saveNote") + '</button><span class="small muted">Notes collect under Journal for the scholar panel.</span></div></details>';
    return h + '</div></article>';
  }
  function reflectHtml(c, prompt) {
    var saved = S.journal.filter(function (j) { return j.card === c.id; }).slice(-1)[0];
    return '<div class="reflect"><div class="section-label">' + T("reflect") + '</div><q>' + esc(prompt) + '</q>' +
      '<textarea id="reflect-' + c.id + '" placeholder="Write a line or two for yourself">' + (saved ? esc(saved.text) : "") + '</textarea>' +
      '<div class="row"><button class="btn" data-save="' + c.id + '">' + T("saveJournal") + '</button>' + (saved ? '<span class="saved">' + T("saved") + '</span>' : '') + '</div></div>';
  }

  function viewLens(pid, day) {
    var p = plan(pid), cs = cardsFor(p.id, day); if (!cs.length) return viewPlan(pid);
    var h = '<div class="stack"><div class="stack-sm"><a href="#plan/' + p.id + '" class="small">← ' + esc(p.title) + '</a><span class="eyebrow">Day ' + day + ' · ' + esc(dayLabel(p.id, day)) + '</span>';
    h += isDone(p.id, day) ? '<p class="lead" style="margin:0">You finished today’s reading. Here is how the Prophet ﷺ lived it.</p>' : '<p class="lead" style="margin:0">Best opened after <a href="#read/' + p.id + '/' + day + '">today’s reading</a>.</p>';
    h += '</div>' + cs.map(cardHtml).join("");
    var nd = nextDay(p.id);
    h += '<div class="row" style="justify-content:space-between"><a class="btn" href="#plan/' + p.id + '">' + T("allDays") + '</a>' + (nd && nd !== day ? '<a class="btn primary" href="#read/' + p.id + '/' + nd + '">Day ' + nd + '</a>' : '') + '</div>';
    return h + '</div>';
  }

  function viewSalah() {
    var sc = salahScore();
    var h = '<div class="stack"><div class="stack-sm"><span class="eyebrow">Understand your Salah</span><h1>Know every word you pray</h1><p class="lead" style="margin:0">Start with the words you already say five times a day. Each lesson takes about two minutes.</p></div>';
    h += '<section class="panel meter">' + ring(sc.pct) + '<div class="stack-sm"><div><b>' + sc.known + '</b> of <b>' + sc.tot + '</b> words understood</div><span class="small muted">Counts Al-Fatiha, the prayer phrases and the surahs you choose below.</span></div></section>';
    h += '<a class="lensteaser" href="#salah-intro" style="text-decoration:none;color:inherit"><div class="eyebrow">Seerah Lens · Al-Fatiha</div><h3>' + esc(D.salahCard.title) + '</h3><span class="small muted">Why each line of Al-Fatiha matters, from Sahih Muslim and Ibn Kathir</span></a><div class="lessons">';
    salahLessons().forEach(function (l) {
      var done = S.lessons[l.id];
      h += '<a class="lesson" href="#lesson/' + l.id + '"><div><b>' + esc(l.title) + '</b><span class="small muted">' + esc(l.ref) + ' · ' + l.words.length + ' words</span><span class="ar" lang="ar">' + esc(l.words.slice(0, 4).map(function (w) { return w[0]; }).join(" ")) + '</span></div>' +
        (done ? '<span class="pill ok">' + esc(done) + '</span>' : '<span class="pill lapis">Start</span>') + '</a>';
    });
    h += '</div><section class="panel stack-sm"><div class="eyebrow">Surahs I recite in Salah</div><div class="row">';
    [["s112", "Al-Ikhlas"], ["s108", "Al-Kawthar"], ["s103", "Al-‘Asr"]].forEach(function (o) {
      h += '<label class="toggle"><input type="checkbox" data-set="' + o[0] + '"' + (S.salahSet[o[0]] ? " checked" : "") + '>' + o[1] + '</label>';
    });
    return h + '</div></section></div>';
  }

  var Q = null;
  function viewLesson(id) {
    var l = D.lessons.filter(function (x) { return x.id === id; })[0]; if (!l) return viewSalah();
    var h = '<div class="stack"><div class="stack-sm"><a href="#salah" class="small">← Salah</a><span class="eyebrow">' + esc(l.ref) + '</span><h1>' + esc(l.title) + '</h1></div>';
    if (Q && Q.id === id && Q.i < Q.items.length) {
      var it = Q.items[Q.i];
      h += '<section class="panel quiz"><div class="row" style="justify-content:space-between"><span class="eyebrow">Test yourself</span><span class="small muted">' + (Q.i + 1) + ' of ' + Q.items.length + '</span></div><div class="ar" lang="ar" dir="rtl">' + esc(it.w[0]) + '</div><div class="opts">';
      it.opts.forEach(function (o, k) { h += '<button class="opt" data-opt="' + k + '">' + esc(o) + '</button>'; });
      return h + '</div></section></div>';
    }
    if (Q && Q.id === id && Q.i >= Q.items.length) {
      h += '<section class="panel stack" style="text-align:center"><h2>' + Q.right + ' of ' + Q.items.length + ' correct</h2><p class="muted" style="margin:0">Lesson marked as learned. Listen for these words in your next prayer.</p><a class="btn primary" href="#salah">Back to lessons</a></section></div>';
      Q = null; return h;
    }
    h += '<p class="lead" style="margin:0">Tap each word to see its meaning, then test yourself.</p><div class="words">';
    l.words.forEach(function (w) { h += '<button class="word hide" data-flip><span class="ar" lang="ar" dir="rtl">' + esc(w[0]) + '</span><span class="m">' + esc(w[1]) + '</span></button>'; });
    h += '</div>';
    if (l.x) h += '<div class="stack-sm"><div class="section-label">' + T("fromSources") + '</div>' + l.x.map(excerptHtml).join("") + '<p class="small muted" style="margin:0">Hudhayfah prayed behind the Prophet ﷺ at night: in bowing he said “Subhana rabbiyal-‘Azim”, on rising “Sami‘ Allahu liman hamidah”, and in prostration “Subhana rabbiyal-A‘la”.</p></div>';
    return h + '<button class="btn primary block" data-quiz="' + id + '">Test yourself</button></div>';
  }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function startQuiz(id) {
    var l = D.lessons.filter(function (x) { return x.id === id; })[0];
    var pool = []; D.lessons.forEach(function (x) { x.words.forEach(function (w) { if (pool.indexOf(w[1]) < 0) pool.push(w[1]); }); });
    var seen = {}, items = [];
    l.words.forEach(function (w) {
      if (seen[w[0] + w[1]]) return; seen[w[0] + w[1]] = 1;
      var wrong = shuffle(pool.filter(function (p) { return p !== w[1]; })).slice(0, 3);
      items.push({ w: w, opts: shuffle(wrong.concat([w[1]])) });
    });
    Q = { id: id, items: items, i: 0, right: 0 };
  }

  function viewJournal() {
    var h = '<div class="stack"><div class="stack-sm"><span class="eyebrow">Journal</span><h1>Your reflections</h1><p class="lead" style="margin:0">Saved on this device only.</p></div>';
    if (!S.journal.length) h += '<div class="panel muted">Your reflections from each Seerah Lens card will appear here. Finish a day’s reading and answer its question to add the first one.</div>';
    S.journal.slice().reverse().forEach(function (j) {
      var c = cardById(j.card), href = c && c.plan ? "#lens/" + c.plan + "/" + c.day : "#salah-intro";
      h += '<div class="entry"><div class="meta">' + esc(j.at) + ' · <a href="' + href + '">' + esc(c ? c.title : j.card) + '</a></div><div>' + esc(j.text) + '</div></div>';
    });
    h += '<div class="stack-sm" style="margin-top:12px"><div class="section-label">Review notes for the scholar panel</div>';
    if (!S.notes.length) h += '<p class="small muted" style="margin:0">Use “Report a concern” on any card to note a source, grade or wording issue. Notes collect here so you can copy them into one message.</p>';
    else {
      S.notes.forEach(function (n) { var c = cardById(n.card); h += '<div class="entry"><div class="meta">' + esc(n.at) + ' · ' + esc(c ? c.title : n.card) + '</div><div>' + esc(n.text) + '</div></div>'; });
      h += '<div class="row"><button class="btn" id="copyNotes">Copy all notes</button></div><textarea id="notesOut" readonly hidden></textarea>';
    }
    return h + '</div></div>';
  }

  function seg(name, opts, cur, attr) {
    return '<div class="seg" role="group" aria-label="' + esc(name) + '">' + opts.map(function (o) {
      return '<button ' + attr + '="' + o[0] + '" aria-pressed="' + (String(cur) === String(o[0])) + '"' + (o[2] ? " disabled" : "") + '>' + esc(o[1]) + '</button>';
    }).join("") + '</div>';
  }
  function viewSettings() {
    var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.matchMedia("(display-mode: standalone)").matches;
    var h = '<div class="stack"><div class="stack-sm"><span class="eyebrow">' + T("settings") + '</span><h1>Make it yours</h1></div><section class="panel">';
    h += '<div class="setting"><b>Language</b>' + seg("Language", LANGS.map(function (l) { return [l[0], l[1] + (STR[l[0]] ? "" : " · soon"), !STR[l[0]]]; }), S.lang, "data-lang") +
      '<span class="small muted">Hindi, Urdu and Telugu are on the way, with Quran meanings from licensed translations.</span></div>';
    h += '<div class="setting"><b>Arabic text size</b>' + seg("Text size", [[0.85, "Small"], [1, "Medium"], [1.2, "Large"], [1.4, "Extra large"]], S.qscale, "data-qscale") + '</div>';
    h += '<div class="setting"><b>Theme</b>' + seg("Theme", [["auto", "Match device"], ["light", "Light"], ["dark", "Dark"]], S.theme, "data-theme-set") + '</div>';
    h += '<div class="setting"><b>Install</b>' + (installEvt ? '<div><button class="btn" id="installBtn">Install Seerah Lens</button></div>'
      : ios ? '<span class="small muted">On iPhone: tap the Share button in Safari, then “Add to Home Screen”.</span>'
      : '<span class="small muted">Already installed, or use your browser menu: “Install app” / “Add to Home screen”.</span>') + '</div>';
    h += '<div class="setting"><b>Your data</b><span class="small muted">Everything stays on this device. Download a backup to move it to a new phone.</span><div class="row"><button class="btn" id="exportBtn">Download backup</button><label class="btn" style="cursor:pointer">Restore backup<input type="file" id="importFile" accept="application/json" hidden></label></div></div>';
    h += '<div class="setting"><b>Start over</b><div class="row"><button class="btn" id="resetBtn">Reset my progress</button><span class="small muted" id="resetMsg"></span></div></div>';
    h += '</section><a href="#about" class="small">About Seerah Lens, sources and privacy →</a></div>';
    return h;
  }

  function viewAbout() {
    var rows = [
      ["Quran (Arabic)", "Uthmani script from the Noble Qur’an Encyclopedia (QuranEnc), via the quran-json dataset", "Openly licensed, with attribution"],
      ["Transliteration", "Tanzil.net", "Free with attribution"],
      ["English meaning", "Marmaduke Pickthall, The Meaning of the Glorious Koran (1930)", "Public domain"],
      ["Hadith (Arabic)", "Sahih al-Bukhari, Sahih Muslim, Jami’ at-Tirmidhi, Sunan Ibn Majah", "Classical texts, public domain"],
      ["Tafsir (Arabic)", "Tafsir Ibn Kathir; editor’s footnotes removed", "Classical text, public domain"],
      ["Summaries, takeaways, word meanings", "Written for this app from the excerpts shown", "Draft for scholar review"]
    ];
    var h = '<div class="stack"><div class="stack-sm"><a href="#settings" class="small">← ' + T("settings") + '</a><span class="eyebrow">About</span><h1>Read today. See it lived.</h1></div><div class="prose">';
    h += '<p>Seerah Lens pairs a daily portion of the Quran with a moment from the life of the Prophet ﷺ that shows the passage revealed, applied or lived.</p>';
    h += '<p><b>How cards are made.</b> Each card shows excerpts copied word for word from accepted Sunni sources: Sahih al-Bukhari, Sahih Muslim, the Sunan, and Tafsir Ibn Kathir. The summary and “What’s in it for you” are written only from those excerpts. Every reference is checked against the Arabic before it is added, and cards stay hidden until they are verified.</p>';
    h += '<p><b>Status.</b> Early release for scholar review: Juz ‘Amma (15 days, 17 Seerah cards), Al-Kahf, Yasin and 9 Salah lessons.</p>';
    h += '<p><b>Privacy.</b> No ads, no trackers, no account. Everything you do here stays on this device.</p></div>';
    h += '<div class="scroll"><table class="srctable"><thead><tr><th>Content</th><th>Source</th><th>Rights</th></tr></thead><tbody>';
    rows.forEach(function (r) { h += '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td><td>' + esc(r[2]) + '</td></tr>'; });
    return h + '</tbody></table></div><p class="small muted">Version ' + esc(D.version) + '</p></div>';
  }

  // ---------------------------------------------------------------- theme
  function applyPrefs() {
    var r = document.documentElement;
    if (S.theme === "auto") r.removeAttribute("data-theme"); else r.setAttribute("data-theme", S.theme);
    r.style.setProperty("--qscale", S.qscale);
    r.lang = S.lang;
  }

  // ---------------------------------------------------------------- router
  function route() {
    var h = decodeURIComponent((location.hash || "#today").slice(1)), m, out, tab = "today";
    if (!S.onboarded && h !== "about") { out = viewWelcome(); tab = ""; }
    else if (h === "plans") { out = viewPlans(); tab = "days"; }
    else if (h === "days") { out = viewPlan(S.plan); tab = "days"; }
    else if ((m = h.match(/^plan\/(\w+)$/))) { out = viewPlan(m[1]); tab = "days"; }
    else if ((m = h.match(/^read\/(\w+)\/(\d+)$/))) { out = viewRead(m[1], +m[2]); tab = "days"; }
    else if ((m = h.match(/^lens\/(\w+)\/(\d+)$/))) { out = viewLens(m[1], +m[2]); tab = "days"; }
    else if ((m = h.match(/^day-(\d+)$/))) { out = viewRead("juz30", +m[1]); tab = "days"; }
    else if (h === "salah") { out = viewSalah(); tab = "salah"; }
    else if (h === "salah-intro") { out = '<div class="stack"><a href="#salah" class="small">← Salah</a>' + cardHtml(D.salahCard) + '</div>'; tab = "salah"; }
    else if ((m = h.match(/^lesson\/(\w+)$/))) { out = viewLesson(m[1]); tab = "salah"; }
    else if (h === "journal") { out = viewJournal(); tab = "journal"; }
    else if (h === "settings") { out = viewSettings(); tab = ""; }
    else if (h === "about") { out = viewAbout(); tab = ""; }
    else out = viewToday();
    var v = document.getElementById("view");
    Promise.resolve(out).then(function (html) {
      v.innerHTML = html;
      v.classList.remove("view"); void v.offsetWidth; v.classList.add("view");
    }, function () {
      v.innerHTML = '<div class="panel stack-sm"><b>This reading isn’t on your device yet.</b><span class="muted">Connect to the internet once to download it; after that it works offline.</span><a class="btn" href="#today">Back to Today</a></div>';
    });
    document.querySelectorAll(".tabs a").forEach(function (a) { if (a.dataset.tab === tab) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    document.querySelector(".tabs").hidden = !S.onboarded;
    document.getElementById("streakPill").textContent = streak() + " " + T("streak");
  }
  function go(hash) { if (location.hash === hash) route(); else location.hash = hash; window.scrollTo(0, 0); }

  // ---------------------------------------------------------------- events
  document.addEventListener("click", function (e) {
    var t = e.target.closest("button, [data-flip]"); if (!t) return;
    if (t.id === "beginBtn") {
      var picked = document.querySelector('input[name="plan"]:checked');
      S.plan = picked ? picked.value : "juz30";
      document.querySelectorAll("[data-wset]").forEach(function (b) { S.salahSet[b.dataset.wset] = b.checked; });
      S.onboarded = true; save(); go("#today"); return;
    }
    if (t.id === "finishBtn") {
      var pid = t.dataset.plan, day = +t.dataset.day, today = iso();
      S.done[dayKey(pid, day)] = today; if (S.dates.indexOf(today) < 0) S.dates.push(today); save();
      go(cardsFor(pid, day).length ? "#lens/" + pid + "/" + day : "#plan/" + pid); return;
    }
    if (t.dataset.useplan) { S.plan = t.dataset.useplan; save(); toast("Daily plan changed"); go("#today"); return; }
    if (t.dataset.save) {
      var id = t.dataset.save, txt = document.getElementById("reflect-" + id).value.trim();
      if (!txt) { toast("Write a line first"); return; }
      S.journal = S.journal.filter(function (j) { return j.card !== id; });
      S.journal.push({ card: id, text: txt, at: iso() }); save(); toast("Saved to journal"); route(); return;
    }
    if (t.dataset.concern) {
      var cid = t.dataset.concern, ct = document.getElementById("concern-" + cid).value.trim();
      if (!ct) { toast("Describe the concern first"); return; }
      S.notes.push({ card: cid, text: ct, at: iso() }); save(); toast("Review note saved under Journal"); document.getElementById("concern-" + cid).value = ""; return;
    }
    if (t.hasAttribute("data-flip")) { t.classList.toggle("hide"); return; }
    if (t.dataset.quiz) { startQuiz(t.dataset.quiz); route(); window.scrollTo(0, 0); return; }
    if (t.dataset.opt !== undefined && Q) {
      var it = Q.items[Q.i], pick = it.opts[+t.dataset.opt], ok = pick === it.w[1];
      document.querySelectorAll(".opt").forEach(function (b) { b.disabled = true; if (it.opts[+b.dataset.opt] === it.w[1]) b.classList.add("right"); });
      if (!ok) t.classList.add("wrong"); else Q.right++;
      setTimeout(function () { Q.i++; if (Q.i >= Q.items.length) { S.lessons[Q.id] = Q.right + "/" + Q.items.length; save(); } route(); }, ok ? 550 : 1300);
      return;
    }
    if (t.dataset.lang) { S.lang = t.dataset.lang; save(); applyPrefs(); route(); return; }
    if (t.dataset.qscale) { S.qscale = +t.dataset.qscale; save(); applyPrefs(); route(); return; }
    if (t.dataset.themeSet) { S.theme = t.dataset.themeSet; save(); applyPrefs(); route(); return; }
    if (t.id === "installBtn" && installEvt) {
      installEvt.prompt(); installEvt.userChoice.then(function () { installEvt = null; route(); }); return;
    }
    if (t.id === "exportBtn") {
      var blob = new Blob([JSON.stringify({ app: "seerah-lens", exported: iso(), data: S }, null, 1)], { type: "application/json" });
      var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "seerah-lens-backup-" + iso() + ".json";
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000); return;
    }
    if (t.id === "copyNotes") {
      var out = S.notes.map(function (n) { var c = cardById(n.card); return "[" + n.at + "] " + (c ? c.title + " (" + c.surah + ":" + c.ayahs + ")" : n.card) + "\n" + n.text; }).join("\n\n");
      var ta = document.getElementById("notesOut");
      var fallback = function () { ta.hidden = false; ta.value = out; ta.focus(); ta.select(); toast("Select and copy the notes below"); };
      try { navigator.clipboard.writeText(out).then(function () { toast("Notes copied"); }, fallback); } catch (err) { fallback(); }
      return;
    }
    if (t.id === "resetBtn") {
      if (t.dataset.armed) { var keep = { lang: S.lang, theme: S.theme, qscale: S.qscale }; S = base(); S.onboarded = true; for (var k in keep) S[k] = keep[k]; save(); toast("Progress reset"); go("#today"); }
      else { t.dataset.armed = "1"; t.textContent = "Tap again to reset"; document.getElementById("resetMsg").textContent = "This clears your days, journal and lessons on this device."; }
    }
  });
  document.addEventListener("change", function (e) {
    var t = e.target;
    if (t.id === "tTranslit") { S.translit = t.checked; save(); document.querySelectorAll(".verse .tl").forEach(function (x) { x.hidden = !t.checked; }); }
    if (t.id === "tEnglish") { S.english = t.checked; save(); document.querySelectorAll(".verse .en").forEach(function (x) { x.hidden = !t.checked; }); }
    if (t.dataset.set) { S.salahSet[t.dataset.set] = t.checked; save(); route(); }
    if (t.id === "importFile" && t.files[0]) {
      t.files[0].text().then(function (txt) {
        var o = JSON.parse(txt); if (!o || o.app !== "seerah-lens" || !o.data) throw new Error("bad");
        var b = base(); for (var k in b) if (!(k in o.data)) o.data[k] = b[k];
        S = o.data; save(); applyPrefs(); toast("Backup restored"); go("#today");
      }).catch(function () { toast("That file isn’t a Seerah Lens backup"); });
    }
  });
  window.addEventListener("hashchange", function () { route(); window.scrollTo(0, 0); });
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); installEvt = e; if (/^#?(today)?$/.test(location.hash) || location.hash === "#settings") route(); });
  window.addEventListener("appinstalled", function () { installEvt = null; toast("Installed"); });
  function netState() { document.getElementById("offline").hidden = navigator.onLine; }
  window.addEventListener("online", netState); window.addEventListener("offline", netState);

  // ---------------------------------------------------------------- boot
  applyPrefs(); netState();
  document.getElementById("offline").textContent = T("offline");
  Promise.all([fetch("data/content.json").then(function (r) { return r.json(); }), fetch("data/surahs.json").then(function (r) { return r.json(); })])
    .then(function (res) {
      D = res[0]; res[1].forEach(function (m) { SURAHS[m.n] = m; });
      if (!D.plans.some(function (p) { return p.id === S.plan; })) S.plan = D.plans[0].id;
      route();
    })
    .catch(function () { document.getElementById("view").innerHTML = '<div class="panel">Seerah Lens needs an internet connection the first time it opens.</div>'; });

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
  }
})();
