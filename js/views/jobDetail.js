import { state } from "../state.js";
import {
  getJob,
  updateJob,
  getOrCreateThread,
  listThreadsForJob,
  listMyThreadForJob,
  updateThread,
  listMessages,
  sendMessage,
  subscribeToThread,
  submitRating,
  getRatingForJob,
  fileDispute,
  uploadPublicFile,
  revealJobPhone,
} from "../db.js";
import { escapeHtml, timeAgo, badgeHtml, toast, confirmDialog, openModal, closeModal, photoGridHtml } from "../ui.js";
import { navigate } from "../router.js";
import { createMap, pinIcon } from "../leafletHelpers.js";
import { JOB_STATUS_LABELS, SERVICE_CATEGORIES, STORAGE_BUCKETS, MAX_PHOTO_MB, formatCurrency } from "../config.js";

let unsubscribe = null;

export async function renderJobDetail({ id }) {
  if (!state.user) return navigate("/login");
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }

  document.getElementById("app").innerHTML = `<div class="container"><div class="loading-screen"><div class="spinner"></div>Loading job…</div></div>`;

  let job;
  try {
    job = await getJob(id);
  } catch (err) {
    toast(err.message || "Could not load job", "error");
  }
  if (!job) {
    document.getElementById("app").innerHTML = `<div class="container"><div class="empty-state"><div class="big">🚫</div><strong>Job not found</strong><div class="small">It may have been closed or is no longer available.</div></div></div>`;
    return;
  }

  const isCustomer = job.customer_id === state.user.id;
  const isAcceptedPro = job.accepted_pro_id === state.user.id;
  const isOutsidePro = !isCustomer && !isAcceptedPro;
  // The number itself is never in `job` — it is fetched on demand through
  // reveal_job_phone(), which re-checks all of this server-side and logs the
  // reveal. This flag only decides whether to offer the button.
  const canRevealPhone =
    (isCustomer || isAcceptedPro) &&
    !!job.accepted_pro_id &&
    ["accepted", "in_progress", "completed", "disputed"].includes(job.status);

  document.getElementById("app").innerHTML = `
    <div class="container-narrow">
      <div class="card">
        <div class="row" style="align-items:flex-start;">
          <div class="col">
            <div class="row" style="align-items:center;gap:8px;flex-wrap:wrap;">
              <h2 style="margin:0;">${escapeHtml(job.title)}</h2>
              ${badgeHtml(job.status, JOB_STATUS_LABELS)}
            </div>
            <div class="tiny muted" style="margin-top:4px;">${escapeHtml(job.custom_category || job.category)} · posted ${timeAgo(job.created_at)}</div>
          </div>
          <div style="text-align:right;">
            ${job.offer_amount ? `<div><strong>${formatCurrency(job.offer_amount)}</strong> / ${escapeHtml(job.offer_unit)}</div>` : `<div class="muted small">Offer TBD</div>`}
            ${job.offer_negotiable ? `<div class="tiny muted">Negotiable</div>` : ""}
          </div>
        </div>

        ${job.description ? `<p style="margin-top:14px;">${escapeHtml(job.description)}</p>` : ""}

        <div id="jobPhotosArea">${photoGridHtml((job.photo_urls || []).map((url, i) => ({ url, key: i })))}</div>
        ${
          isCustomer
            ? `<label class="file-input-label" style="margin-top:10px;">
                📸 ${job.photo_urls?.length ? "Add more photos" : "Add photos"}
                <input type="file" id="addJobPhotoInput" accept="image/*" multiple />
              </label>`
            : ""
        }

        <div id="jobMiniMap" class="leaflet-map" style="height:180px;margin-top:12px;"></div>

        <div class="kv-list" style="margin-top:14px;">
          <div class="kv-row"><span class="muted">Posted by</span><span>${job.customer ? escapeHtml(job.customer.full_name) : "—"}</span></div>
          ${job.pro ? `<div class="kv-row"><span class="muted">Accepted pro</span><span>${escapeHtml(job.pro.full_name)}</span></div>` : ""}
          ${
            canRevealPhone
              ? `<div class="kv-row">
                  <span class="muted">Contact phone</span>
                  <span id="phoneReveal">
                    <button class="btn btn-sm" id="revealPhoneBtn">Reveal phone number</button>
                  </span>
                </div>`
              : ""
          }
        </div>

        <div id="statusActions" class="row wrap" style="margin-top:14px;gap:8px;"></div>
      </div>

      <div id="threadsArea" style="margin-top:14px;"></div>
      <div id="ratingArea" style="margin-top:14px;"></div>
    </div>
  `;

  const map = createMap("jobMiniMap", { center: { lat: job.lat, lng: job.lng }, zoom: 13 });
  if (map) L.marker([job.lat, job.lng], { icon: pinIcon({ emoji: "🧰", bg: "#ff6a1a" }) }).addTo(map);

  const addPhotoInput = document.getElementById("addJobPhotoInput");
  if (addPhotoInput) {
    addPhotoInput.addEventListener("change", async (e) => {
      const files = Array.from(e.target.files || []);
      e.target.value = "";
      if (!files.length) return;
      const urls = [...(job.photo_urls || [])];
      for (const file of files) {
        if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
          toast(`"${file.name}" is over ${MAX_PHOTO_MB}MB — skipped`, "error");
          continue;
        }
        try {
          const { url } = await uploadPublicFile(STORAGE_BUCKETS.jobPhotos, job.id, file);
          urls.push(url);
        } catch (err) {
          toast(err.message || `Could not upload "${file.name}"`, "error");
        }
      }
      try {
        job.photo_urls = urls;
        await updateJob(job.id, { photo_urls: urls });
        document.getElementById("jobPhotosArea").innerHTML = photoGridHtml(urls.map((url, i) => ({ url, key: i })));
      } catch (err) {
        toast(err.message || "Could not save photos", "error");
      }
    });
  }

  const revealBtn = document.getElementById("revealPhoneBtn");
  if (revealBtn) {
    revealBtn.addEventListener("click", async () => {
      revealBtn.disabled = true;
      revealBtn.textContent = "Revealing…";
      try {
        const contact = await revealJobPhone(job.id);
        const target = document.getElementById("phoneReveal");
        if (target) {
          target.innerHTML = `<a href="tel:${escapeHtml(contact.phone)}">${escapeHtml(contact.phone)}</a>`;
        }
      } catch (err) {
        toast(err.message || "Could not get that phone number", "error");
        revealBtn.disabled = false;
        revealBtn.textContent = "Reveal phone number";
      }
    });
  }

  renderStatusActions(job, isCustomer, isAcceptedPro);

  if (isCustomer) {
    await renderCustomerThreads(job);
  } else if (isAcceptedPro || job.status === "open") {
    await renderProThread(job, isOutsidePro);
  }

  if (job.status === "completed" && (isCustomer || isAcceptedPro)) {
    await renderRatingArea(job, isCustomer);
  }
}

