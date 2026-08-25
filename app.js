const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Supabase Auth needs an email+password identity. Students only ever see
// "roll number" — we derive a stable, hidden pseudo-email from the roll
// number so we can still use Supabase's built-in secure auth underneath.
function rollToEmail(roll) {
  const clean = roll.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  return `roll-${clean}@studentregistry.app`;
}

const $ = (id) => document.getElementById(id);

function showMsg(el, text, kind) {
  el.textContent = text;
  el.className = `msg show ${kind}`;
}
function clearMsg(el) {
  el.className = "msg";
}

// ---------- Tabs ----------
$("tab-login").addEventListener("click", () => switchTab("login"));
$("tab-signup").addEventListener("click", () => switchTab("signup"));
function switchTab(which) {
  $("tab-login").classList.toggle("active", which === "login");
  $("tab-signup").classList.toggle("active", which === "signup");
  $("view-login").classList.toggle("active", which === "login");
  $("view-signup").classList.toggle("active", which === "signup");
}

// ---------- Sign up ----------
$("signup-btn").addEventListener("click", async () => {
  const msg = $("signup-msg");
  clearMsg(msg);

  const whatsapp = $("signup-whatsapp").value.trim();
  const roll = $("signup-roll").value.trim();
  const password = $("signup-password").value;
  const password2 = $("signup-password2").value;

  if (!whatsapp || !roll || !password) {
    return showMsg(msg, "Please fill in every field.", "error");
  }
  if (password.length < 6) {
    return showMsg(msg, "Password must be at least 6 characters.", "error");
  }
  if (password !== password2) {
    return showMsg(msg, "Passwords don't match.", "error");
  }

  $("signup-btn").disabled = true;
  const email = rollToEmail(roll);

  const { data, error } = await sb.auth.signUp({ email, password });

  if (error) {
    $("signup-btn").disabled = false;
    if (/already registered|already exists/i.test(error.message)) {
      return showMsg(msg, "That roll number is already signed up. Try logging in instead.", "error");
    }
    return showMsg(msg, error.message, "error");
  }

  if (!data.session) {
    // Project has email confirmation turned on — signUp won't return a
    // session, so we can't create the profile row yet (RLS needs auth.uid()).
    $("signup-btn").disabled = false;
    return showMsg(
      msg,
      "Account created, but sign-in isn't active yet. Ask the site owner to turn off email confirmation in Supabase Auth settings, then try logging in.",
      "error"
    );
  }

  const { error: profileErr } = await sb.from("profiles").insert({
    id: data.user.id,
    whatsapp_number: whatsapp,
    roll_number: roll,
  });

  $("signup-btn").disabled = false;

  if (profileErr) {
    if (/duplicate key/i.test(profileErr.message)) {
      return showMsg(msg, "That WhatsApp number or roll number is already registered.", "error");
    }
    return showMsg(msg, profileErr.message, "error");
  }

  showMsg(msg, "Signed up! Loading your dashboard…", "success");
  await loadDashboard();
});

// ---------- Log in ----------
$("login-btn").addEventListener("click", async () => {
  const msg = $("login-msg");
  clearMsg(msg);

  const roll = $("login-roll").value.trim();
  const password = $("login-password").value;
  if (!roll || !password) {
    return showMsg(msg, "Enter your roll number and password.", "error");
  }

  $("login-btn").disabled = true;
  const email = rollToEmail(roll);
  const { error } = await sb.auth.signInWithPassword({ email, password });
  $("login-btn").disabled = false;

  if (error) {
    return showMsg(msg, "Roll number or password is incorrect.", "error");
  }

  await loadDashboard();
});

// ---------- Log out ----------
$("logout-btn").addEventListener("click", async () => {
  await sb.auth.signOut();
  showAuthView();
});

// ---------- Dashboard: load ----------
async function loadDashboard() {
  const { data: userData } = await sb.auth.getUser();
  if (!userData.user) return showAuthView();

  const { data: profile, error } = await sb
    .from("profiles")
    .select("*")
    .eq("id", userData.user.id)
    .single();

  if (error || !profile) {
    showMsg($("login-msg"), "Couldn't load your profile. Please try again.", "error");
    return;
  }

  $("card-name").textContent = profile.name || "Name not set yet";
  $("card-roll").textContent = profile.roll_number;
  $("card-whatsapp").textContent = profile.whatsapp_number;
  $("card-father").textContent = profile.father_name || "—";

  $("edit-name").value = profile.name || "";
  $("edit-father").value = profile.father_name || "";
  $("edit-whatsapp").value = profile.whatsapp_number || "";
  $("edit-roll").value = profile.roll_number || "";

  $("page-title").textContent = "Your dashboard";
  $("auth-panel").style.display = "none";
  $("view-dashboard").classList.add("active");
  $("logout-btn").style.display = "inline-block";
}

function showAuthView() {
  $("page-title").textContent = "Sign up / Log in";
  $("auth-panel").style.display = "block";
  $("view-dashboard").classList.remove("active");
  $("logout-btn").style.display = "none";
  switchTab("login");
}

// ---------- Dashboard: save ----------
$("save-btn").addEventListener("click", async () => {
  const msg = $("dash-msg");
  clearMsg(msg);

  const { data: userData } = await sb.auth.getUser();
  if (!userData.user) return showAuthView();

  const updates = {
    name: $("edit-name").value.trim(),
    father_name: $("edit-father").value.trim(),
    whatsapp_number: $("edit-whatsapp").value.trim(),
    roll_number: $("edit-roll").value.trim(),
  };

  if (!updates.whatsapp_number || !updates.roll_number) {
    return showMsg(msg, "WhatsApp number and roll number can't be empty.", "error");
  }

  $("save-btn").disabled = true;
  const { error } = await sb.from("profiles").update(updates).eq("id", userData.user.id);
  $("save-btn").disabled = false;

  if (error) {
    if (/duplicate key/i.test(error.message)) {
      return showMsg(msg, "That WhatsApp number or roll number is already taken.", "error");
    }
    return showMsg(msg, error.message, "error");
  }

  showMsg(msg, "Saved.", "success");
  await loadDashboard();
});

// ---------- Dashboard: delete ----------
$("show-delete-btn").addEventListener("click", () => {
  $("delete-confirm").style.display = "block";
});
$("cancel-delete-btn").addEventListener("click", () => {
  $("delete-confirm").style.display = "none";
});
$("confirm-delete-btn").addEventListener("click", async () => {
  const { data: userData } = await sb.auth.getUser();
  if (!userData.user) return showAuthView();

  const { error } = await sb.from("profiles").delete().eq("id", userData.user.id);
  if (error) {
    return showMsg($("dash-msg"), error.message, "error");
  }

  // Profile row is gone. We can't delete the underlying auth account from
  // the browser (that needs an admin key), so we just sign the session out.
  await sb.auth.signOut();
  showAuthView();
  showMsg($("login-msg"), "Your data was deleted.", "success");
});

// ---------- On load: resume session if any ----------
(async function init() {
  const { data } = await sb.auth.getSession();
  if (data.session) {
    await loadDashboard();
  }
})();
