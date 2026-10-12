(function () {
  'use strict';

  const CFG = window.RB_CONFIG;
  const STORAGE_KEY = 'resume-builder.v1';
  const $ = (sel) => document.querySelector(sel);

  // Editor-only UI state; not saved with the resume.
  const collapsed = new Set();

  let state = loadSaved() || newResume(CFG.defaultProfile);

  // ---------- Model ----------

  function uid() {
    return Math.random().toString(36).slice(2, 10);
  }

  function getProfile(id) {
    return CFG.profiles.find((p) => p.id === id) || CFG.profiles[0];
  }

  function emptyContent(type) {
    return CFG.sectionTypes[type].kind === 'entries' ? [] : '';
  }

  function newSection(type, title) {
    return {
      id: uid(),
      type,
      title: title || CFG.sectionTypes[type].label,
      visible: true,
      content: emptyContent(type),
    };
  }

  function newEntry() {
    return { id: uid() };
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
    return section.content.some((entry) =>
      Object.keys(entry).some((k) => k !== 'id' && String(entry[k]).trim() !== '')
    );
  }

  function move(list, index, delta) {
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
  }

  // Switch layout: keep content of sections whose type exists in the new profile.
  function applyProfile(profileId) {
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
    const dropped = remaining.filter(hasContent);
    if (dropped.length) {
      const names = dropped.map((s) => '- ' + s.title).join('\n');
      const keep = confirm(
        'These sections have content and are not part of the new layout:\n\n' + names +
        '\n\nOK = keep them at the end.  Cancel = remove them.'
      );
      if (keep) next.push(...dropped);
    }
    state.profileId = profile.id;
    state.sections = next;
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
    const str = (v) => (v == null ? '' : String(v));
    const personal = {};
    CFG.personalFields.forEach((f) => { personal[f.key] = str(data.personal && data.personal[f.key]); });

    const sections = data.sections
      .filter((s) => s && CFG.sectionTypes[s.type])
      .map((s) => {
        const type = CFG.sectionTypes[s.type];
        let content;
        if (type.kind === 'entries') {
          content = (Array.isArray(s.content) ? s.content : []).map((e) => {
            const entry = newEntry();
            type.fields.forEach((f) => { entry[f.key] = str(e && e[f.key]); });
            return entry;
          });
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
        commit(true);
      } catch (e) {
        alert('Could not open this file: ' + e.message);
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

  function inputField(id, label, bind, value, opts) {
    opts = opts || {};
    const attrs = `id="${id}" data-bind="${esc(bind)}"` +
      (opts.placeholder ? ` placeholder="${esc(opts.placeholder)}"` : '');
    const control = opts.multiline
      ? `<textarea ${attrs}>${esc(value)}</textarea>`
      : `<input type="${opts.type || 'text'}" ${attrs} value="${esc(value)}">`;
    return `<div class="field ${opts.wide ? 'wide' : ''}"><label for="${id}">${esc(label)}</label>${control}</div>`;
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

    $('#personal').innerHTML = CFG.personalFields
      .map((f) => inputField('p-' + f.key, f.label, 'personal|' + f.key, state.personal[f.key] || '', {
        type: f.type,
        wide: f.key === 'fullName' || f.key === 'headline',
      }))
      .join('');

    $('#sections').innerHTML = state.sections.map(sectionCard).join('');

    $('#add-type').innerHTML = Object.entries(CFG.sectionTypes)
      .map(([key, t]) => `<option value="${key}">${esc(t.label)}</option>`)
      .join('');
  }

  function sectionCard(section, index) {
    const type = CFG.sectionTypes[section.type];
    const sid = `data-sid="${section.id}"`;
    const isCollapsed = collapsed.has(section.id);
    const last = state.sections.length - 1;

    let body = '';
    if (!isCollapsed) {
      if (type.kind === 'text') {
        body = inputField('c-' + section.id, 'Content', 'content|' + section.id, section.content, { multiline: true });
      } else if (type.kind === 'tags') {
        body = inputField('c-' + section.id, 'Items (separate with commas)', 'content|' + section.id, section.content,
          { placeholder: type.placeholder });
      } else {
        body = section.content.map((entry, i) => entryCard(section, type, entry, i)).join('') +
          button('add-entry', '+ Add entry', sid, { cls: '' });
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

  function entryCard(section, type, entry, index) {
    const ids = `data-sid="${section.id}" data-eid="${entry.id}"`;
    const fields = type.fields
      .map((f) => inputField(`e-${entry.id}-${f.key}`, f.label, `entry|${section.id}|${entry.id}|${f.key}`,
        entry[f.key] || '', {
          multiline: f.multiline,
          placeholder: f.placeholder,
          wide: f.multiline || f.role === 'title' || f.role === 'subtitle',
        }))
      .join('');
    return `
      <div class="entry">
        <div class="entry-tools">
          ${button('entry-up', '&uarr;', ids, { aria: 'Move entry up', disabled: index === 0 })}
          ${button('entry-down', '&darr;', ids, { aria: 'Move entry down', disabled: index === section.content.length - 1 })}
          ${button('delete-entry', '&times;', ids, { cls: 'icon danger', aria: 'Remove entry' })}
        </div>
        <div class="grid">${fields}</div>
      </div>`;
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
    type.fields.forEach((f) => {
      const v = (entry[f.key] || '').trim();
      if (v) byRole[f.role] = v;
    });
    if (!Object.keys(byRole).length) return '';

    const lines = (byRole.body || '').split('\n').map((l) => l.replace(/^\s*[-*•]\s*/, '').trim()).filter(Boolean);
    const bodyHtml = lines.length > 1
      ? `<ul>${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`
      : lines.length ? `<p>${esc(lines[0])}</p>` : '';

    // Escape the parts, not the joined string, so the &ndash; entity survives.
    const dates = byRole.date ? esc(byRole.date)
      : [byRole.start, byRole.end].filter(Boolean).map(esc).join(' &ndash; ');

    return `<div class="r-entry">
      <div class="r-line"><span class="r-title">${esc(byRole.title || '')}</span>${dates ? `<span class="r-dates">${dates}</span>` : ''}</div>
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

  function onInput(e) {
    const bind = e.target.dataset.bind;
    if (!bind) return;
    const [kind, a, b, c] = bind.split('|');
    const value = e.target.value;

    if (kind === 'personal') state.personal[a] = value;
    else if (kind === 'title') findSection(a).title = value;
    else if (kind === 'content') findSection(a).content = value;
    else if (kind === 'entry') findSection(a).content.find((en) => en.id === b)[c] = value;

    commit(false);
  }

  function onClick(e) {
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
        if (!confirm('Clear all resume data from this browser? Save a file first if you want to keep it.')) return;
        try { localStorage.removeItem(STORAGE_KEY); } catch (err) { /* ignore */ }
        state = newResume(state.profileId);
        collapsed.clear();
        renderEditor();
        return renderPreview();
      case 'add-section': {
        const s = newSection($('#add-type').value);
        if (CFG.sectionTypes[s.type].kind === 'entries') s.content.push(newEntry());
        state.sections.push(s);
        commit(true);
        const input = document.getElementById('t-' + s.id);
        if (input) { input.focus(); input.select(); }
        return;
      }
      case 'collapse':
        collapsed.has(sid) ? collapsed.delete(sid) : collapsed.add(sid);
        return renderEditor();
      case 'section-up': move(state.sections, index, -1); break;
      case 'section-down': move(state.sections, index, 1); break;
      case 'toggle-visible': section.visible = !section.visible; break;
      case 'delete-section':
        if (hasContent(section) && !confirm(`Remove "${section.title}" and its content?`)) return;
        state.sections.splice(index, 1);
        break;
      case 'add-entry': section.content.push(newEntry()); break;
      case 'entry-up': move(section.content, entryIndex, -1); break;
      case 'entry-down': move(section.content, entryIndex, 1); break;
      case 'delete-entry': section.content.splice(entryIndex, 1); break;
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

    document.addEventListener('input', onInput);
    document.addEventListener('click', onClick);
    $('#profile').addEventListener('change', (e) => {
      applyProfile(e.target.value);
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
