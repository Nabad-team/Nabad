/* Shared by the public offline page and the signed-in save controls. No network calls. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.NabadOfflineEmergency = api; api.mount(); }
})(typeof window !== 'undefined' ? window : this, function () {
  var KEY = 'nabad-offline-emergency-v1';
  function storage() { return window.localStorage; }
  function announce() { window.dispatchEvent(new Event('nabad-offline-emergency-changed')); }
  function clear() { storage().removeItem(KEY); announce(); }
  function read() {
    try {
      var raw = storage().getItem(KEY);
      if (!raw || raw.length > 100000) return null;
      var saved = JSON.parse(raw), c = saved.card;
      if (saved.version !== 1 || typeof saved.owner !== 'string' || !saved.owner ||
          !Number.isFinite(Date.parse(saved.savedAt)) || !c || !c.profile ||
          typeof c.profile.id !== 'string' || typeof c.profile.fullName !== 'string' ||
          !Array.isArray(c.conditions) || !Array.isArray(c.allergies) || !Array.isArray(c.medications) ||
          !c.conditions.every(x => x && typeof x.label === 'string') ||
          !c.allergies.every(x => x && typeof x.name === 'string' && typeof x.reaction === 'string') ||
          !c.medications.every(x => x && typeof x.name === 'string' && typeof x.dose === 'string' && typeof x.frequency === 'string') ||
          (c.emergencyContact !== null && (!c.emergencyContact || typeof c.emergencyContact.name !== 'string' || !/^\+?[0-9]{7,15}$/.test(c.emergencyContact.phone)))) return null;
      return saved;
    } catch (_) { return null; }
  }
  function save(owner, card, now) {
    if (!owner || !card || !card.profile) throw new Error('Card unavailable');
    // Copy only visible card fields. Never store credentials, API responses or documents.
    var copy = { profile: { id: card.profile.id, fullName: card.profile.fullName, dateOfBirth: card.profile.dateOfBirth || '' },
      bloodType: card.bloodType || '', preparedAt: card.preparedAt,
      conditions: card.conditions.map(x => ({ label: x.label })),
      allergies: card.allergies.map(x => ({ name: x.name, reaction: x.reaction || '' })),
      medications: card.medications.map(x => ({ name: x.name, dose: x.dose, frequency: x.frequency || '' })),
      emergencyContact: card.emergencyContact ? { name: card.emergencyContact.name, phone: card.emergencyContact.phone } : null };
    var value = JSON.stringify({ version: 1, owner: owner, savedAt: (now || new Date()).toISOString(), card: copy });
    if (value.length > 100000) throw new Error('Card too large');
    storage().setItem(KEY, value); announce();
  }
  function reconcile(owner, profiles) {
    var saved = read();
    if (saved && (saved.owner !== owner || !profiles.includes(saved.card.profile.id))) clear();
  }
  function mount() {
    var host = document.getElementById('saved-emergency-card');
    if (!host) return;
    function node(tag, text, parent) { var el = document.createElement(tag); el.textContent = text; parent.appendChild(el); return el; }
    function render() {
      host.replaceChildren();
      var saved = read();
      if (!saved) { node('p', 'No emergency card is saved on this device. While online, open Emergency information card and choose Save for offline use.', host); return; }
      var c = saved.card;
      node('h2', 'Saved emergency information: ' + c.profile.fullName, host);
      node('p', 'Offline copy saved ' + new Date(saved.savedAt).toLocaleString('en-GB') + '. This copy may be out of date. Confirm details with the patient or caregiver.', host);
      node('p', 'Date of birth: ' + (c.profile.dateOfBirth || 'Not recorded') + ' · Blood type: ' + (c.bloodType || 'Not recorded'), host);
      [['Medical conditions', c.conditions.map(x => x.label)], ['Allergies', c.allergies.map(x => x.name + ' · Reaction: ' + (x.reaction || 'Not recorded'))],
        ['Active medications', c.medications.map(x => x.name + ' · Dose: ' + (x.dose || 'Not recorded') + ' · Frequency: ' + (x.frequency || 'Not recorded'))]].forEach(function(group) {
          node('h3', group[0], host);
          if (!group[1].length) node('p', 'None recorded. This does not confirm there are none.', host);
          else { var list = node('ul', '', host); group[1].forEach(text => node('li', text, list)); }
        });
      node('h3', 'Emergency contact', host);
      if (c.emergencyContact) { node('p', c.emergencyContact.name, host); var call = node('a', c.emergencyContact.phone, host); call.href = 'tel:' + c.emergencyContact.phone; }
      else node('p', 'No emergency contact recorded for this profile.', host);
      var remove = node('button', 'Remove saved emergency information', host);
      remove.type = 'button'; remove.onclick = function() { try { clear(); render(); } catch (_) { node('p', 'Could not remove the saved copy. Clear this site’s data in browser settings.', host); } };
    }
    render(); window.addEventListener('storage', function(e) { if (e.key === KEY || e.key === null) render(); });
    window.addEventListener('nabad-offline-emergency-changed', render);
  }
  return { KEY: KEY, read: read, save: save, clear: clear, reconcile: reconcile, mount: mount };
});
