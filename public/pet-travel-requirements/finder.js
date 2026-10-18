(() => {
  const form = document.getElementById('destination-finder');
  const result = document.getElementById('destination-finder-result');
  if (!form || !result) return;
  const escapeText = value => String(value || '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const values = new FormData(form);
    const origin = String(values.get('origin') || '').trim();
    const destination = String(values.get('destination') || '').trim();
    const species = String(values.get('species') || 'unknown');
    const transportation = String(values.get('transportation') || 'unknown');
    const departure = String(values.get('departure') || '');
    if (!origin || !destination) return;
    button.disabled = true;
    button.textContent = 'Checking reviewed guides…';
    result.dataset.visible = 'false';
    try {
      const response = await fetch(`/api/travel-requirements?destination=${encodeURIComponent(destination)}`, { headers: { Accept: 'application/json' } });
      const body = await response.json().catch(() => ({}));
      if (response.ok && body?.guide?.path) {
        result.innerHTML = `<strong>${escapeText(body.guide.title)}</strong><p>${escapeText(body.guide.scope)}. This guide was reviewed on ${escapeText(String(body.guide.reviewed_at || '').slice(0, 10))}.</p><a href="${escapeText(body.guide.path)}">Open the reviewed guide →</a>`;
      } else if (response.status === 404) {
        const query = new URLSearchParams({ from: 'pet-travel', originCountry: origin, destinationCountry: destination, species, transportationType: transportation });
        if (departure) query.set('departureDate', departure);
        result.innerHTML = `<strong>${escapeText(destination)} is not in the reviewed public library yet.</strong><p>You can still create a private trip and build an AI-assisted checklist with official-source links. New public guides stay private and no-index until source and editorial review are complete.</p><a href="/signup?${escapeText(query.toString())}">Start YourPetPass free →</a>`;
      } else {
        throw new Error(body?.error || 'Guide lookup failed');
      }
    } catch {
      result.innerHTML = '<strong>We could not check the guide library right now.</strong><p>Please try again in a moment. Your route was not submitted.</p>';
    } finally {
      result.dataset.visible = 'true';
      button.disabled = false;
      button.textContent = 'Build my trip requirements →';
    }
  });
})();
