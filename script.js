const tabs = Array.from(document.querySelectorAll("[data-tab]"));
const panels = Array.from(document.querySelectorAll("[data-panel]"));
const tabLinks = Array.from(document.querySelectorAll("[data-tab-link]"));
const contactForm = document.querySelector(".contact-form");

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
    event.preventDefault();
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
    const level = formData.get("level") || "not specified";
    const message = formData.get("message") || "I would like to discuss chess training.";
    const subject = encodeURIComponent("Chess coaching inquiry");
    const body = encodeURIComponent(`Name: ${name}\nLevel: ${level}\n\n${message}`);

    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  });
}