// ---------------- Status transitions ----------------
function renderStatusActions(job, isCustomer, isAcceptedPro) {
  const el = document.getElementById("statusActions");
  const buttons = [];

  if (isCustomer && job.status === "open") {
    buttons.push(`<span class="small muted">Waiting for you to pick a pro from the messages below.</span>`);
  }
  if ((isCustomer || isAcceptedPro) && job.status === "accepted") {
    buttons.push(`<button class="btn btn-primary btn-sm" id="startJobBtn">Mark as started</button>`);
  }
  if ((isCustomer || isAcceptedPro) && job.status === "in_progress") {
    buttons.push(`<button class="btn btn-primary btn-sm" id="completeJobBtn">Mark as completed</button>`);
  }
  if (isCustomer && ["open", "accepted"].includes(job.status)) {
    buttons.push(`<button class="btn btn-danger btn-sm" id="cancelJobBtn">Cancel job</button>`);
  }
  if ((isCustomer || isAcceptedPro) && ["accepted", "in_progress", "completed"].includes(job.status)) {
    buttons.push(`<button class="btn btn-sm" id="disputeBtn">⚠️ File an appeal</button>`);
  }

  el.innerHTML = buttons.join("");

  const bind = (id, fn) => {
    const b = document.getElementById(id);
    if (b) b.addEventListener("click", fn);
  };
  bind("startJobBtn", () => transition(job, "in_progress"));
  bind("completeJobBtn", () => transition(job, "completed"));
  bind("cancelJobBtn", async () => {
    if (await confirmDialog("Cancel this job? This can't be undone.", { okLabel: "Cancel job", danger: true })) {
      await transition(job, "cancelled");
    }
  });
  bind("disputeBtn", () => openDisputeModal(job, isCustomer));
}

