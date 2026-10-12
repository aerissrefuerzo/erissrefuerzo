(function () {
  'use strict';

  const CFG = window.RB_CONFIG;
  const STORAGE_KEY = 'resume-builder.v1';
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const THIS_YEAR = new Date().getFullYear();
  const MIN_YEAR = 1950;
  const MAX_YEAR = THIS_YEAR + 6; // allows expected graduation dates
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const PHONE_RE = /^\+?[\d\s().-]{7,20}$/;
  const URL_RE = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i;
  const $ = (sel) => document.querySelector(sel);

  // Editor-only UI state; not saved with the resume.
  const collapsed = new Set();
  const touched = new Set(); // personal fields the user has left at least once
  // Entries being added or edited, keyed by entry id: { sid, isNew, values, errors }.
  // An entry only reaches the resume once its draft passes validation.
  const drafts = new Map();

  // RB_SAMPLE (optional) pre-fills a demo resume for first-time visitors.
  let state = loadSaved() || sampleResume() || newResume(CFG.defaultProfile);

  function sampleResume() {
    try {
      return window.RB_SAMPLE ? sanitize(window.RB_SAMPLE) : null;
    } catch (e) {
      return null;
    }
  }

  // ---------- Model ----------

  function uid() {
    return Math.random().toString(36).slice(2, 10);
  }

  function getProfile(id) {
    return CFG.profiles.find((p) => p.id === id) || CFG.profiles[0];
  }

  function newSection(type, title) {
    return {
      id: uid(),
      type,
      title: title || CFG.sectionTypes[type].label,
      visible: true,
      content: CFG.sectionTypes[type].kind === 'entries' ? [] : '',
    };
  }

  function newResume(profileId) {
    const profile = getProfile(profileId);
    return {
      version: 1,
      profileId: profile.id,
      personal: {},
      sections: profile.sections.map((s) => newSection(s.type, s.title)),
    };
  }

  function findSection(id) {
    return state.sections.find((s) => s.id === id);
  }

  function hasContent(section) {
    const kind = CFG.sectionTypes[section.type].kind;
    if (kind !== 'entries') return String(section.content).trim() !== '';
    return section.content.length > 0;
  }

  function move(list, index, delta) {
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
  }

  // Switch layout: keep content of sections whose type exists in the new profile.
  async function applyProfile(profileId) {
    const profile = getProfile(profileId);
    const oldProfile = getProfile(state.profileId);
    const defaultTitle = (p, type) => {
      const ps = p.sections.find((s) => s.type === type);
      return (ps && ps.title) || CFG.sectionTypes[type].label;
    };
    const remaining = state.sections.slice();
    const next = profile.sections.map((ps) => {
      const i = remaining.findIndex((s) => s.type === ps.type);
      if (i === -1) return newSection(ps.type, ps.title);
      const [kept] = remaining.splice(i, 1);
      // Only retitle sections the user has not renamed.
      if (kept.title === defaultTitle(oldProfile, kept.type)) kept.title = defaultTitle(profile, kept.type);
      return kept;
    });
    const extra = remaining.filter(hasContent);
    if (extra.length) {
      const names = extra.map((s) => '- ' + s.title).join('\n');
      const keep = await ask(
        'These sections have content and are not part of the new layout:\n\n' + names,
        'Keep them at the end', 'Remove them'
      );
      if (keep) next.push(...extra);
    }
    state.profileId = profile.id;
    state.sections = next;
  }

  // ---------- Dates ----------
  // Stored as "YYYY", "YYYY-MM", "present" or "".

  function blankDate() {
    return { y: '', m: '', present: false };
  }

  // Returns {y, m, present}, or null when the text is not a recognizable date.
  function parseDate(value) {
    const v = String(value == null ? '' : value).trim();
    if (!v) return blankDate();
    if (/^present$/i.test(v)) return { y: '', m: '', present: true };
    let r = v.match(/^(\d{4})(?:-(\d{1,2}))?$/);
    if (r) {
      const m = r[2] ? Number(r[2]) : 0;
      if (m > 12) return null;
      return { y: r[1], m: m ? String(m).padStart(2, '0') : '', present: false };
    }
    r = v.match(/^([A-Za-z]{3})[a-z]*\.?\s+(\d{4})$/);
    if (r) {
      const i = MONTHS.findIndex((mo) => mo.toLowerCase() === r[1].toLowerCase());
      if (i >= 0) return { y: r[2], m: String(i + 1).padStart(2, '0'), present: false };
    }
    return null;
  }

  function serializeDate(d) {
    if (d.present) return 'present';
    if (!d.y) return '';
    return d.m ? `${d.y}-${d.m}` : d.y;
  }

  function formatDate(value) {
    const d = parseDate(value);
    if (!d) return '';
    if (d.present) return 'Present';
    if (!d.y) return '';
    return d.m ? `${MONTHS[Number(d.m) - 1]} ${d.y}` : d.y;
  }

  // Comparable number; a missing month counts as January for starts and December for ends.
  function dateRank(d, fallbackMonth) {
    return Number(d.y) * 12 + Number(d.m || fallbackMonth);
  }

  // ---------- Validation ----------

  function validateEntry(type, values) {
    const errors = {};
    type.fields.forEach((f) => {
      const v = values[f.key];
      if (f.type === 'monthyear') {
        if (v.present) return;
        if (!v.y && f.required) errors[f.key] = f.present ? 'Choose a year, or tick Present.' : 'Choose a year.';
        else if (!v.y && v.m) errors[f.key] = 'Choose a year for this month.';
        return;
      }
      const s = String(v).trim();
      if (!s) {
        if (f.required) errors[f.key] = `${f.label} is required.`;
        return;
      }
      if (f.type === 'number' && !(/^\d+(\.\d+)?$/.test(s) && Number(s) > 0 && Number(s) <= 10000)) {
        errors[f.key] = 'Enter a number greater than 0.';
      } else if (f.type === 'contact' && !(EMAIL_RE.test(s) || validPhone(s))) {
        errors[f.key] = 'Enter a valid email address or phone number.';
      }
    });

    const startField = type.fields.find((f) => f.role === 'start');
    const endField = type.fields.find((f) => f.role === 'end');
    if (startField) {
      const start = values[startField.key];
      const now = THIS_YEAR * 12 + new Date().getMonth() + 1;
      if (start.y && !errors[startField.key] && dateRank(start, 1) > now) {
        errors[startField.key] = 'Start date cannot be in the future.';
      }
      if (endField) {
        const end = values[endField.key];
        if (start.y && end.y && !end.present && !errors[endField.key] && dateRank(end, 12) < dateRank(start, 1)) {
          errors[endField.key] = 'End date must be on or after the start date.';
        }
      }
    }
    return errors;
  }

  function validPhone(s) {
    return PHONE_RE.test(s) && s.replace(/\D/g, '').length >= 7;
  }

  function personalError(field, value) {
    const v = (value || '').trim();
    if (!v) return field.required && touched.has(field.key) ? `${field.label} is required.` : '';
    if (field.type === 'email' && !EMAIL_RE.test(v)) return 'Enter a valid email address, like name@example.com.';
    if (field.type === 'tel' && !validPhone(v)) return 'Enter a valid phone number (at least 7 digits).';
    if (field.type === 'url' && !URL_RE.test(v)) return 'Enter a valid web address, like linkedin.com/in/yourname.';
    return '';
  }

  // ---------- Drafts ----------

  function openDraft(section, entry) {
    const type = CFG.sectionTypes[section.type];
    const id = entry ? entry.id : uid();
    const values = {};
    type.fields.forEach((f) => {
      const raw = entry ? entry[f.key] : '';
      values[f.key] = f.type === 'monthyear' ? parseDate(raw) || blankDate() : raw || '';
    });
    drafts.set(id, { sid: section.id, isNew: !entry, values, errors: {} });
    return id;
  }

  function newDraftIn(section) {
    for (const [id, d] of drafts) if (d.sid === section.id && d.isNew) return id;
    return null;
  }

  function saveDraft(id) {
    const draft = drafts.get(id);
    const section = findSection(draft.sid);
    if (!section) { drafts.delete(id); return true; }
    const type = CFG.sectionTypes[section.type];
    draft.errors = validateEntry(type, draft.values);
    if (Object.keys(draft.errors).length) return false;

    const entry = { id };
    type.fields.forEach((f) => {
      const v = draft.values[f.key];
      entry[f.key] = f.type === 'monthyear' ? serializeDate(v) : String(v).trim();
    });
    if (draft.isNew) section.content.push(entry);
    else section.content[section.content.findIndex((e) => e.id === id)] = entry;
    drafts.delete(id);
    return true;
  }

  function focusDraft(id, key) {
    const sel = key ? `[data-draft^="${id}|${key}"]` : `[data-draft^="${id}|"]`;
    const el = document.querySelector(sel);
    if (el) el.focus();
  }

  // ---------- Persistence ----------

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // Storage can be unavailable (private mode, blocked). The app still works for the session.
    }
  }

  function loadSaved() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? sanitize(JSON.parse(raw)) : null;
    } catch (e) {
      return null;
    }
  }

  // Accepts untrusted JSON (saved files, old storage) and returns a valid resume or throws.
  function sanitize(data) {
    if (!data || typeof data !== 'object' || !Array.isArray(data.sections)) {
      throw new Error('Not a resume file.');
    }
    const str = (v) => (v == null ? '' : String(v).trim());
    const personal = {};
    CFG.personalFields.forEach((f) => { personal[f.key] = str(data.personal && data.personal[f.key]); });

    const cleanField = (f, raw) => {
      if (f.type === 'monthyear') {
        const d = parseDate(raw);
        return d ? serializeDate(d) : '';
      }
      if (f.type === 'number') {
        const n = parseFloat(raw);
        return n > 0 ? String(n) : '';
      }
      if (f.type === 'select') {
        const match = f.options.slice(1).find((o) => o.toLowerCase() === str(raw).toLowerCase());
        return match || '';
      }
      return str(raw);
    };

    const sections = data.sections
      .filter((s) => s && CFG.sectionTypes[s.type])
      .map((s) => {
        const type = CFG.sectionTypes[s.type];
        let content;
        if (type.kind === 'entries') {
          content = (Array.isArray(s.content) ? s.content : [])
            .filter((e) => e && typeof e === 'object')
            .map((e) => {
              const entry = { id: uid() };
              type.fields.forEach((f) => { entry[f.key] = cleanField(f, e[f.key]); });
              return entry;
            })
            .filter((e) => type.fields.some((f) => e[f.key]));
        } else {
          content = str(s.content);
        }
        return { id: uid(), type: s.type, title: str(s.title) || type.label, visible: s.visible !== false, content };
      });

    return { version: 1, profileId: getProfile(data.profileId).id, personal, sections };
  }

  function exportFile() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const name = (state.personal.fullName || 'resume').trim().replace(/[^\w-]+/g, '_');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function importFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        state = sanitize(JSON.parse(reader.result));
        collapsed.clear();
        drafts.clear();
        commit(true);
      } catch (e) {
        ask('Could not open this file. ' + e.message, 'OK', null);
      }
    };
    reader.readAsText(file);
  }

  // ---------- Rendering helpers ----------

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function labelHtml(forId, text, required) {
    return `<label for="${forId}">${esc(text)}${required ? ' <span class="req" aria-hidden="true">*</span>' : ''}</label>`;
  }

  function errorHtml(id, message) {
    return `<p class="error" id="${id}"${message ? '' : ' hidden'}>${esc(message || '')}</p>`;
  }

  function invalidAttrs(errId, message) {
    return ` aria-describedby="${errId}"${message ? ' aria-invalid="true"' : ''}`;
  }

  function button(action, label, attrs, opts) {
    opts = opts || {};
    return `<button type="button" class="${opts.cls || 'icon'}" data-action="${action}" ${attrs}` +
      ` aria-label="${esc(opts.aria || label)}" title="${esc(opts.aria || label)}"${opts.disabled ? ' disabled' : ''}>${label}</button>`;
  }

  // ---------- Editor ----------

  function renderEditor() {
    $('#profile').innerHTML = CFG.profiles
      .map((p) => `<option value="${esc(p.id)}"${p.id === state.profileId ? ' selected' : ''}>${esc(p.label)}</option>`)
      .join('');
    $('#profile-desc').textContent = getProfile(state.profileId).description || '';

    $('#personal').innerHTML = CFG.personalFields.map(personalField).join('');
    $('#sections').innerHTML = state.sections.map(sectionCard).join('');
    renderAddOptions();
  }

  function personalField(f) {
    const id = 'p-' + f.key;
    const errId = 'err-' + id;
    const message = personalError(f, state.personal[f.key]);
    const wide = f.key === 'fullName' || f.key === 'headline';
    return `<div class="field${wide ? ' wide' : ''}">
      ${labelHtml(id, f.label, f.required)}
      <input id="${id}" type="${f.type || 'text'}" data-bind="personal|${f.key}" value="${esc(state.personal[f.key] || '')}"
        ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ''}${f.required ? ' aria-required="true"' : ''}
        ${f.type === 'email' ? 'autocomplete="email"' : ''}${invalidAttrs(errId, message)}>
      ${errorHtml(errId, message)}
    </div>`;
  }

  // Only offer sections not already on the resume (custom sections can repeat).
  function renderAddOptions() {
    const used = new Set(state.sections.map((s) => s.type));
    const available = Object.entries(CFG.sectionTypes).filter(([key, t]) => t.repeatable || !used.has(key));
    const group = (label, items) => items.length
      ? `<optgroup label="${label}">${items.map(([key, t]) => `<option value="${key}">${esc(t.label)}</option>`).join('')}</optgroup>`
      : '';
    $('#add-type').innerHTML =
      group('Standard sections', available.filter(([, t]) => t.core)) +
      group('More sections', available.filter(([, t]) => !t.core));
  }

  function sectionCard(section, index) {
    const type = CFG.sectionTypes[section.type];
    const sid = `data-sid="${section.id}"`;
    const isCollapsed = collapsed.has(section.id);
    const last = state.sections.length - 1;

    let body = '';
    if (!isCollapsed) {
      if (type.kind === 'text') {
        body = `<div class="field">${labelHtml('c-' + section.id, 'Content')}
          <textarea id="c-${section.id}" data-bind="content|${section.id}">${esc(section.content)}</textarea></div>`;
      } else if (type.kind === 'tags') {
        body = `<div class="field">${labelHtml('c-' + section.id, 'Items (separate with commas)')}
          <input id="c-${section.id}" data-bind="content|${section.id}" value="${esc(section.content)}"
            placeholder="${esc(type.placeholder || '')}"></div>`;
      } else {
        const newId = newDraftIn(section);
        body = section.content.map((entry, i) => drafts.has(entry.id)
          ? entryForm(section, type, entry.id)
          : entrySummary(section, type, entry, i)).join('') +
          (newId ? entryForm(section, type, newId) : button('add-entry', '+ Add entry', sid, { cls: 'add-entry' }));
      }
    }

    return `
      <div class="panel section-card${section.visible ? '' : ' hidden-section'}">
        <div class="section-head">
          <label for="t-${section.id}" class="sr-only">Section title</label>
          <input id="t-${section.id}" data-bind="title|${section.id}" value="${esc(section.title)}">
          <span class="type">${esc(type.label)}</span>
        </div>
        <div class="section-tools">
          ${button('collapse', isCollapsed ? 'Expand' : 'Collapse', sid, { cls: '' })}
          ${button('section-up', '&uarr;', sid, { aria: 'Move section up', disabled: index === 0 })}
          ${button('section-down', '&darr;', sid, { aria: 'Move section down', disabled: index === last })}
          ${button('toggle-visible', section.visible ? 'Hide' : 'Show', sid,
            { cls: '', aria: section.visible ? 'Hide from resume' : 'Show on resume' })}
          ${button('delete-section', 'Remove', sid, { cls: 'danger', aria: 'Remove section' })}
        </div>
        ${body}
      </div>`;
  }

  function entryHeadline(type, entry) {
    const pick = (role) => {
      const f = type.fields.find((x) => x.role === role);
      return f ? entry[f.key] || '' : '';
    };
    const dates = pick('date') ? formatDate(pick('date'))
      : [formatDate(pick('start')), formatDate(pick('end'))].filter(Boolean).join(' – ');
    const title = [pick('title'), pick('honor')].filter(Boolean).join(', ');
    return { title, sub: [pick('subtitle'), dates].filter(Boolean).join(' · ') };
  }

  function entrySummary(section, type, entry, index) {
    const ids = `data-sid="${section.id}" data-eid="${entry.id}"`;
    const h = entryHeadline(type, entry);
    return `
      <div class="entry entry-summary">
        <div class="entry-text">
          <span class="entry-title">${esc(h.title)}</span>
          ${h.sub ? `<span class="entry-sub">${esc(h.sub)}</span>` : ''}
        </div>
        <div class="entry-tools">
          ${button('edit-entry', 'Edit', ids, { cls: '', aria: 'Edit entry' })}
          ${button('entry-up', '&uarr;', ids, { aria: 'Move entry up', disabled: index === 0 })}
          ${button('entry-down', '&darr;', ids, { aria: 'Move entry down', disabled: index === section.content.length - 1 })}
          ${button('delete-entry', '&times;', ids, { cls: 'icon danger', aria: 'Remove entry' })}
        </div>
      </div>`;
  }

  function entryForm(section, type, id) {
    const draft = drafts.get(id);
    const ids = `data-sid="${section.id}" data-eid="${id}"`;
    const fields = type.fields.map((f) => draftField(id, f, draft)).join('');
    return `
      <div class="entry entry-form" role="group" aria-label="${draft.isNew ? 'New entry' : 'Edit entry'}">
        <p class="entry-form-title">${draft.isNew ? 'New entry' : 'Edit entry'}
          <span class="hint"><span class="req" aria-hidden="true">*</span> required</span></p>
        <div class="grid">${fields}</div>
        <div class="entry-actions">
          ${button('cancel-entry', 'Cancel', ids, { cls: '' })}
          ${button('save-entry', draft.isNew ? 'Add entry' : 'Save changes', ids, { cls: 'primary' })}
        </div>
      </div>`;
  }

  function draftField(id, f, draft) {
    const fid = `e-${id}-${f.key}`;
    const errId = `err-${fid}`;
    const message = draft.errors[f.key];
    const v = draft.values[f.key];
    const req = f.required ? ' aria-required="true"' : '';
    const bind = `data-draft="${id}|${f.key}`;
    const wide = f.wide !== undefined ? f.wide : f.type === 'textarea' || f.role === 'title' || f.role === 'subtitle';
    let control;

    if (f.type === 'monthyear') {
      const months = `<option value="">Month</option>` +
        MONTHS.map((m, i) => {
          const val = String(i + 1).padStart(2, '0');
          return `<option value="${val}"${v.m === val ? ' selected' : ''}>${m}</option>`;
        }).join('');
      let years = `<option value="">Year</option>`;
      for (let y = MAX_YEAR; y >= MIN_YEAR; y--) years += `<option value="${y}"${v.y === String(y) ? ' selected' : ''}>${y}</option>`;
      control = `<div class="date-row">
          <select id="${fid}" ${bind}|m" aria-label="${esc(f.label)} month"${v.present ? ' disabled' : ''}${invalidAttrs(errId, message)}>${months}</select>
          <select ${bind}|y" aria-label="${esc(f.label)} year"${req}${v.present ? ' disabled' : ''}${invalidAttrs(errId, message)}>${years}</select>
        </div>
        ${f.present ? `<label class="check"><input type="checkbox" ${bind}|present"${v.present ? ' checked' : ''}> Present</label>` : ''}`;
    } else if (f.type === 'select') {
      control = `<select id="${fid}" ${bind}"${req}${invalidAttrs(errId, message)}>` +
        f.options.map((o, i) => {
          const val = i === 0 ? '' : o;
          return `<option value="${esc(val)}"${v === val ? ' selected' : ''}>${esc(o)}</option>`;
        }).join('') + '</select>';
    } else if (f.type === 'textarea') {
      control = `<textarea id="${fid}" ${bind}"${req}${invalidAttrs(errId, message)}>${esc(v)}</textarea>`;
    } else if (f.type === 'number') {
      control = `<input id="${fid}" type="number" min="1" step="any" inputmode="decimal" ${bind}" value="${esc(v)}"${req}${invalidAttrs(errId, message)}>`;
    } else {
      const ph = f.type === 'contact' ? ' placeholder="name@example.com or 0917 123 4567"' : '';
      control = `<input id="${fid}" type="text" ${bind}" value="${esc(v)}"${ph}${req}${invalidAttrs(errId, message)}>`;
    }

    return `<div class="field${wide ? ' wide' : ''}">${labelHtml(fid, f.label, f.required)}${control}${errorHtml(errId, message)}</div>`;
  }

  // ---------- Preview ----------

  function renderPreview() {
    const p = state.personal;
    const contact = CFG.personalFields
      .filter((f) => f.contact && (p[f.key] || '').trim())
      .map((f) => esc(p[f.key]))
      .join(' &nbsp;|&nbsp; ');

    const sections = state.sections.filter((s) => s.visible && hasContent(s));
    const hasAnything = sections.length || (p.fullName || '').trim();

    let html = '';
    if (!hasAnything) {
      html = '<p class="r-empty">Start typing on the left. Your resume preview appears here.</p>';
    } else {
      html += `<header class="r-header"><h1>${esc(p.fullName || 'Your Name')}</h1>` +
        (p.headline ? `<p class="r-headline">${esc(p.headline)}</p>` : '') +
        (contact ? `<p class="r-contact">${contact}</p>` : '') + '</header>';
      html += sections.map(previewSection).join('');
    }
    $('#preview').innerHTML = html;
  }

  function previewSection(section) {
    const type = CFG.sectionTypes[section.type];
    let body;
    if (type.kind === 'text') {
      body = `<p>${esc(section.content.trim())}</p>`;
    } else if (type.kind === 'tags') {
      body = `<p>${section.content.split(',').map((t) => t.trim()).filter(Boolean).map(esc).join(' &bull; ')}</p>`;
    } else {
      body = section.content.map((entry) => previewEntry(type, entry)).join('');
    }
    return `<section class="r-section"><h2>${esc(section.title)}</h2>${body}</section>`;
  }

  function previewEntry(type, entry) {
    const byRole = {};
    const bodyField = type.fields.find((f) => f.role === 'body');
    type.fields.forEach((f) => {
      let v = (entry[f.key] || '').trim();
      if (!v) return;
      if (f.type === 'monthyear') v = formatDate(v);
      else if (f.suffix) v = `${v} ${f.suffix}`;
      if (v) byRole[f.role] = v;
    });

    const lines = (byRole.body || '').split('\n').map((l) => l.replace(/^\s*[-*•]\s*/, '').trim()).filter(Boolean);
    const bullets = lines.length > 1 || (bodyField && bodyField.list);
    const bodyHtml = lines.length && bullets
      ? `<ul>${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`
      : lines.length ? `<p>${esc(lines[0])}</p>` : '';

    // Escape the parts, not the joined string, so the &ndash; entity survives.
    const dates = byRole.date ? esc(byRole.date)
      : [byRole.start, byRole.end].filter(Boolean).map(esc).join(' &ndash; ');

    return `<div class="r-entry">
      <div class="r-line"><span class="r-title">${esc(byRole.title || '')}${byRole.honor ? `, <em class="r-honor">${esc(byRole.honor)}</em>` : ''}</span>${dates ? `<span class="r-dates">${dates}</span>` : ''}</div>
      ${byRole.subtitle || byRole.meta ? `<div class="r-line"><span class="r-sub">${esc(byRole.subtitle || '')}</span><span class="r-meta">${esc(byRole.meta || '')}</span></div>` : ''}
      ${bodyHtml}
    </div>`;
  }

  // ---------- Events ----------

  function commit(structural) {
    save();
    if (structural) renderEditor();
    renderPreview();
  }

  function showFieldError(input, message) {
    const err = document.getElementById(input.getAttribute('aria-describedby'));
    if (err) { err.textContent = message; err.hidden = !message; }
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }

  function onInput(e) {
    const el = e.target;

    if (el.dataset.draft) {
      const [id, key, part] = el.dataset.draft.split('|');
      const draft = drafts.get(id);
      if (!draft) return;
      if (part) {
        const d = draft.values[key];
        if (part === 'present') {
          d.present = el.checked;
          el.closest('.field').querySelectorAll('select').forEach((s) => { s.disabled = el.checked; });
        } else {
          d[part] = el.value;
        }
      } else {
        draft.values[key] = el.value;
      }
      // Clear a field's error as soon as the user starts fixing it.
      if (draft.errors[key]) {
        delete draft.errors[key];
        el.closest('.field').querySelectorAll('[aria-describedby]').forEach((c) => showFieldError(c, ''));
      }
      return;
    }

    const bind = el.dataset.bind;
    if (!bind) return;
    const [kind, a] = bind.split('|');
    if (kind === 'personal') {
      state.personal[a] = el.value;
      showFieldError(el, personalError(CFG.personalFields.find((f) => f.key === a), el.value));
    } else if (kind === 'title') {
      findSection(a).title = el.value;
    } else if (kind === 'content') {
      findSection(a).content = el.value;
    }
    commit(false);
  }

  function onFocusOut(e) {
    const bind = e.target.dataset && e.target.dataset.bind;
    if (!bind || !bind.startsWith('personal|')) return;
    const key = bind.split('|')[1];
    touched.add(key);
    showFieldError(e.target, personalError(CFG.personalFields.find((f) => f.key === key), e.target.value));
  }

  // In-page replacement for confirm()/alert(), which embedded browsers may block.
  // Resolves true for OK, false for cancel. Pass cancelLabel = null for a message with one button.
  function ask(message, okLabel, cancelLabel) {
    const dialog = $('#ask');
    $('#ask-message').textContent = message;
    $('#ask-ok').textContent = okLabel || 'OK';
    $('#ask-cancel').textContent = cancelLabel || 'Cancel';
    $('#ask-cancel').hidden = cancelLabel === null;
    return new Promise((resolve) => {
      dialog.addEventListener('close', () => resolve(dialog.returnValue === 'ok'), { once: true });
      dialog.returnValue = '';
      dialog.showModal();
    });
  }

  async function onClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, sid, eid } = btn.dataset;
    const section = sid && findSection(sid);
    const index = section ? state.sections.indexOf(section) : -1;
    const entryIndex = section && eid ? section.content.findIndex((en) => en.id === eid) : -1;

    switch (action) {
      case 'export': return exportFile();
      case 'print': return window.print();
      case 'reset':
        if (!(await ask('Clear all resume data from this browser? Save a file first if you want to keep it.',
          'Clear data', 'Cancel'))) return;
        try { localStorage.removeItem(STORAGE_KEY); } catch (err) { /* ignore */ }
        state = newResume(state.profileId);
        collapsed.clear();
        drafts.clear();
        touched.clear();
        renderEditor();
        return renderPreview();
      case 'add-section': {
        const type = $('#add-type').value;
        if (!type) return;
        const s = newSection(type);
        state.sections.push(s);
        const draftId = CFG.sectionTypes[type].kind === 'entries' ? openDraft(s, null) : null;
        commit(true);
        if (draftId) return focusDraft(draftId);
        const input = document.getElementById('c-' + s.id);
        if (input) input.focus();
        return;
      }
      case 'collapse':
        collapsed.has(sid) ? collapsed.delete(sid) : collapsed.add(sid);
        return renderEditor();
      case 'add-entry': {
        const id = newDraftIn(section) || openDraft(section, null);
        renderEditor();
        return focusDraft(id);
      }
      case 'edit-entry':
        openDraft(section, section.content[entryIndex]);
        renderEditor();
        return focusDraft(eid);
      case 'save-entry': {
        if (saveDraft(eid)) return commit(true);
        renderEditor();
        return focusDraft(eid, Object.keys(drafts.get(eid).errors)[0]);
      }
      case 'cancel-entry':
        drafts.delete(eid);
        return renderEditor();
      case 'section-up': move(state.sections, index, -1); break;
      case 'section-down': move(state.sections, index, 1); break;
      case 'toggle-visible': section.visible = !section.visible; break;
      case 'delete-section':
        if (hasContent(section) && !(await ask(`Remove "${section.title}" and its content?`, 'Remove', 'Cancel'))) return;
        state.sections.splice(state.sections.indexOf(section), 1);
        break;
      case 'entry-up': move(section.content, entryIndex, -1); break;
      case 'entry-down': move(section.content, entryIndex, 1); break;
      case 'delete-entry':
        drafts.delete(eid);
        section.content.splice(entryIndex, 1);
        break;
      default: return;
    }
    commit(true);
  }

  function init() {
    const agency = CFG.agency;
    document.documentElement.style.setProperty('--brand', agency.primaryColor);
    document.title = `${agency.tagline} | ${agency.name}`;
    $('#agency-name').textContent = agency.name;
    $('#agency-tagline').textContent = agency.tagline;
    $('#privacy-note').textContent = agency.privacyNote;
    // Set by hosts that block printing and downloads (e.g. a sandboxed preview).
    if (window.RB_EMBED) {
      document.querySelectorAll('[data-embed-hide]').forEach((el) => { el.hidden = true; });
      $('#embed-note').hidden = false;
    }

    document.addEventListener('input', onInput);
    document.addEventListener('change', onInput);
    document.addEventListener('focusout', onFocusOut);
    document.addEventListener('click', onClick);
    $('#profile').addEventListener('change', async (e) => {
      await applyProfile(e.target.value);
      commit(true);
    });
    $('#import-file').addEventListener('change', (e) => {
      if (e.target.files[0]) importFile(e.target.files[0]);
      e.target.value = '';
    });

    renderEditor();
    renderPreview();
  }

  init();
})();
