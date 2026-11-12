/* ==========================================================================
   Thornhill Corporation — Link Hub (staff only)
   Sign-in uses the same administrator names and codes as the main admin panel
   (checked on the server by Supabase). Nothing is shown until you sign in.
   ========================================================================== */
(function () {
  const Store = window.ThornhillStore;
  const Sites = window.ThornhillSites;
  const SESSION_KEY = "thornhill.hub.session";
  const VIEW_KEY = "thornhill.hub.view";
  const IDLE_LIMIT = 30 * 60 * 1000;

  const $ = s => document.querySelector(s);
  const loginView = $("#loginView"), dashView = $("#dashView");
  let session = null, idleTimer = null;

  // Links back to the main Thornhill website
  document.querySelectorAll("[data-main-link]").forEach(a => { a.href = Sites.main(); });
  document.querySelectorAll("[data-public-docs]").forEach(a => { a.href = Sites.main() + "/documents"; a.target = "_blank"; a.rel = "noopener"; });
  const redPrefix = $("#redPrefix");
  if (redPrefix) redPrefix.textContent = Sites.redirects().replace(/^https?:\/\//, "") + "/";

  const initials = n => String(n || "?").trim().split(/\s+/).slice(0, 2).map(p => p[0]).join("").toUpperCase();

  /* ---------- session ---------- */
  const save = s => { try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch (e) {} };
  const loadSaved = () => { try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch (e) { return null; } };
  const clear = () => { try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {} };

  function resetIdle() {
    clearTimeout(idleTimer);
    if (session) idleTimer = setTimeout(() => { logout(); window.toast("Signed out after 30 minutes of inactivity"); }, IDLE_LIMIT);
  }
  ["click", "keydown", "mousemove", "scroll", "touchstart"].forEach(ev => document.addEventListener(ev, resetIdle, { passive: true }));

  /* ---------- sign in ---------- */
  if (!Store.live) $("#demoNote").hidden = false;

  $("#toggleCode").addEventListener("click", () => {
    const i = $("#adminCode");
    i.type = i.type === "password" ? "text" : "password";
    $("#toggleCode").setAttribute("aria-label", i.type === "password" ? "Show code" : "Hide code");
  });

  let failures = 0, lockedUntil = 0;
  $("#loginForm").addEventListener("submit", async e => {
    e.preventDefault();
    const name = $("#adminName").value.trim(), code = $("#adminCode").value;
    $("#loginError").classList.remove("show");
    if (Date.now() < lockedUntil) return showError("Too many attempts. Please wait " + Math.ceil((lockedUntil - Date.now()) / 1000) + " seconds.");
    if (!name || !code) return showError("Please enter your full name and special code.");

    const btn = $("#loginBtn");
    btn.disabled = true; btn.textContent = "Checking…";
    try {
      const display = await Store.login(name, code);
      failures = 0;
      session = { name, code, display };
      save(session);
      $("#adminCode").value = "";
      enter();
    } catch (ex) {
      if (++failures >= 5) { lockedUntil = Date.now() + 60000; failures = 0; }
      showError(ex.message && !/fetch/i.test(ex.message) ? ex.message : "Couldn't reach the server. Check your connection and try again.");
    } finally {
      btn.disabled = false; btn.textContent = "Sign in";
    }
  });

  function showError(msg) {
    const err = $("#loginError");
    err.textContent = msg; err.classList.add("show");
    const card = document.querySelector(".login-card");
    card.classList.remove("shake"); void card.offsetWidth; card.classList.add("shake");
  }

  function enter() {
    loginView.style.display = "none";
    dashView.classList.add("show");
    $("#demoBanner").hidden = Store.live;
    $("#meName").textContent = session.display;
    $("#meAvatar").textContent = initials(session.display);
    resetIdle();
    let v = "documents";
    try { v = sessionStorage.getItem(VIEW_KEY) || v; } catch (e) {}
    showView(v === "redirects" ? "redirects" : "documents");
    document.dispatchEvent(new CustomEvent("thornhill:login", { detail: session }));
  }

  function logout() {
    session = null;
    clear(); clearTimeout(idleTimer);
    document.dispatchEvent(new Event("thornhill:logout"));
    dashView.classList.remove("show");
    loginView.style.display = "";
    $("#adminName").focus();
  }
  $("#logoutBtn").addEventListener("click", logout);

  /* ---------- tabs ---------- */
  function showView(name) {
    document.querySelectorAll(".view-switch [data-view]").forEach(b => {
      const on = b.dataset.view === name;
      b.classList.toggle("active", on); b.setAttribute("aria-selected", on);
    });
    $("#documentsView").hidden = name !== "documents";
    $("#redirectsView").hidden = name !== "redirects";
    document.title = (name === "redirects" ? "Redirects" : "Documents") + " — Thornhill Link Hub";
    try { sessionStorage.setItem(VIEW_KEY, name); } catch (e) {}
    document.dispatchEvent(new CustomEvent("thornhill:view", { detail: name }));
  }
  document.querySelectorAll(".view-switch [data-view]").forEach(b => b.addEventListener("click", () => showView(b.dataset.view)));

  // Shared with the Documents and Redirects modules
  window.ThornhillAdmin = {
    session: () => session,
    expire: () => { logout(); window.toast("Please sign in again", "error"); }
  };

  /* ---------- resume a session in this tab ---------- */
  const saved = loadSaved();
  if (saved && saved.name && saved.code) {
    session = saved;
    // Check the details are still valid before showing anything
    Store.login(saved.name, saved.code).then(display => { session.display = display; enter(); })
      .catch(() => { session = null; clear(); $("#adminName").focus(); });
  } else {
    $("#adminName").focus();
  }
})();
