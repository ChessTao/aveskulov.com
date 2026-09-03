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
  contact: "/api/contact",
  campNotifications: "/api/camp-notifications",
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

async function submitSiteForm(endpoint, payload) {
  if (!endpoint) {
    return false;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payload,
      submittedAt: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    let message = "Form service unavailable";

    try {
      const data = await response.json();
      message = data.message || message;
    } catch {
      // Keep the generic message when the server does not return JSON.
    }

    throw new Error(message);
  }

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
      const wasSubmitted = await submitSiteForm(FORM_ENDPOINTS.contact, {
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
    } catch (error) {
      if (status) {
        status.textContent =
          error instanceof Error && error.message
            ? error.message
            : "Sorry, your message could not be sent. Please try again later.";
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
      const wasSubmitted = await submitSiteForm(FORM_ENDPOINTS.campNotifications, {
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
    } catch (error) {
      if (status) {
        status.textContent =
          error instanceof Error && error.message
            ? error.message
            : "Sorry, your request could not be sent. Please try again later.";
      }
    } finally {
      if (button) {
        button.disabled = false;
      }
    }
  });
}
