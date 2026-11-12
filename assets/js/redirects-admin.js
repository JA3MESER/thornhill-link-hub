/* ==========================================================================
   Thornhill Corporation — Link Hub: Redirects
   e.g. redirects.thornhillcorporation.co.uk/Roblox/Thornhill → any web address
   ========================================================================== */
(function () {
  const Store = window.ThornhillStore;
  const Sites = window.ThornhillSites;
  const Admin = window.ThornhillAdmin;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const PATH_RE = /^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/;
  const RESERVED = ["assets", "d", "index.html", "404.html", "cname"];

  const listEl = $("#redList");
  const modal = $("#redModal"), form = $("#redForm"), success = $("#redSuccess"), err = $("#redError");
  let items = [], loaded = false, query = "", editing = null, pendingDelete = null;

  const linkFor = path => Sites.redirects() + "/" + path;
  const pretty = url => url.replace(/^https?:\/\//, "");
  const session = () => Admin && Admin.session();

  async function load() {
    const s = session();
    if (!s) return;
    listEl.innerHTML = '<div class="empty"><strong>Loading redirects…</strong></div>';
    try {
      items = await Store.listRedirects(s.name, s.code);
      loaded = true;
      render();
    } catch (e) {
      if (e.status === 401) return Admin.expire();
      listEl.innerHTML = '<div class="empty"><strong>Couldn\'t load redirects</strong>' + esc(friendly(e)) + "</div>";
    }
  }

  function friendly(e) {
    const m = (e && e.message) || "";
    if (/redirect.*does not exist|function .* does not exist|schema cache/i.test(m))
      return "Redirects aren't set up in Supabase yet. Run supabase/redirects.sql in the SQL Editor.";
    if (/fetch/i.test(m)) return "Couldn't reach the server. Check your connection and try again.";
    return m || "Something went wrong.";
  }

  document.addEventListener("thornhill:view", e => { if (e.detail === "redirects" && !loaded) load(); });
  document.addEventListener("thornhill:login", () => { loaded = false; if (!$("#redirectsView").hidden) load(); });
  document.addEventListener("thornhill:logout", () => { items = []; loaded = false; listEl.innerHTML = ""; modal.classList.remove("open"); });
  $("#redSearch").addEventListener("input", e => { query = e.target.value.trim().toLowerCase(); render(); });

  /* ---------- list ---------- */
  function render() {
    $("#redStatTotal").textContent = items.length;
    $("#redStatClicks").textContent = items.reduce((n, r) => n + (r.clicks || 0), 0);
    const top = items.slice().sort((a, b) => (b.clicks || 0) - (a.clicks || 0))[0];
    $("#redStatTop").textContent = top && top.clicks ? "/" + top.path : "—";
    $("#redStatTop").title = top && top.clicks ? top.clicks + " clicks" : "";

    const rows = items.filter(r => !query || [r.path, r.destination, r.label].join(" ").toLowerCase().includes(query));
    if (!rows.length) {
      listEl.innerHTML = items.length
        ? '<div class="empty"><strong>No matching redirects</strong>Try a different search.</div>'
        : '<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="m15 10 5 5-5 5"/><path d="M4 4v7a4 4 0 0 0 4 4h12"/></svg><strong>No redirects yet</strong>Click <b>New redirect</b> to make your first short link.</div>';
      return;
    }
    listEl.innerHTML = rows.map(r => `
      <article class="red-row" data-id="${esc(r.id)}">
        <div class="red-main">
          <div class="red-short"><span class="dom">${esc(pretty(Sites.redirects()))}/</span>${esc(r.path)}</div>
          <div class="red-dest" title="${esc(r.destination)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            <span>${esc(pretty(r.destination))}</span>
          </div>
          ${r.label ? `<div class="red-label">${esc(r.label)}</div>` : ""}
        </div>
        <div class="red-clicks"><strong>${r.clicks || 0}</strong><span>click${r.clicks === 1 ? "" : "s"}</span></div>
        <div class="red-actions">
          <button class="btn btn-ghost btn-sm" type="button" data-act="copy">Copy</button>
          <a class="btn btn-ghost btn-sm" href="${esc(linkFor(r.path))}" target="_blank" rel="noopener">Test</a>
          <button class="btn btn-ghost btn-sm" type="button" data-act="edit">Edit</button>
          <button class="btn btn-danger btn-sm" type="button" data-act="delete" aria-label="Delete /${esc(r.path)}">Delete</button>
        </div>
      </article>`).join("");
  }

  listEl.addEventListener("click", e => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const r = items.find(x => x.id === btn.closest(".red-row").dataset.id);
    if (!r) return;
    if (btn.dataset.act === "copy") copy(linkFor(r.path));
    if (btn.dataset.act === "edit") open(r);
    if (btn.dataset.act === "delete") { pendingDelete = r; $("#redConfirmModal").classList.add("open"); $("#redCancelDelete").focus(); }
  });

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); window.toast("Link copied"); }
    catch (e) { window.prompt("Copy this link:", text); }
  }

  /* ---------- delete ---------- */
  $("#redCancelDelete").addEventListener("click", () => { $("#redConfirmModal").classList.remove("open"); pendingDelete = null; });
  $("#redConfirmModal").addEventListener("click", e => { if (e.target.id === "redConfirmModal") $("#redCancelDelete").click(); });
  $("#redConfirmDelete").addEventListener("click", async () => {
    const r = pendingDelete, s = session();
    $("#redConfirmModal").classList.remove("open");
    if (!r || !s) return;
    try {
      await Store.deleteRedirect(s.name, s.code, r.id);
      items = items.filter(x => x.id !== r.id);
      render();
      window.toast("Redirect deleted");
    } catch (e) {
      if (e.status === 401) return Admin.expire();
      window.toast("Couldn't delete: " + friendly(e), "error");
    }
  });

  /* ---------- new / edit ---------- */
  $("#newRedirectBtn").addEventListener("click", () => open(null));
  modal.addEventListener("click", e => { if (e.target === modal || e.target.closest("[data-close]")) modal.classList.remove("open"); });
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if ($("#redConfirmModal").classList.contains("open")) $("#redCancelDelete").click();
    else if (modal.classList.contains("open")) modal.classList.remove("open");
  });

  function open(r) {
    editing = r;
    form.reset();
    form.hidden = false; success.hidden = true;
    err.classList.remove("show");
    $("#redModalTitle").textContent = r ? "Edit redirect" : "New redirect";
    $("#redSaveBtn").textContent = r ? "Save changes" : "Create redirect";
    $("#redDest").value = r ? r.destination : "";
    $("#redPath").value = r ? r.path : "";
    $("#redLabel").value = r && r.label ? r.label : "";
    modal.classList.add("open");
    setTimeout(() => $("#redDest").focus(), 50);
  }

  // Tidy the short link as it's typed: spaces become dashes, unsupported characters are removed
  $("#redPath").addEventListener("input", () => {
    const el = $("#redPath"), pos = el.selectionStart, before = el.value;
    el.value = before.replace(/\s+/g, "-").replace(/[^A-Za-z0-9._\/-]/g, "").replace(/\/{2,}/g, "/").replace(/^\//, "");
    const shift = before.length - el.value.length;
    el.setSelectionRange(Math.max(0, pos - shift), Math.max(0, pos - shift));
  });

  function showErr(msg) { err.textContent = msg; err.classList.add("show"); }

  form.addEventListener("submit", async e => {
    e.preventDefault();
    err.classList.remove("show");
    const s = session();
    if (!s) return Admin.expire();

    let dest = $("#redDest").value.trim();
    if (dest && !/^[a-z]+:\/\//i.test(dest)) dest = "https://" + dest;   // allow "www.example.com"
    const path = $("#redPath").value.trim().replace(/^\/+|\/+$/g, "");
    const label = $("#redLabel").value.trim();

    let ok = false;
    try { const u = new URL(dest); ok = /^https?:$/.test(u.protocol) && !!u.hostname && !/\s/.test(dest); } catch (x) {}
    if (!ok) return showErr("Please enter the full web address to send people to, starting with https://");
    if (!path) return showErr("Please choose a short link, e.g. Roblox/Thornhill");
    if (path.length > 100 || !PATH_RE.test(path)) return showErr("The short link can only use letters, numbers, dashes, dots and underscores, with / between parts.");
    if (RESERVED.includes(path.split("/")[0].toLowerCase())) return showErr("That short link is reserved by the website. Please choose another.");

    const btn = $("#redSaveBtn"), label0 = btn.textContent;
    btn.disabled = true; btn.textContent = "Saving…";
    try {
      const res = await Store.saveRedirect(s.name, s.code, { id: editing ? editing.id : null, path, destination: dest, label }, s.display);
      await load();
      const link = linkFor(res.path);
      form.hidden = true; success.hidden = false;
      success.querySelector("h3").textContent = editing ? "Changes saved" : "Redirect ready";
      $("#redSuccessText").textContent = "Anyone who visits this link is sent straight to " + pretty(dest).split("/")[0] + ".";
      $("#redSuccessLink").textContent = pretty(link);
      $("#redSuccessOpen").href = link;
      $("#redSuccessCopy").onclick = () => copy(link);
    } catch (ex) {
      if (ex.status === 401) { modal.classList.remove("open"); return Admin.expire(); }
      showErr(friendly(ex));
    } finally {
      btn.disabled = false; btn.textContent = label0;
    }
  });
})();
