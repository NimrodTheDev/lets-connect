export function renderLanding() {
  document.getElementById("app").innerHTML = `
    <section class="hero">
      <h1>🛎️ At Your Service</h1>
      <p style="font-weight:700;color:#fff;opacity:.92;">Whatever you need. Whenever you need it.</p>
      <p>Handymen, maids, private chefs, barbers, masseuses, tutors and more — all nearby. See their rates, DOs and DON'Ts up front, browse real work photos, or post exactly what you need and let pros come to you.</p>
      <div class="cta-row">
        <a href="#/signup" class="btn btn-primary">Get started</a>
        <a href="#/login" class="btn" style="background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.25);color:#fff;">Log in</a>
      </div>
    </section>
    <div class="feature-grid">
      <div class="feature-card">
        <div class="ico">🗺️</div>
        <h3>See pros on the map</h3>
        <p class="muted small">Browse available service pros near you — any trade, craft or skill — with their services, rates and ratings.</p>
      </div>
      <div class="feature-card">
        <div class="ico">📸</div>
        <h3>Real photos, real work</h3>
        <p class="muted small">Pros show off their work with a photo portfolio. Attach photos to your job post so pros know exactly what to expect.</p>
      </div>
      <div class="feature-card">
        <div class="ico">📣</div>
        <h3>Post your job, get offers</h3>
        <p class="muted small">Say what you need and what you're offering. Nearby pros see it and can accept.</p>
      </div>
      <div class="feature-card">
        <div class="ico">⭐</div>
        <h3>Two-way ratings</h3>
        <p class="muted small">Customers rate pros, pros rate customers. Reputation goes both ways.</p>
      </div>
      <div class="feature-card">
        <div class="ico">🤍</div>
        <h3>Save your favorites</h3>
        <p class="muted small">Found a pro you trust? Save them to your favorites for next time.</p>
      </div>
      <div class="feature-card">
        <div class="ico">📋</div>
        <h3>Clear DOs &amp; DON'Ts</h3>
        <p class="muted small">Every pro lists exactly what they do, their negotiable rates, and their rules.</p>
      </div>
    </div>
  `;
}
