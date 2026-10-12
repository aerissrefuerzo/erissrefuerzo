/*
 * Agency configuration.
 *
 * This is the only file an agency needs to edit to adopt the tool:
 *   - agency:         name, tagline and brand color shown in the app
 *   - personalFields: the contact/identity fields collected
 *   - sectionTypes:   the building blocks a resume can contain
 *   - profiles:       preset section layouts for different user types
 */
window.RB_CONFIG = {
  agency: {
    name: 'Your Agency Name',
    tagline: 'Resume Builder',
    primaryColor: '#1f4e79',
    privacyNote: 'Your data stays in this browser. Nothing is uploaded to a server.',
  },

  defaultProfile: 'experienced',

  // `contact: true` fields are shown on the contact line under the name.
  personalFields: [
    { key: 'fullName', label: 'Full name', type: 'text', required: true },
    { key: 'headline', label: 'Headline / target position', type: 'text' },
    { key: 'email', label: 'Email', type: 'email', required: true, contact: true, placeholder: 'name@example.com' },
    { key: 'phone', label: 'Phone', type: 'tel', contact: true, placeholder: 'e.g. 0917 123 4567' },
    { key: 'address', label: 'City / address', type: 'text', contact: true },
    { key: 'website', label: 'LinkedIn / website', type: 'url', contact: true, placeholder: 'https://' },
  ],

  /*
   * Section kinds:
   *   text    - one free-text block
   *   tags    - comma-separated list
   *   entries - repeatable items, each with the listed fields
   *
   * Entry field options:
   *   role      where it appears in the preview: title, honor (bold italic after
   *             the title), subtitle, meta, start, end, date, body
   *   type      text (default), textarea, select, monthyear, number, contact
   *   required  entry cannot be saved without it
   *   present   (monthyear only) offer a "Present" option
   *   options   (select only) choices; the first one means "none"
   *   list      (textarea only) always show as bullets, one per line
   *   wide      true/false to force full or half width in the editor
   *
   * `core: true` sections are the standard ones every resume has. The rest are
   * offered under "Add a section".
   */
  sectionTypes: {
    summary: { label: 'Professional Summary', kind: 'text', core: true },
    experience: {
      label: 'Work Experience',
      kind: 'entries',
      core: true,
      fields: [
        { key: 'position', label: 'Position', role: 'title', required: true },
        { key: 'organization', label: 'Organization', role: 'subtitle', required: true },
        { key: 'location', label: 'Location', role: 'meta' },
        { key: 'start', label: 'Start date', role: 'start', type: 'monthyear', required: true },
        { key: 'end', label: 'End date', role: 'end', type: 'monthyear', required: true, present: true },
        { key: 'description', label: 'Duties and accomplishments (one per line)', role: 'body', type: 'textarea', list: true },
      ],
    },
    education: {
      label: 'Education',
      kind: 'entries',
      core: true,
      fields: [
        { key: 'degree', label: 'Degree / program', role: 'title', required: true, wide: false },
        {
          key: 'honor', label: 'Latin honors', role: 'honor', type: 'select',
          options: ['None', 'Cum Laude', 'Magna Cum Laude', 'Summa Cum Laude'],
        },
        { key: 'school', label: 'School', role: 'subtitle', required: true },
        { key: 'location', label: 'Location', role: 'meta' },
        { key: 'start', label: 'Start date', role: 'start', type: 'monthyear' },
        { key: 'end', label: 'Graduation date', role: 'end', type: 'monthyear', required: true, present: true },
        { key: 'details', label: 'Achievements and details (one per line)', role: 'body', type: 'textarea', list: true },
      ],
    },
    skills: { label: 'Skills', kind: 'tags', core: true, placeholder: 'e.g. Project management, Data analysis, MS Excel' },
    eligibility: {
      label: 'Eligibility, Licenses and Certifications',
      kind: 'entries',
      fields: [
        { key: 'name', label: 'Eligibility / license / certification', role: 'title', required: true },
        { key: 'issuer', label: 'Issuing body', role: 'subtitle', required: true },
        { key: 'rating', label: 'Rating / license no.', role: 'meta' },
        { key: 'date', label: 'Date obtained', role: 'date', type: 'monthyear', required: true },
      ],
    },
    training: {
      label: 'Trainings and Seminars',
      kind: 'entries',
      fields: [
        { key: 'title', label: 'Title', role: 'title', required: true },
        { key: 'provider', label: 'Conducted by', role: 'subtitle', required: true },
        { key: 'hours', label: 'Number of hours', role: 'meta', type: 'number', suffix: 'hours' },
        { key: 'date', label: 'Date', role: 'date', type: 'monthyear', required: true },
      ],
    },
    languages: { label: 'Languages', kind: 'tags', placeholder: 'e.g. English, Filipino' },
    awards: {
      label: 'Awards and Recognition',
      kind: 'entries',
      fields: [
        { key: 'title', label: 'Award', role: 'title', required: true },
        { key: 'issuer', label: 'Given by', role: 'subtitle', required: true },
        { key: 'date', label: 'Date', role: 'date', type: 'monthyear', required: true },
        { key: 'details', label: 'Details', role: 'body', type: 'textarea' },
      ],
    },
    volunteer: {
      label: 'Volunteer Work',
      kind: 'entries',
      fields: [
        { key: 'role', label: 'Role', role: 'title', required: true },
        { key: 'organization', label: 'Organization', role: 'subtitle', required: true },
        { key: 'start', label: 'Start date', role: 'start', type: 'monthyear', required: true },
        { key: 'end', label: 'End date', role: 'end', type: 'monthyear', required: true, present: true },
        { key: 'description', label: 'Description (one per line)', role: 'body', type: 'textarea', list: true },
      ],
    },
    references: {
      label: 'References',
      kind: 'entries',
      fields: [
        { key: 'name', label: 'Name', role: 'title', required: true },
        { key: 'position', label: 'Position and organization', role: 'subtitle', required: true },
        { key: 'contact', label: 'Email or phone', role: 'meta', type: 'contact', required: true },
      ],
    },
    custom: {
      label: 'Custom Section',
      kind: 'entries',
      repeatable: true,
      fields: [
        { key: 'title', label: 'Title', role: 'title', required: true },
        { key: 'subtitle', label: 'Subtitle', role: 'subtitle' },
        { key: 'date', label: 'Date', role: 'date', type: 'monthyear' },
        { key: 'details', label: 'Details (one per line)', role: 'body', type: 'textarea', list: true },
      ],
    },
  },

  // A profile sets the starting order of the standard sections. Users add the rest.
  profiles: [
    {
      id: 'experienced',
      label: 'Experienced professional',
      description: 'Leads with work experience.',
      sections: [{ type: 'summary' }, { type: 'experience' }, { type: 'education' }, { type: 'skills' }],
    },
    {
      id: 'fresh-graduate',
      label: 'Fresh graduate / entry level',
      description: 'Leads with education. Internships go under work experience.',
      sections: [{ type: 'summary', title: 'Career Objective' }, { type: 'education' }, { type: 'skills' }, { type: 'experience' }],
    },
    {
      id: 'career-shifter',
      label: 'Career shifter',
      description: 'Leads with transferable skills.',
      sections: [{ type: 'summary' }, { type: 'skills', title: 'Transferable Skills' }, { type: 'experience' }, { type: 'education' }],
    },
    {
      id: 'government',
      label: 'Government applicant',
      description: 'Adds civil service eligibility, which most government positions require.',
      sections: [
        { type: 'summary' },
        { type: 'eligibility', title: 'Civil Service Eligibility' },
        { type: 'experience' },
        { type: 'education' },
        { type: 'skills' },
      ],
    },
  ],
};
