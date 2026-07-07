// Contact modal. Submissions go through FormSubmit's AJAX endpoint straight
// to the inbox below — no backend needed. NOTE: FormSubmit requires a
// one-time activation: the first submission triggers a confirmation email
// to this address; click the link in it and every subsequent inquiry is
// delivered normally.
const INBOX = 'aksels@aembaltic.com';
const ENDPOINT = `https://formsubmit.co/ajax/${INBOX}`;

export function initContactForm() {
  const modal = document.getElementById('contact-modal');
  const form = document.getElementById('contact-form');
  const status = modal.querySelector('.contact-status');
  const submitBtn = form.querySelector('.contact-submit');

  const open = () => {
    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add('open'));
    modal.querySelector('input[name="name"]').focus();
  };
  const close = () => {
    modal.classList.remove('open');
    setTimeout(() => (modal.hidden = true), 250);
  };

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) return close();
    const trigger = e.target.closest('.header-cta, .scene-text .cta');
    if (trigger) {
      e.preventDefault();
      open();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) close();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    submitBtn.disabled = true;
    status.textContent = 'Sending…';
    try {
      const data = Object.fromEntries(new FormData(form));
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          ...data,
          _subject: 'New project inquiry — AEM Baltic site',
          _template: 'table',
          _captcha: 'false',
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === 'false' || json.success === false) throw new Error(json.message);
      status.textContent = 'Thanks — your inquiry is on its way. We’ll be in touch shortly.';
      form.reset();
    } catch {
      status.textContent = `Something went wrong — please email us directly at ${INBOX}.`;
    } finally {
      submitBtn.disabled = false;
    }
  });
}
