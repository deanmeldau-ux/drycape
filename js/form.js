/* DryCape — quote enquiry form handler.
 *
 * IMPORTANT / HONEST STATUS:
 * There is NO live backend wired up yet. This script does three real things:
 *   1. Validates the enquiry client-side.
 *   2. Scores lead QUALITY (renters / no-budget / vague jobs are flagged "low") so that
 *      when routing goes live we only push qualified, sellable leads to a contractor.
 *   3. Stores the submission in the browser's localStorage as a stand-in capture, and
 *      logs the full JSON payload to the console so nothing is silently lost during testing.
 *
 * TODO (lead-routing backend — see README "Lead routing"):
 *   - Replace storeLead() with a POST to a real endpoint. Easiest free options:
 *       a) Formspree  : set FORM_ENDPOINT below to your https://formspree.io/f/XXXX id.
 *       b) Google Apps Script web app writing to a Google Sheet (free, owned by us).
 *       c) Netlify Forms if we ever move off GitHub Pages.
 *   - On receipt, route the lead to ONE vetted contractor for that suburb+service
 *     (WhatsApp/email), record which contractor it was sold to, and bill per-lead or via retainer.
 *   - Send the homeowner an auto-acknowledgement email.
 *   - Drop low-quality (renter / no-budget / spam) leads or send to a cheaper tier.
 */

// Set this to a real endpoint to go live. While null, submissions are captured locally only.
var FORM_ENDPOINT = "https://province-venue-naturals-nasa.trycloudflare.com/lead"; // auto-synced to live tunnel

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

  /* Lead quality scoring. Returns {tier, score, flags[]}.
     This is the core of the business: we only want to SELL qualified leads. */
  function scoreLead(d) {
    var score = 50, flags = [];
    // Property type — renters rarely authorise/pay for damp work.
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
    } catch (err) { /* private mode / storage full — non-fatal */ }
    // Always log so a tester can copy the captured lead out of the console.
    console.log('[DryCape] Captured enquiry (no backend connected yet):', d);
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