async function transition(job, status) {
  try {
    await updateJob(job.id, { status });
    toast(`Job marked as ${JOB_STATUS_LABELS[status].toLowerCase()}`, "success");
    renderJobDetail({ id: job.id });
  } catch (err) {
    toast(err.message || "Could not update job", "error");
  }
}

function openDisputeModal(job, isCustomer) {
  const againstId = isCustomer ? job.accepted_pro_id : job.customer_id;
  const againstName = isCustomer ? job.pro?.full_name : job.customer?.full_name;
  if (!againstId) {
    toast("No other party on this job yet.", "error");
    return;
  }
  const modal = openModal(`
    <div class="modal-head"><h3>File an appeal</h3><button class="modal-close" id="closeDisputeModal">×</button></div>
    <p class="small muted">This is visible to you and ${escapeHtml(againstName || "the other party")}. Use this if something went wrong with the job.</p>
    <form id="disputeForm" class="stack">
      <div class="field">
        <label>Reason</label>
        <select id="disputeReason">
          <option>Didn't show up</option>
          <option>Work not as described</option>
          <option>Payment dispute</option>
          <option>Safety / conduct concern</option>
          <option>Other</option>
        </select>
      </div>
      <div class="field">
        <label>Details</label>
        <textarea id="disputeDetails" placeholder="What happened?"></textarea>
      </div>
      <button class="btn btn-primary btn-block" type="submit">Submit appeal</button>
    </form>
  `);
  modal.querySelector("#closeDisputeModal").addEventListener("click", closeModal);
  modal.querySelector("#disputeForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await fileDispute(
        job.id,
        state.user.id,
        againstId,
        document.getElementById("disputeReason").value,
        document.getElementById("disputeDetails").value.trim()
      );
      toast("Appeal submitted.", "success");
      closeModal();
    } catch (err) {
      toast(err.message || "Could not submit appeal", "error");
    }
  });
}

// ---------------- Customer: list of interested pros ----------------
async function renderCustomerThreads(job) {
  const area = document.getElementById("threadsArea");
  area.innerHTML = `<h3>Messages</h3><div id="threadList" class="muted small">Loading…</div>`;

  let threads = [];
  try {
    threads = await listThreadsForJob(job.id);
  } catch (err) {
    toast(err.message || "Could not load messages", "error");
    return;
  }

  const listEl = document.getElementById("threadList");
  if (threads.length === 0) {
    listEl.innerHTML = `<p class="muted small">No pros have messaged you about this job yet.</p>`;
    return;
  }

  listEl.innerHTML = threads
    .map(
      (t) => `
      <div class="thread-item" data-thread="${t.id}">
        <div class="col">
          <strong>${escapeHtml(t.pro.full_name)}</strong>
          ${t.offer_amount ? `<div class="tiny muted">Offered ${formatCurrency(t.offer_amount)}</div>` : ""}
          ${t.status === "accepted" ? `<span class="badge badge-completed">Accepted</span>` : ""}
        </div>
        <a href="#/profile/${t.pro_id}" class="btn btn-sm" onclick="event.stopPropagation()">Profile</a>
      </div>`
    )
    .join("");

  listEl.querySelectorAll(".thread-item").forEach((elm) => {
    elm.addEventListener("click", () => openThreadPanel(job, threads.find((t) => t.id === elm.dataset.thread), true));
  });

  // Auto-open the accepted thread, or the first one, for convenience.
  const toOpen = threads.find((t) => t.status === "accepted") || threads[0];
  if (job.status !== "open" || threads.length === 1) openThreadPanel(job, toOpen, true);
}

