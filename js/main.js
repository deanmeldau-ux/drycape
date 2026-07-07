/* DryCape Google Analytics 4 (gtag). Loaded site-wide via main.js. */
(function () {
  var GA_ID = 'G-6S0N6V318Y';
  /* Google Ads conversion account + label. Paste the real values from
     Google Ads (Goals, Conversions, Create action, Website) once the lead
     conversion action is made. Format: AW-XXXXXXXXX and its label string.
     Until both are filled in (no 'X' left), the Ads conversion stays dormant;
     the GA4 generate_lead event below always fires because GA4 is already live. */
  var AW_ID = 'AW-18303988120';
  var AW_LABEL = 'EMGhCPjxm8wcEJjjgphE';
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  function gtag(){ dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', GA_ID);
  var awLive = AW_ID.indexOf('X') === -1 && AW_LABEL.indexOf('X') === -1;
  if (awLive) { gtag('config', AW_ID); }

  /* Single choke point the quote form calls on a successful enquiry.
     Fires the GA4 lead event now, and the Google Ads conversion once AW_ID
     + AW_LABEL are real. value 250 = the R250 an exclusive lead sells for. */
  window.dcTrackLead = function (lead) {
    try {
      gtag('event', 'generate_lead', {
        currency: 'ZAR',
        value: 250,
        service: (lead && lead.service) || '',
        suburb: (lead && lead.suburb) || ''
      });
      if (awLive) {
        gtag('event', 'conversion', {
          send_to: AW_ID + '/' + AW_LABEL,
          value: 250,
          currency: 'ZAR'
        });
      }
    } catch (e) { /* never let tracking break the form */ }
  };
})();

/* DryCape site interactions (mobile nav). Tiny, no dependencies. */
(function () {
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', nav.classList.contains('open'));
    });
  }
  // Pre-fill the quote form service/suburb when arriving from a landing page (?service=&suburb=)
  try {
    var p = new URLSearchParams(window.location.search);
    var svc = p.get('service');
    var sub = p.get('suburb');
    if (svc) { var s = document.getElementById('service'); if (s) setSelect(s, svc); }
    if (sub) { var b = document.getElementById('suburb'); if (b) setSelect(b, sub); }
  } catch (e) {}
  function setSelect(sel, val) {
    val = val.toLowerCase();
    for (var i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value.toLowerCase() === val) { sel.selectedIndex = i; return; }
    }
  }
})();
