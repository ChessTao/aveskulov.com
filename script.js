const tabs = Array.from(document.querySelectorAll("[data-tab]"));
const panels = Array.from(document.querySelectorAll("[data-panel]"));
const tabLinks = Array.from(document.querySelectorAll("[data-tab-link]"));
const contactForm = document.querySelector(".contact-form");
const campSignupForm = document.querySelector("[data-camp-signup-form]");

function activateTab(tabName, shouldFocus = false) {
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

  history.replaceState(null, "", `#${tabName}`);

  if (shouldFocus) {
    targetPanel.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

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

if (window.location.hash) {
  activateTab(window.location.hash.slice(1));
}

if (contactForm) {
  contactForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(contactForm);
    const name = formData.get("name") || "A prospective student";
    const email = formData.get("email") || "not specified";
    const level = formData.get("level") || "not specified";
    const message = formData.get("message") || "I would like to discuss chess training.";
    const subject = encodeURIComponent("Chess coaching inquiry");
    const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\nLevel: ${level}\n\n${message}`);

    window.location.href = `mailto:?subject=${subject}&body=${body}`;
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
      const response = await fetch("/api/camp-notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, consent, website, source: "camps-page" }),
      });

      if (!response.ok) {
        throw new Error("Signup service unavailable");
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
