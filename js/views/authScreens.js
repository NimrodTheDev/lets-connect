import { signIn, signUp } from "../db.js";
import { toast } from "../ui.js";
import { navigate } from "../router.js";
import { loadProfileIntoState } from "../session.js";

export function renderLogin() {
  document.getElementById("app").innerHTML = `
    <div class="container-narrow">
      <div class="card" style="margin-top:24px;">
        <h2>Log in</h2>
        <form id="loginForm" class="stack">
          <div class="field">
            <label>Email</label>
            <input type="email" name="email" required autocomplete="email" />
          </div>
          <div class="field">
            <label>Password</label>
            <input type="password" name="password" required autocomplete="current-password" />
          </div>
          <button class="btn btn-primary btn-block" type="submit">Log in</button>
        </form>
        <p class="small muted" style="margin-top:14px;">
          New here? <a href="#/signup" style="color:var(--accent);font-weight:700;">Create an account</a>
        </p>
      </div>
    </div>
  `;

  document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const btn = e.target.querySelector("button");
    btn.disabled = true;
    try {
      await signIn(fd.get("email").trim(), fd.get("password"));
      await loadProfileIntoState();
      toast("Welcome back!", "success");
      navigate("/map");
    } catch (err) {
      toast(err.message || "Could not log in", "error");
    } finally {
      btn.disabled = false;
    }
  });
}

export function renderSignup() {
  document.getElementById("app").innerHTML = `
    <div class="container-narrow">
      <div class="card" style="margin-top:24px;">
        <h2>Create your account</h2>
        <form id="signupForm" class="stack">
          <div class="field">
            <label>Full name</label>
            <input type="text" name="fullName" required autocomplete="name" />
          </div>
          <div class="field">
            <label>Email</label>
            <input type="email" name="email" required autocomplete="email" />
          </div>
          <div class="field">
            <label>Password</label>
            <input type="password" name="password" minlength="6" required autocomplete="new-password" />
            <div class="hint">At least 6 characters.</div>
          </div>
          <button class="btn btn-primary btn-block" type="submit">Create account</button>
        </form>
        <p class="small muted" style="margin-top:14px;">
          Already have an account? <a href="#/login" style="color:var(--accent);font-weight:700;">Log in</a>
        </p>
      </div>
    </div>
  `;

  document.getElementById("signupForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const btn = e.target.querySelector("button");
    btn.disabled = true;
    try {
      const fullName = fd.get("fullName").trim();
      const result = await signUp(fd.get("email").trim(), fd.get("password"), fullName);
      if (result.session) {
        await loadProfileIntoState();
        toast("Account created!", "success");
        navigate("/onboarding");
      } else {
        toast("Account created — check your email to confirm, then log in.", "success", 6000);
        navigate("/login");
      }
    } catch (err) {
      toast(err.message || "Could not sign up", "error");
    } finally {
      btn.disabled = false;
    }
  });
}
