const TRANSPORT_MODES = new Set(['air', 'land', 'sea', 'bus']);

function shortValue(params, key, maximum = 100) {
  return String(params?.get?.(key) || '').trim().slice(0, maximum);
}

export function tripIntentFromSearch(search = '') {
  const params = new URLSearchParams(String(search || '').replace(/^\?/, ''));
  const transportationType = shortValue(params, 'transportationType', 12).toLowerCase();
  const departureDate = shortValue(params, 'departureDate', 10);
  return {
    originCountry: shortValue(params, 'originCountry') || 'United States',
    destinationCountry: shortValue(params, 'destinationCountry'),
    departureDate: /^\d{4}-\d{2}-\d{2}$/.test(departureDate) ? departureDate : '',
    transportationType: TRANSPORT_MODES.has(transportationType) ? transportationType : 'air',
  };
}

