const tabs = Array.from(document.querySelectorAll("[data-tab]"));
const panels = Array.from(document.querySelectorAll("[data-panel]"));
const tabLinks = Array.from(document.querySelectorAll("[data-tab-link]"));
const topbar = document.querySelector(".topbar");
const menuToggle = document.querySelector("[data-menu-toggle]");
const contactForm = document.querySelector(".contact-form");
const campSignupForm = document.querySelector("[data-camp-signup-form]");
const ROUTE_TABS = new Set([
  "home",
  "about",
  "method",
  "students",
  "publications",
  "camps",
  "prices",
  "contact",
  "legal",
]);
const FORM_ENDPOINTS = {
  contact: "https://script.google.com/macros/s/AKfycbxEcx2ccdHMJti3VYGeXi3BkgYYslnGQ1AiPFGq5yPiztTrpJOnYSBqm8D1Y02dFRIEmQ/exec",
  campNotifications: "https://script.google.com/macros/s/AKfycbxEcx2ccdHMJti3VYGeXi3BkgYYslnGQ1AiPFGq5yPiztTrpJOnYSBqm8D1Y02dFRIEmQ/exec",
};

if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

function setMenuOpen(isOpen) {
  if (!topbar || !menuToggle) {
    return;
  }

  topbar.classList.toggle("is-menu-open", isOpen);
  menuToggle.setAttribute("aria-expanded", String(isOpen));
  menuToggle.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
}

function tabPath(tabName) {
  return tabName === "home" ? "/" : `/${tabName}/`;
}

function tabFromLocation() {
  const hashTab = window.location.hash.slice(1);
  if (ROUTE_TABS.has(hashTab)) {
    return hashTab;
  }

  const pathTab = window.location.pathname.split("/").filter(Boolean)[0] || "home";
  return ROUTE_TABS.has(pathTab) ? pathTab : "home";
}

function activateTab(tabName, shouldFocus = false, shouldUpdateUrl = true) {
  const targetPanel = panels.find((panel) => panel.dataset.panel === tabName);

  if (!targetPanel) {
    return;
  }

  tabs.forEach((tab) => {
    const isActive = tab.dataset.tab === tabName;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });

  panels.forEach((panel) => {
    panel.classList.toggle("is-active", panel === targetPanel);
  });

  if (shouldUpdateUrl && ROUTE_TABS.has(tabName)) {
    history.pushState(null, "", tabPath(tabName));
  }

  if (shouldFocus) {
    targetPanel.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  setMenuOpen(false);
}

if (menuToggle) {
  menuToggle.addEventListener("click", () => {
    setMenuOpen(!topbar?.classList.contains("is-menu-open"));
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    setMenuOpen(false);
  }
});

tabs.forEach((tab) => {
  tab.setAttribute("role", "tab");
  tab.setAttribute("aria-controls", tab.dataset.tab);

  tab.addEventListener("click", () => {
    activateTab(tab.dataset.tab, true);
  });
});

tabLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    const tabName = link.dataset.tabLink;
    const scrollTarget = link.dataset.scrollTarget;
    event.preventDefault();

    if (scrollTarget) {
      activateTab(tabName);
      document.getElementById(scrollTarget)?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    activateTab(tabName, true);
  });
});

activateTab(tabFromLocation(), false, false);

window.addEventListener("popstate", () => {
  activateTab(tabFromLocation(), false, false);
});

requestAnimationFrame(() => {
  window.scrollTo(0, 0);
});

async function submitExternalForm(endpoint, payload) {
  if (!endpoint) {
    return false;
  }

  await fetch(endpoint, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      ...payload,
      submittedAt: new Date().toISOString(),
    }),
  });

  return true;
}

if (contactForm) {
  const status = contactForm.querySelector("[data-contact-status]");

  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(contactForm);
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const level = String(formData.get("level") || "").trim();
    const message = String(formData.get("message") || "").trim();
    const website = String(formData.get("website") || "").trim();
    const subject = encodeURIComponent("Chess coaching inquiry");
    const body = encodeURIComponent(
      `Name: ${name || "A prospective student"}\nEmail: ${email || "not specified"}\nLevel: ${level || "not specified"}\n\n${message || "I would like to discuss chess training."}`,
    );

    if (!email || !message || website) {
      if (status) {
        status.textContent = "Please enter your email and message.";
      }
      return;
    }

    const button = contactForm.querySelector("button");

    if (button) {
      button.disabled = true;
    }

    if (status) {
      status.textContent = "Sending...";
    }

    try {
      const wasSubmitted = await submitExternalForm(FORM_ENDPOINTS.contact, {
        type: "contact-message",
        name,
        email,
        level,
        message,
        website,
        source: "contact-page",
      });

      if (!wasSubmitted) {
        throw new Error("Contact service is not configured");
      }

      contactForm.reset();

      if (status) {
        status.textContent = "Thank you. Your message has been sent.";
      }
    } catch {
      window.location.href = `mailto:?subject=${subject}&body=${body}`;

      if (status) {
        status.textContent = "Your email app has been opened so the message can be sent directly.";
      }
    } finally {
      if (button) {
        button.disabled = false;
      }
    }
  });
}

if (campSignupForm) {
  const status = campSignupForm.querySelector("[data-camp-signup-status]");

  campSignupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(campSignupForm);
    const email = String(formData.get("email") || "").trim();
    const consent = formData.get("consent") === "on";
    const website = String(formData.get("website") || "").trim();

    if (!email || !consent || website) {
      if (status) {
        status.textContent = "Please enter your email and confirm that you want camp announcements.";
      }
      return;
    }

    const button = campSignupForm.querySelector("button");

    if (button) {
      button.disabled = true;
    }

    if (status) {
      status.textContent = "Sending...";
    }

    try {
      const wasSubmitted = await submitExternalForm(FORM_ENDPOINTS.campNotifications, {
        type: "camp-notification",
        email,
        consent,
        website,
        source: "camps-page",
      });

      if (!wasSubmitted) {
        throw new Error("Signup service is not configured");
      }

      campSignupForm.reset();

      if (status) {
        status.textContent = "Thank you. I will notify you when the next endgame camp is scheduled.";
      }
    } catch {
      const subject = encodeURIComponent("Endgame camp notification request");
      const body = encodeURIComponent(`Please add this email to the endgame camp notification list:\n\n${email}`);
      window.location.href = `mailto:?subject=${subject}&body=${body}`;

      if (status) {
        status.textContent = "Your email app has been opened so the request can be sent directly.";
      }
    } finally {
      if (button) {
        button.disabled = false;
      }
    }
  });
}