function openThreadPanel(job, thread, isCustomer) {
  let panel = document.getElementById("threadPanel");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "threadPanel";
    panel.className = "card";
    document.getElementById("threadsArea").appendChild(panel);
  }
  panel.innerHTML = `
    <div class="row" style="align-items:center;">
      <strong>Chat with ${escapeHtml(isCustomer ? thread.pro?.full_name || "pro" : "customer")}</strong>
      <span class="spacer"></span>
      ${
        isCustomer && job.status === "open"
          ? `<button class="btn btn-primary btn-sm" id="acceptProBtn">Accept this pro</button>`
          : ""
      }
    </div>
    <div class="chat-list" id="chatList"></div>
    <div class="chat-input-row">
      <textarea id="chatInput" placeholder="Type a message…"></textarea>
      <button class="btn btn-primary" id="sendMsgBtn">Send</button>
    </div>
  `;

  const acceptBtn = document.getElementById("acceptProBtn");
  if (acceptBtn) {
    acceptBtn.addEventListener("click", async () => {
      if (!(await confirmDialog(`Accept ${thread.pro?.full_name || "this pro"} for this job?`))) return;
      try {
        await updateJob(job.id, { status: "accepted", accepted_pro_id: thread.pro_id });
        await updateThread(thread.id, { status: "accepted" });
        toast("Pro accepted!", "success");
        renderJobDetail({ id: job.id });
      } catch (err) {
        toast(err.message || "Could not accept pro", "error");
      }
    });
  }

  loadAndSubscribeMessages(thread.id);

  document.getElementById("sendMsgBtn").addEventListener("click", () => sendChat(thread.id));
  document.getElementById("chatInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChat(thread.id);
    }
  });
}

async function sendChat(threadId) {
  const input = document.getElementById("chatInput");
  const body = input.value.trim();
  if (!body) return;
  input.value = "";
  try {
    await sendMessage(threadId, state.user.id, body);
  } catch (err) {
    toast(err.message || "Could not send message", "error");
  }
}

async function loadAndSubscribeMessages(threadId) {
  const list = document.getElementById("chatList");
  try {
    const messages = await listMessages(threadId);
    renderMessages(messages);
  } catch (err) {
    toast(err.message || "Could not load messages", "error");
  }
  if (unsubscribe) unsubscribe();
  unsubscribe = subscribeToThread(threadId, (msg) => {
    const list2 = document.getElementById("chatList");
    if (!list2) return;
    appendMessage(msg);
  });
}

function renderMessages(messages) {
  const list = document.getElementById("chatList");
  if (!list) return;
  list.innerHTML = "";
  messages.forEach(appendMessage);
}

function appendMessage(msg) {
  const list = document.getElementById("chatList");
  if (!list) return;
  const mine = msg.sender_id === state.user.id;
  const el = document.createElement("div");
  el.className = `msg ${mine ? "mine" : "theirs"}`;
  el.innerHTML = `${escapeHtml(msg.body)}<div class="meta">${timeAgo(msg.created_at)}</div>`;
  list.appendChild(el);
  list.scrollTop = list.scrollHeight;
}

