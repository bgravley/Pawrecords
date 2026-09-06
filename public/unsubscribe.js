(() => {
  const button = document.getElementById('unsubscribe-button');
  const status = document.getElementById('status');
  const token = new URLSearchParams(window.location.search).get('token') || '';

  function show(message, type = '') {
    status.textContent = message;
    status.className = type;
  }

  if (!token) {
    button.disabled = true;
    show('This unsubscribe link is incomplete. Please use the link from a YourPetPass reminder email.', 'error');
    return;
  }

  button.addEventListener('click', async () => {
    button.disabled = true;
    show('Updating your email preference…');
    try {
      const response = await fetch('/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
        credentials: 'same-origin',
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error || 'We could not update your email preference.');

      button.hidden = true;
      show('Reminder emails are now turned off. Your account and your pet\'s records are unchanged.', 'success');
    } catch (error) {
      button.disabled = false;
      show(error.message || 'We could not update your email preference. Please try again.', 'error');
    }
  });
})();
