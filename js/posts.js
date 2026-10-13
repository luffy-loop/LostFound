const KEY = "items";
const REPORTS_KEY = "reportedItems";
const NOTIFICATIONS_KEY = "lfNotifications";
const MESSAGES_KEY = "lfMessages";
const statuses = ["Searching", "Contacted", "Submitted", "Returned"];
const categories = ["Electronics", "Documents", "Accessories", "Bags", "Keys", "Clothing", "Books", "Other"];
const getItems = () => JSON.parse(localStorage.getItem(KEY) || "[]");
const saveItems = items => localStorage.setItem(KEY, JSON.stringify(items));
const getNotifications = () => JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY) || "[]");
const saveNotifications = items => localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(items));
const getReports = () => JSON.parse(localStorage.getItem(REPORTS_KEY) || "[]").map(entry =>
  typeof entry === "string" ? { id: entry, reporter: "unknown", reason: "Legacy report", createdAt: new Date().toISOString(), resolved: false } : { resolved: false, ...entry }
);
const saveReports = reports => localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
const getMessagesStore = () => JSON.parse(localStorage.getItem(MESSAGES_KEY) || "[]");

function notify(user, type, title, message, itemId) {
  if (!user) return;
  const notifications = getNotifications();
  notifications.unshift({ id: Date.now() + Math.random(), user, type, title, message, itemId: String(itemId || ""), createdAt: new Date().toISOString(), read: false });
  saveNotifications(notifications.slice(0, 300));
}
function normalizeStatus(status) { return status === "Office" ? "Submitted" : statuses.includes(status) ? status : "Searching"; }
function migrateItems() {
  const items = getItems().map(item => ({ ...item, status: normalizeStatus(item.status), comments: Array.isArray(item.comments) ? item.comments : [], claims: Array.isArray(item.claims) ? item.claims : [], hidden: Boolean(item.hidden), occurredAt: item.occurredAt || "" }));
  saveItems(items);
  return items;
}
function createPost(data, user, onDone) {
  const finish = image => {
    const items = migrateItems();
    items.unshift({ id: Date.now(), itemName: data.itemName, description: data.description, location: data.location, category: data.category, type: data.type, urgent: Boolean(data.urgent), image: image || null, roll: user, status: "Searching", occurredAt: data.occurredAt || "", createdAt: new Date().toISOString(), comments: [], claims: [], hidden: false });
    saveItems(items); onDone();
  };
  if (data.file) {
    const reader = new FileReader();
    reader.onerror = () => { throw new Error("Could not read the selected image."); };
    reader.onload = () => finish(reader.result);
    reader.readAsDataURL(data.file);
  } else finish(null);
}
function updateStatus(id, status, user) {
  const items = migrateItems(), item = items.find(entry => String(entry.id) === String(id));
  if (!item || item.roll !== user || !statuses.includes(status)) return false;
  if (status === "Returned" && !confirm("Mark this item as returned? Confirm only after the handover has actually happened.")) return false;
  if (item.status === status) return false;
  const previous = item.status; item.status = status; item.updatedAt = new Date().toISOString(); saveItems(items);
  const interested = new Set((item.claims || []).map(claim => claim.user).filter(Boolean));
  getMessagesStore().filter(message => String(message.itemId) === String(id)).forEach(message => interested.add(message.from === user ? message.to : message.from));
  interested.delete(user);
  interested.forEach(recipient => notify(recipient, "status", "Item status updated", item.itemName + " moved from " + previous + " to " + status + ".", id));
  return true;
}
function addComment(id, text, user) {
  const items = migrateItems(), item = items.find(entry => String(entry.id) === String(id));
  if (!item || !text.trim() || text.trim().length > 300) return false;
  item.comments.push({ roll: user, text: text.trim(), createdAt: new Date().toISOString() }); saveItems(items);
  if (item.roll !== user) notify(item.roll, "comment", "New comment", "Someone commented on " + item.itemName + ".", id);
  return true;
}
function deletePost(id, user) {
  const items = migrateItems(), item = items.find(entry => String(entry.id) === String(id));
  if (!item || item.roll !== user || !confirm("Delete this post?")) return false;
  saveItems(items.filter(entry => String(entry.id) !== String(id)));
  saveReports(getReports().filter(report => String(report.id) !== String(id)));
  localStorage.setItem(MESSAGES_KEY, JSON.stringify(getMessagesStore().filter(message => String(message.itemId) !== String(id))));
  return true;
}
function reportPost(id, reporter, reason) {
  const item = migrateItems().find(entry => String(entry.id) === String(id));
  if (!item || item.roll === reporter) return false;
  const reports = getReports();
  if (reports.some(report => String(report.id) === String(id) && report.reporter === reporter && !report.resolved)) return false;
  reports.unshift({ id: String(id), reporter, reason: (reason || "Inappropriate or inaccurate content").trim().slice(0, 240), createdAt: new Date().toISOString(), resolved: false });
  saveReports(reports); notify(item.roll, "report", "Report received", "A community member flagged your post for review.", id); return true;
}
function resolveReport(id, reporter) {
  const reports = getReports(), report = reports.find(entry => String(entry.id) === String(id) && entry.reporter === reporter && !entry.resolved);
  if (!report) return false;
  report.resolved = true; saveReports(reports); return true;
}
function setPostHidden(id, hidden) {
  const items = migrateItems(), item = items.find(entry => String(entry.id) === String(id));
  if (!item) return false;
  item.hidden = Boolean(hidden); saveItems(items); return true;
}
function submitClaim(id, proof, user) {
  const items = migrateItems(), item = items.find(entry => String(entry.id) === String(id));
  if (!item || item.type !== "Found" || item.roll === user || !proof.trim() || proof.trim().length > 300) return false;
  item.claims = item.claims || [];
  if (item.claims.some(claim => claim.user === user && claim.status === "Pending")) return false;
  item.claims.push({ id: Date.now() + Math.random(), user, proof: proof.trim(), status: "Pending", createdAt: new Date().toISOString() });
  saveItems(items); notify(item.roll, "claim", "New item claim", "Someone submitted a claim for " + item.itemName + ".", id); return true;
}
function reviewClaim(itemId, claimId, decision, user) {
  const items = migrateItems(), item = items.find(entry => String(entry.id) === String(itemId));
  if (!item || item.roll !== user || !["Approved", "Rejected"].includes(decision)) return false;
  const claim = (item.claims || []).find(entry => String(entry.id) === String(claimId) && entry.status === "Pending");
  if (!claim) return false;
  claim.status = decision; claim.reviewedAt = new Date().toISOString();
  if (decision === "Approved" && item.status === "Searching") item.status = "Contacted";
  saveItems(items);
  notify(claim.user, "claim", "Claim " + decision.toLowerCase(), "Your claim for " + item.itemName + " was " + decision.toLowerCase() + ". Coordinate a safe handover with the finder.", itemId);
  return true;
}
function sendMessage(itemId, text, from) {
  const item = migrateItems().find(entry => String(entry.id) === String(itemId)), messageText = String(text || "").trim();
  if (!item || !messageText || messageText.length > 500) return false;
  const messages = getMessagesStore();
  let recipient = item.roll;
  if (from === item.roll) {
    const lastIncoming = messages.filter(message => String(message.itemId) === String(itemId) && message.to === from).slice(-1)[0];
    if (!lastIncoming) return false;
    recipient = lastIncoming.from;
  } else if (item.roll !== from) {
    recipient = item.roll;
  }
  if (!recipient || recipient === from) return false;
  messages.push({ id: Date.now() + Math.random(), itemId: String(itemId), from, to: recipient, text: messageText, createdAt: new Date().toISOString() });
  localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages.slice(-1000)));
  notify(recipient, "message", "New private message", "Someone sent you a message about " + item.itemName + ".", itemId); return true;
}
function getMessages(itemId, user) { return getMessagesStore().filter(message => String(message.itemId) === String(itemId) && (message.from === user || message.to === user)); }
function getUserNotifications(user) { return getNotifications().filter(notification => notification.user === user); }
function markNotificationRead(id, user) {
  const notifications = getNotifications(), notification = notifications.find(entry => String(entry.id) === String(id) && entry.user === user);
  if (!notification) return false;
  notification.read = true; saveNotifications(notifications); return true;
}
function markAllNotificationsRead(user) {
  const notifications = getNotifications();
  notifications.forEach(notification => { if (notification.user === user) notification.read = true; });
  saveNotifications(notifications);
}
function getMatches(item, limit = 3) {
  if (!item) return [];
  const words = value => new Set(String(value || "").toLowerCase().split(/[^a-z0-9]+/).filter(word => word.length > 2));
  const itemWords = words(item.itemName + " " + item.description);
  return migrateItems().filter(other => String(other.id) !== String(item.id) && !other.hidden && other.type !== item.type).map(other => {
    const otherWords = words(other.itemName + " " + other.description);
    let score = other.category === item.category ? 3 : 0;
    if (other.location.toLowerCase() === item.location.toLowerCase()) score += 2;
    for (const word of itemWords) if (otherWords.has(word)) score += 1;
    return { ...other, matchScore: score };
  }).filter(other => other.matchScore > 0).sort((a, b) => b.matchScore - a.matchScore || new Date(b.createdAt) - new Date(a.createdAt)).slice(0, limit);
}
function getAnalytics() {
  const items = migrateItems(), reports = getReports().filter(report => !report.resolved), locations = {};
  items.filter(item => !item.hidden).forEach(item => { const key = item.location || "Unspecified"; locations[key] = (locations[key] || 0) + 1; });
  return {
    total: items.length, lost: items.filter(item => item.type === "Lost" && !item.hidden).length,
    found: items.filter(item => item.type === "Found" && !item.hidden).length,
    returned: items.filter(item => item.status === "Returned" && !item.hidden).length,
    pendingClaims: items.reduce((sum, item) => sum + (item.claims || []).filter(claim => claim.status === "Pending").length, 0),
    openReports: reports.length, locations: Object.entries(locations).sort((a, b) => b[1] - a[1])
  };
}
export {
  categories, statuses, getItems, migrateItems, createPost, updateStatus, addComment, deletePost,
  reportPost, getReports, resolveReport, setPostHidden, submitClaim, reviewClaim, sendMessage,
  getMessages, getUserNotifications, markNotificationRead, markAllNotificationsRead, getMatches, getAnalytics
};