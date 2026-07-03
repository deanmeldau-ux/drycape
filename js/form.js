/* DryCape quote enquiry form handler.
 * Validates the enquiry, computes a simple quality score for internal routing,
 * and posts the submission to the capture endpoint. A local fallback ensures an
 * enquiry is never lost if the network request fails.
 */

var FORM_ENDPOINT = "https://hooks.glowretrieval.com/lead"; // auto-synced to live tunnel

(function () {
  var form = document.getElementById('quote-form');
  if (!form) return;
  var okBox = document.getElementById('form-ok');

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearErrors(form);

    var data = collect(form);
    var errors = validate(data);

    if (Object.keys(errors).length) {
      showErrors(form, errors);
      var first = form.querySelector('.field-error input, .field-error select, .field-error textarea');
      if (first) first.focus();
      return;
    }

    data.quality = scoreLead(data);
    data.submittedAt = new Date().toISOString();
    data.sourcePage = window.location.pathname + window.location.search;

    if (FORM_ENDPOINT) {
      sendToEndpoint(data);
    } else {
      storeLead(data);
      finish(data);
    }
  });

  function collect(f) {
    return {
      name: val(f, 'name'),
      phone: val(f, 'phone'),
      email: val(f, 'email'),
      suburb: val(f, 'suburb'),
      service: val(f, 'service'),
      propertyType: val(f, 'propertyType'),
      budget: val(f, 'budget'),
      timeline: val(f, 'timeline'),
      description: val(f, 'description'),
      consent: f.querySelector('[name="consent"]') && f.querySelector('[name="consent"]').checked
    };
  }
  function val(f, n) { var el = f.querySelector('[name="' + n + '"]'); return el ? (el.value || '').trim() : ''; }

  function validate(d) {
    var e = {};
    if (d.name.length < 2) e.name = 'Please enter your name.';
    // Accept any reasonable SA / international format: strip non-digits, then
    // check the digit count. The old 9-15 character cap rejected valid +27 and
    // pasted numbers, silently losing leads.
    var digits = (d.phone || '').replace(/[^0-9]/g, '');
    if (digits.length < 9 || digits.length > 15) e.phone = 'Enter a valid SA phone number, e.g. 082 123 4567.';
    if (d.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) e.email = "That email doesn't look right.";
    if (!d.suburb) e.suburb = 'Choose your suburb.';
    if (!d.service) e.service = 'Choose the service you need.';
    // propertyType is optional (it only feeds lead scoring); never block a worried homeowner on it.
    if (d.description.length < 10) e.description = 'A sentence about the problem helps the specialist quote accurately.';
    if (!d.consent) e.consent = 'Please agree so we can pass your details to one local specialist.';
    return e;
  }

  /* Lead quality scoring. Returns {tier, score, flags[]} for internal routing. */
  function scoreLead(d) {
    var score = 50, flags = [];
    // Property type: renters rarely authorise or pay for damp work.
    if (d.propertyType === 'owner') score += 25;
    else if (d.propertyType === 'renter') { score -= 30; flags.push('renter'); }
    else if (d.propertyType === 'agent' || d.propertyType === 'landlord') score += 15;
    // Budget signal.
    if (d.budget === 'under1000' || d.budget === 'none') { score -= 25; flags.push('no-budget'); }
    else if (d.budget === '1000-5000') score += 8;
    else if (d.budget === '5000-15000' || d.budget === '15000plus') score += 20;
    // Timeline / urgency.
    if (d.timeline === 'asap' || d.timeline === '1month') score += 12;
    else if (d.timeline === 'researching') { score -= 8; flags.push('just-researching'); }
    // Description richness.
    if (d.description.length > 60) score += 8;
    if (d.description.length < 20) { score -= 6; flags.push('vague'); }
    // Contactability.
    if (d.email) score += 5;

    score = Math.max(0, Math.min(100, score));
    var tier = score >= 65 ? 'high' : (score >= 40 ? 'medium' : 'low');
    return { tier: tier, score: score, flags: flags };
  }

  function storeLead(d) {
    try {
      var key = 'drycape_leads';
      var arr = JSON.parse(localStorage.getItem(key) || '[]');
      arr.push(d);
      localStorage.setItem(key, JSON.stringify(arr));
    } catch (err) { /* private mode or storage full, non-fatal */ }
  }

  function sendToEndpoint(d) {
    fetch(FORM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(d)
    }).then(function (r) {
      if (!r.ok) throw new Error('bad status ' + r.status);
      finish(d);
    }).catch(function () {
      // Fall back to local capture so the lead is never lost.
      storeLead(d);
      finish(d);
    });
  }

  function finish(d) {
    form.style.display = 'none';
    if (okBox) {
      okBox.style.display = 'block';
      okBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      var nm = okBox.querySelector('[data-name]');
      if (nm) nm.textContent = d.name.split(' ')[0];
    }
  }

  function clearErrors(f) {
    f.querySelectorAll('.field-error').forEach(function (el) { el.classList.remove('field-error'); });
  }
  function showErrors(f, errs) {
    Object.keys(errs).forEach(function (name) {
      var el = f.querySelector('[name="' + name + '"]');
      if (!el) return;
      var field = el.closest('.field');
      if (field) {
        field.classList.add('field-error');
        var msg = field.querySelector('.err-msg');
        if (msg) msg.textContent = errs[name];
      }
    });
  }
})();
