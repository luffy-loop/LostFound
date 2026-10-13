import Auth from "./auth.js";
import {
  categories, statuses, getItems, migrateItems, createPost, updateStatus, addComment, deletePost,
  reportPost, getReports, resolveReport, setPostHidden, submitClaim, reviewClaim, sendMessage,
  getMessages, getUserNotifications, markNotificationRead, markAllNotificationsRead, getMatches, getAnalytics
} from "./posts.js";
import { esc, toast, theme, initTheme, closeDetails, openDetails } from "./ui.js";

Auth.require();
initTheme();
document.getElementById("themeBtn")?.addEventListener("click", theme);
document.getElementById("logoutBtn")?.addEventListener("click", () => Auth.logout());
document.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", closeDetails));
document.getElementById("detailsModal")?.addEventListener("click", event => { if (event.target.id === "detailsModal") closeDetails(); });
updateNotificationBadge();

const page = location.pathname.split("/").pop() || "index.html";
if (page === "login.html") initLogin();
if (page === "post.html") initPost();
if (page === "index.html" || page === "myposts.html" || page === "") initBoard(page === "myposts.html");
if (page === "notifications.html") initNotifications();
if (page === "admin.html") initAdmin();

function initLogin() {
  const input = document.getElementById("roll"), error = document.getElementById("loginError");
  const submit = () => {
    error.textContent = "";
    if (!Auth.login(input.value)) { error.textContent = "Campus ID must contain exactly 10 digits."; input.focus(); return; }
    location.href = "index.html";
  };
  document.getElementById("loginBtn")?.addEventListener("click", submit);
  input?.addEventListener("keydown", event => { if (event.key === "Enter") submit(); });
}
function initPost() {
  const lost = document.getElementById("lostBtn"), found = document.getElementById("foundBtn");
  const typeInput = document.getElementById("type"), file = document.getElementById("image"), preview = document.getElementById("preview");
  const setType = type => {
    typeInput.value = type; lost.classList.toggle("active", type === "Lost"); found.classList.toggle("active", type === "Found");
  };
  lost.addEventListener("click", () => setType("Lost"));
  found.addEventListener("click", () => setType("Found"));
  file.addEventListener("change", () => {
    const selected = file.files[0];
    if (!selected) return;
    if (!selected.type.startsWith("image/") || selected.size > 2 * 1024 * 1024) {
      toast("Choose an image smaller than 2 MB"); file.value = ""; preview.style.display = "none"; return;
    }
    preview.src = URL.createObjectURL(selected); preview.style.display = "block";
  });
  document.getElementById("postForm").addEventListener("submit", event => {
    event.preventDefault();
    const itemName = document.getElementById("itemName").value.trim();
    const description = document.getElementById("description").value.trim();
    const locationValue = document.getElementById("location").value.trim();
    if (!itemName || !description || !locationValue) { toast("Please complete the required fields"); return; }
    createPost({
      itemName, description, location: locationValue, category: document.getElementById("category").value,
      type: typeInput.value, occurredAt: document.getElementById("occurredAt").value,
      urgent: document.getElementById("urgent").checked, file: file.files[0]
    }, Auth.getUser(), () => { toast("Report published"); setTimeout(() => { location.href = "index.html"; }, 450); });
  });
}
function initBoard(onlyMine) {
  migrateItems();
  const container = document.getElementById("itemsContainer");
  const search = document.getElementById("search"), type = document.getElementById("typeFilter");
  const category = document.getElementById("categoryFilter"), status = document.getElementById("statusFilter");
  const locationFilter = document.getElementById("locationFilter"), sort = document.getElementById("sortFilter");
  const fromDate = document.getElementById("fromDate"), toDate = document.getElementById("toDate");
  if (category) {
    const current = category.value;
    category.innerHTML = '<option value="All">All categories</option>' + categories.map(value => '<option>' + esc(value) + '</option>').join("");
    category.value = current || "All";
  }
  if (locationFilter) {
    const current = locationFilter.value || "All";
    const locations = [...new Set(getItems().filter(item => !item.hidden).map(item => item.location).filter(Boolean))].sort();
    locationFilter.innerHTML = '<option value="All">All locations</option>' + locations.map(value => '<option value="' + esc(value) + '">' + esc(value) + '</option>').join("");
    locationFilter.value = locations.includes(current) ? current : "All";
  }
  const render = () => {
    const all = getItems();
    let items = all.filter(item => !item.hidden);
    if (onlyMine) items = items.filter(item => item.roll === Auth.getUser());
    const query = (search?.value || "").toLowerCase().trim();
    items = items.filter(item =>
      (!query || [item.itemName, item.description, item.location, item.category].some(value => String(value || "").toLowerCase().includes(query))) &&
      (!type || type.value === "All" || item.type === type.value) &&
      (!category || category.value === "All" || item.category === category.value) &&
      (!status || status.value === "All" || item.status === status.value) &&
      (!locationFilter || locationFilter.value === "All" || item.location === locationFilter.value) &&
      (!fromDate?.value || (item.occurredAt || item.createdAt.slice(0, 10)) >= fromDate.value) &&
      (!toDate?.value || (item.occurredAt || item.createdAt.slice(0, 10)) <= toDate.value)
    );
    if (sort?.value === "oldest") items.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    else if (sort?.value === "urgent") items.sort((a, b) => Number(b.urgent) - Number(a.urgent) || new Date(b.createdAt) - new Date(a.createdAt));
    else if (sort?.value === "matches" && query) items.sort((a, b) => matchScore(b, query) - matchScore(a, query));
    else items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    document.getElementById("totalCount")?.replaceChildren(String(all.filter(item => !item.hidden).length));
    document.getElementById("activeCount")?.replaceChildren(String(all.filter(item => !item.hidden && item.status === "Searching").length));
    document.getElementById("returnedCount")?.replaceChildren(String(all.filter(item => !item.hidden && item.status === "Returned").length));
    const result = document.getElementById("resultCount");
    if (result) result.textContent = items.length + " report" + (items.length === 1 ? "" : "s");
    container.innerHTML = items.length ? items.map(card).join("") : '<div class="empty"><h3>No matching reports</h3><p>Try changing your filters or post a new report.</p></div>';
  };
  const card = item => {
    const mine = item.roll === Auth.getUser();
    return '<article class="item">' + (item.image ? '<div class="img-box"><img src="' + esc(item.image) + '" alt="' + esc(item.itemName) + '"></div>' : "") +
      '<div class="card-body"><div class="card-top"><span class="badge ' + item.type.toLowerCase() + '">' + esc(item.type) + '</span>' + (item.urgent ? '<span class="badge urgent">Urgent</span>' : "") +
      '</div><h3>' + esc(item.itemName) + '</h3><p class="location">⌖ ' + esc(item.location) + '</p><p class="desc">' + esc(item.description) + '</p>' +
      '<div class="meta-row"><span>' + esc(item.category) + '</span><span class="badge status-pill">' + esc(item.status) + '</span></div>' +
      '<p class="posted">Campus user · ' + new Date(item.createdAt).toLocaleDateString() + (item.occurredAt ? ' · Event date ' + esc(item.occurredAt) : "") + '</p></div>' +
      '<div class="card-footer"><button class="secondary small" data-details="' + esc(item.id) + '">View details</button>' + (mine ? '<button class="ghost small danger" data-delete="' + esc(item.id) + '">Delete</button>' : "") + '</div></article>';
  };
  container.addEventListener("click", event => {
    const detail = event.target.closest("[data-details]"), del = event.target.closest("[data-delete]");
    if (detail) showDetails(detail.dataset.details);
    if (del && deletePost(del.dataset.delete, Auth.getUser())) { render(); toast("Post deleted"); }
  });
  [search, type, category, status, locationFilter, sort, fromDate, toDate].filter(Boolean).forEach(element => element.addEventListener("input", render));
  render();
  const requestedItem = new URLSearchParams(location.search).get("item");
  if (requestedItem) showDetails(requestedItem);
}
function matchScore(item, query) {
  const tokens = query.split(/[^a-z0-9]+/).filter(Boolean);
  return tokens.reduce((score, token) => score + ([item.itemName, item.description, item.location, item.category].some(value => String(value || "").toLowerCase().includes(token)) ? 1 : 0), 0);
}
function showDetails(id) {
  const item = getItems().find(entry => String(entry.id) === String(id));
  if (!item) return;
  const user = Auth.getUser(), mine = item.roll === user;
  const steps = statuses.map((status, index) => '<div class="step ' + (statuses.indexOf(item.status) >= index ? "done" : "") + " " + (item.status === status ? "current" : "") + '">' + status + '</div>').join("");
  const comments = (item.comments || []).slice(-5), claims = item.claims || [], matches = getMatches(item), messages = getMessages(item.id, user);
  const mapUrl = "https://www.openstreetmap.org/search?query=" + encodeURIComponent(item.location + " campus");
  const claimHistory = claims.filter(claim => claim.user === user || mine).map(claim =>
    '<div class="claim-row"><div><strong>Claim ' + esc(claim.status) + '</strong><p>' + (mine ? 'Claimant: campus user' : 'Your claim') + ' · ' + esc(new Date(claim.createdAt).toLocaleDateString()) +
    (mine ? '<p class="claim-proof">' + esc(claim.proof) + '</p>' : "") + '</p></div>' +
    (mine && claim.status === "Pending" ? '<div class="claim-actions"><button class="primary small" data-claim-decision="' + esc(claim.id) + '" data-decision="Approved">Approve</button><button class="secondary small" data-claim-decision="' + esc(claim.id) + '" data-decision="Rejected">Reject</button></div>' : "") + '</div>'
  ).join("");
  const messageSection = (!mine || messages.length) ? '<section class="detail-section"><h3>Private messages</h3><p class="muted">' +
    (mine ? 'Reply to the most recent person who messaged about this item.' : 'Demo messages are stored only in this browser and are not sent to another device.') +
    '</p><div class="message-thread">' + (messages.length ? messages.slice(-8).map(message =>
      '<div class="message-bubble ' + (message.from === user ? "mine" : "") + '"><small>' + (message.from === user ? "You" : "Campus user") + ' · ' + esc(new Date(message.createdAt).toLocaleString()) + '</small><p>' + esc(message.text) + '</p></div>'
    ).join("") : '<span class="muted">No messages yet.</span>') + '</div><textarea id="privateMessage" maxlength="500" placeholder="Write a message"></textarea><button class="primary full" id="sendMessage">Send message</button></section>' : "";
  openDetails('<div class="details-grid"><div>' +
    (item.image ? '<img class="details-image" src="' + esc(item.image) + '" alt="' + esc(item.itemName) + '">' : '<div class="details-placeholder">No image provided</div>') +
    '<a class="secondary map-link" target="_blank" rel="noopener noreferrer" href="' + esc(mapUrl) + '">Open location in map ↗</a>' +
    '<div class="matches-panel"><h3>Similar reports</h3>' + (matches.length ? matches.map(match => '<button class="match-card" data-details="' + esc(match.id) + '"><span class="badge ' + match.type.toLowerCase() + '">' + esc(match.type) + '</span><strong>' + esc(match.itemName) + '</strong><small>' + esc(match.location) + ' · ' + esc(match.category) + '</small></button>').join("") : '<p class="muted">No similar reports found yet.</p>') + '</div></div>' +
    '<div class="details-copy"><div class="card-top"><span class="badge ' + item.type.toLowerCase() + '">' + esc(item.type) + '</span>' + (item.urgent ? '<span class="badge urgent">Urgent</span>' : "") + '</div><h2>' + esc(item.itemName) + '</h2><div class="timeline">' + steps + '</div>' +
    '<div class="detail-line"><span>Location</span>' + esc(item.location) + '</div><div class="detail-line"><span>Category</span>' + esc(item.category) + '</div>' +
    '<div class="detail-line"><span>Date lost / found</span>' + esc(item.occurredAt || "Not specified") + '</div><div class="detail-line"><span>Status</span>' + esc(item.status) + '</div>' +
    '<div class="detail-line"><span>Poster</span>' + (mine ? "You" : "Campus user") + '</div><div class="detail-line"><span>Description</span>' + esc(item.description) + '</div>' +
    '<section class="detail-section"><h3>Comments</h3><div class="detail-comments">' + (comments.length ? comments.map(comment => '<div class="detail-comment"><strong>Campus user</strong> ' + esc(comment.text) + '</div>').join("") : '<span class="muted">No comments yet.</span>') + '</div><input class="comment-input" id="detailComment" maxlength="300" placeholder="Add a public comment and press Enter"></section>' +
    (!mine && item.type === "Found" ? '<section class="detail-section"><h3>Claim this item</h3><p class="muted">Describe a private identifying detail to help the finder verify ownership. Do not enter passwords, ID numbers, or contact details.</p><textarea id="claimProof" maxlength="300" placeholder="A detail only the owner would know"></textarea><button class="secondary full" id="submitClaim">Submit claim</button></section>' : "") +
    (claimHistory ? '<section class="detail-section"><h3>Claim history</h3>' + claimHistory + '</section>' : "") + messageSection +
    '<div class="detail-actions">' + (mine ? '<button class="secondary" id="advanceStatus">Advance status</button>' : "") + '<button class="ghost" id="shareItem">Copy share link</button>' + (!mine ? '<button class="ghost" id="reportItem">Report post</button>' : "") + '</div></div></div>');
  document.getElementById("detailComment")?.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (addComment(id, event.target.value, user)) { showDetails(id); updateNotificationBadge(); toast("Comment added"); }
      else toast("Enter a comment of up to 300 characters");
    }
  });
  document.getElementById("submitClaim")?.addEventListener("click", () => {
    if (submitClaim(id, document.getElementById("claimProof").value, user)) { showDetails(id); updateNotificationBadge(); toast("Claim sent to the finder"); }
    else toast("Add a claim detail or check whether you already have a pending claim");
  });
  document.querySelectorAll("[data-claim-decision]").forEach(button => button.addEventListener("click", () => {
    if (reviewClaim(id, button.dataset.claimDecision, button.dataset.decision, user)) { showDetails(id); updateNotificationBadge(); toast("Claim " + button.dataset.decision.toLowerCase()); }
  }));
  document.getElementById("sendMessage")?.addEventListener("click", () => {
    if (sendMessage(id, document.getElementById("privateMessage").value, user)) { showDetails(id); updateNotificationBadge(); toast("Message saved in this browser"); }
    else toast("Enter a message of up to 500 characters");
  });
  document.getElementById("advanceStatus")?.addEventListener("click", () => {
    const next = statuses[Math.min(statuses.indexOf(item.status) + 1, statuses.length - 1)];
    if (next !== item.status && updateStatus(id, next, user)) { showDetails(id); updateNotificationBadge(); toast("Status moved to " + next); }
    else if (next === item.status) toast("This item is already at the final status");
  });
  document.getElementById("reportItem")?.addEventListener("click", () => {
    const reason = prompt("Why should this post be reviewed? Do not include private information.");
    if (reason === null) return;
    if (reportPost(id, user, reason)) { updateNotificationBadge(); toast("Report sent for moderation"); }
    else toast("You cannot report your own post or duplicate an open report");
  });
  document.getElementById("shareItem")?.addEventListener("click", async () => {
    const shareUrl = new URL("index.html?item=" + encodeURIComponent(id), location.href).href;
    try { await navigator.clipboard.writeText(shareUrl); toast("Share link copied"); }
    catch { prompt("Copy this share link", shareUrl); }
  });
}
function initNotifications() {
  const list = document.getElementById("notificationsList");
  const render = () => {
    const notifications = getUserNotifications(Auth.getUser());
    list.innerHTML = notifications.length ? notifications.map(notification =>
      '<article class="notification-card ' + (notification.read ? "" : "unread") + '"><div class="notification-icon">' + esc(notification.type.slice(0, 1).toUpperCase()) + '</div>' +
      '<div class="notification-copy"><strong>' + esc(notification.title) + '</strong><p>' + esc(notification.message) + '</p><small>' + esc(new Date(notification.createdAt).toLocaleString()) + '</small></div><div class="notification-actions">' +
      (notification.itemId ? '<a class="secondary small" href="index.html?item=' + encodeURIComponent(notification.itemId) + '">Open item</a>' : "") +
      (!notification.read ? '<button class="ghost small" data-read="' + esc(notification.id) + '">Mark read</button>' : '<span class="muted">Read</span>') + '</div></article>'
    ).join("") : '<div class="empty"><h3>You are all caught up</h3><p>Claims, messages, and item updates will appear here in this browser.</p></div>';
    updateNotificationBadge();
  };
  list.addEventListener("click", event => {
    const button = event.target.closest("[data-read]");
    if (button) { markNotificationRead(button.dataset.read, Auth.getUser()); render(); }
  });
  document.getElementById("markAllRead")?.addEventListener("click", () => { markAllNotificationsRead(Auth.getUser()); render(); toast("Notifications marked as read"); });
  render();
}
function initAdmin() {
  const analytics = document.getElementById("analytics"), queue = document.getElementById("moderationQueue");
  const render = () => {
    const stats = getAnalytics(), allItems = getItems();
    analytics.innerHTML = [
      ["Visible reports", allItems.filter(item => !item.hidden).length], ["Lost items", stats.lost], ["Found items", stats.found],
      ["Returned", stats.returned], ["Pending claims", stats.pendingClaims], ["Open flags", stats.openReports]
    ].map(([label, value]) => '<article class="analytics-card"><span>' + esc(label) + '</span><strong>' + esc(value) + '</strong></article>').join("");
    const reports = getReports().filter(report => !report.resolved);
    document.getElementById("reportCount").textContent = reports.length + " open report" + (reports.length === 1 ? "" : "s");
    queue.innerHTML = reports.length ? reports.map(report => {
      const item = allItems.find(entry => String(entry.id) === String(report.id));
      return '<article class="moderation-card"><div><span class="badge urgent">Flagged</span><h3>' + esc(item?.itemName || "Deleted item") + '</h3><p>' + esc(report.reason) + '</p><small>Reported ' + esc(new Date(report.createdAt).toLocaleString()) + ' · Reporter identity hidden</small></div><div class="moderation-actions">' +
        (item ? '<button class="secondary small" data-details="' + esc(item.id) + '">Review item</button><button class="ghost small" data-hide="' + esc(item.id) + '" data-hidden="' + String(Boolean(item.hidden)) + '">' + (item.hidden ? "Restore post" : "Hide post") + '</button>' : "") +
        '<button class="primary small" data-resolve="' + esc(report.id) + '" data-reporter="' + esc(report.reporter) + '">Resolve flag</button></div></article>';
    }).join("") : '<div class="empty"><h3>No open reports</h3><p>Flagged posts will appear here for review.</p></div>';
    document.getElementById("locationInsights").innerHTML = stats.locations.length ? stats.locations.slice(0, 8).map(([name, count]) =>
      '<div class="location-bar-row"><span>' + esc(name) + '</span><div class="location-bar-track"><div class="location-bar" style="width:' + Math.round(count / Math.max(1, stats.locations[0][1]) * 100) + '%"></div></div><strong>' + count + '</strong></div>'
    ).join("") : '<p class="muted">No location data yet.</p>';
  };
  queue.addEventListener("click", event => {
    const detail = event.target.closest("[data-details]"), hide = event.target.closest("[data-hide]"), resolve = event.target.closest("[data-resolve]");
    if (detail) showDetails(detail.dataset.details);
    if (hide) { setPostHidden(hide.dataset.hide, hide.dataset.hidden !== "true"); render(); toast(hide.dataset.hidden === "true" ? "Post restored" : "Post hidden from the board"); }
    if (resolve) { resolveReport(resolve.dataset.resolve, resolve.dataset.reporter); render(); toast("Flag resolved"); }
  });
  render();
}
function updateNotificationBadge() {
  const unread = getUserNotifications(Auth.getUser()).filter(notification => !notification.read).length;
  document.querySelectorAll("#notificationBadge").forEach(badge => { badge.textContent = String(unread); badge.hidden = unread === 0; });
}