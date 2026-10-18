const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function destinationSlug(value) {
  const input = String(value || '').trim().toLowerCase();
  if (!input || input.length > 100) return '';
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function safeUuidList(values) {
  return [...new Set((values || []).filter(value => UUID_PATTERN.test(String(value))))];
}

export function publicGuide(candidate, jurisdiction) {
  if (!candidate || !jurisdiction || candidate.status !== 'published' || candidate.noindex !== false) return null;
  if (!/^\/pet-travel-requirements\/[a-z0-9-]+\/$/.test(candidate.public_path || '')) return null;
  return {
    destination: jurisdiction.display_name,
    destination_slug: jurisdiction.slug,
    iso2: jurisdiction.iso2 || null,
    path: candidate.public_path,
    title: candidate.proposed_title,
    scope: candidate.scope_label,
    summary: candidate.guide_summary,
    reviewed_at: candidate.editorial_reviewed_at,
  };
}

export function publishedKnowledge(requirements, sources) {
  const verifiedSources = new Map(
    (sources || [])
      .filter(source => source.review_state === 'source_verified')
      .map(source => [source.id, source])
  );

  return (requirements || [])
    .filter(requirement => requirement.review_state === 'published' && verifiedSources.has(requirement.source_id))
    .map(requirement => ({
      ...requirement,
      source: verifiedSources.get(requirement.source_id),
    }));
}

export function normalizedDemandSpecies(value) {
  const species = String(value || '').trim().toLowerCase();
  return ['all', 'dog', 'cat'].includes(species) ? species : 'unknown';
}