// ---------------- Pro side: single thread with the customer ----------------
async function renderProThread(job, isOutsidePro) {
  const area = document.getElementById("threadsArea");

  if (job.status !== "open" && !isOutsidePro) {
    // accepted pro on an active job — go straight to the thread
  }

  let thread = null;
  try {
    thread = await listMyThreadForJob(job.id, state.user.id);
  } catch (err) {
    // ignore
  }

  if (!thread && job.status === "open") {
    area.innerHTML = `
      <div class="card">
        <p>Interested in this job? Send the customer a message or an offer.</p>
        <div class="row">
          <input type="number" id="proOfferAmount" placeholder="Your offer (optional)" style="max-width:160px;" />
          <button class="btn btn-primary" id="startInterestBtn">Message customer</button>
        </div>
      </div>
    `;
    document.getElementById("startInterestBtn").addEventListener("click", async () => {
      try {
        const offer = document.getElementById("proOfferAmount").value;
        thread = await getOrCreateThread(job.id, job.customer_id, state.user.id, offer ? Number(offer) : null);
        area.innerHTML = `<div class="card" id="threadPanel"></div>`;
        openThreadPanel(job, { ...thread, pro: { full_name: "you" } }, false);
      } catch (err) {
        toast(err.message || "Could not start conversation", "error");
      }
    });
    return;
  }

  if (!thread) {
    area.innerHTML = `<div class="empty-state"><div class="big">🔒</div><strong>Not available</strong><div class="small">This job isn't open to new offers.</div></div>`;
    return;
  }

  area.innerHTML = `<div class="card" id="threadPanel"></div>`;
  openThreadPanel(job, thread, false);
}

// ---------------- Ratings ----------------
async function renderRatingArea(job, isCustomer) {
  const rateeId = isCustomer ? job.accepted_pro_id : job.customer_id;
  const rateeName = isCustomer ? job.pro?.full_name : job.customer?.full_name;
  if (!rateeId) return;

  const area = document.getElementById("ratingArea");
  let existing = null;
  try {
    existing = await getRatingForJob(job.id, state.user.id);
  } catch (err) {
    // ignore
  }

  if (existing) {
    area.innerHTML = `
      <div class="card">
        <strong>You rated ${escapeHtml(rateeName || "them")}</strong>
        <div class="stars" style="margin-top:6px;">${"★".repeat(existing.stars)}${"<span class=\"empty\">★</span>".repeat(5 - existing.stars)}</div>
        ${existing.comment ? `<p class="small muted" style="margin-top:6px;">${escapeHtml(existing.comment)}</p>` : ""}
      </div>
    `;
    return;
  }

  area.innerHTML = `
    <div class="card">
      <strong>Rate ${escapeHtml(rateeName || "them")}</strong>
      <div class="row" id="starPicker" style="font-size:1.6rem;margin:10px 0;cursor:pointer;">
        ${[1, 2, 3, 4, 5].map((n) => `<span data-star="${n}" class="empty" style="color:#e0e0e0;">★</span>`).join("")}
      </div>
      <textarea id="ratingComment" placeholder="Optional comment…"></textarea>
      <button class="btn btn-primary" id="submitRatingBtn" style="margin-top:10px;" disabled>Submit rating</button>
    </div>
  `;

  let picked = 0;
  const stars = Array.from(document.querySelectorAll("#starPicker span"));
  stars.forEach((s) => {
    s.addEventListener("click", () => {
      picked = Number(s.dataset.star);
      stars.forEach((s2) => {
        const active = Number(s2.dataset.star) <= picked;
        s2.style.color = active ? "#f5a623" : "#e0e0e0";
      });
      document.getElementById("submitRatingBtn").disabled = false;
    });
  });

  document.getElementById("submitRatingBtn").addEventListener("click", async () => {
    try {
      await submitRating(job.id, state.user.id, rateeId, picked, document.getElementById("ratingComment").value.trim());
      toast("Thanks for rating!", "success");
      renderJobDetail({ id: job.id });
    } catch (err) {
      toast(err.message || "Could not submit rating", "error");
    }
  });
}
