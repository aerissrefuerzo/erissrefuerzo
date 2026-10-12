/*
 * Agency configuration.
 *
 * This is the only file an agency needs to edit to adopt the tool:
 *   - agency:        name, tagline and brand color shown in the app
 *   - personalFields: the contact/identity fields collected
 *   - sectionTypes:  the building blocks a resume can contain
 *   - profiles:      preset section layouts for different user types
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
    { key: 'fullName', label: 'Full name', type: 'text' },
    { key: 'headline', label: 'Headline / target position', type: 'text' },
    { key: 'email', label: 'Email', type: 'email', contact: true },
    { key: 'phone', label: 'Phone', type: 'tel', contact: true },
    { key: 'address', label: 'City / address', type: 'text', contact: true },
    { key: 'website', label: 'LinkedIn / website', type: 'text', contact: true },
  ],

  /*
   * Section kinds:
   *   text    - one free-text block
   *   tags    - comma-separated list
   *   entries - repeatable items, each with the listed fields
   *
   * Entry field roles control how the field is laid out in the preview:
   *   title, subtitle, meta, start, end, date, body
   */
  sectionTypes: {
    summary: { label: 'Professional Summary', kind: 'text' },
    experience: {
      label: 'Work Experience',
      kind: 'entries',
      fields: [
        { key: 'position', label: 'Position', role: 'title' },
        { key: 'organization', label: 'Organization', role: 'subtitle' },
        { key: 'location', label: 'Location', role: 'meta' },
        { key: 'start', label: 'Start', role: 'start', placeholder: 'e.g. Jan 2021' },
        { key: 'end', label: 'End', role: 'end', placeholder: 'e.g. Present' },
        { key: 'description', label: 'Duties and accomplishments (one per line)', role: 'body', multiline: true },
      ],
    },
    education: {
      label: 'Education',
      kind: 'entries',
      fields: [
        { key: 'degree', label: 'Degree / program', role: 'title' },
        { key: 'school', label: 'School', role: 'subtitle' },
        { key: 'location', label: 'Location', role: 'meta' },
        { key: 'start', label: 'Start', role: 'start' },
        { key: 'end', label: 'End', role: 'end' },
        { key: 'details', label: 'Honors / details', role: 'body', multiline: true },
      ],
    },
    eligibility: {
      label: 'Eligibility, Licenses and Certifications',
      kind: 'entries',
      fields: [
        { key: 'name', label: 'Eligibility / license / certification', role: 'title' },
        { key: 'issuer', label: 'Issuing body', role: 'subtitle' },
        { key: 'rating', label: 'Rating / license no.', role: 'meta' },
        { key: 'date', label: 'Date obtained', role: 'date' },
      ],
    },
    training: {
      label: 'Trainings and Seminars',
      kind: 'entries',
      fields: [
        { key: 'title', label: 'Title', role: 'title' },
        { key: 'provider', label: 'Conducted by', role: 'subtitle' },
        { key: 'hours', label: 'Number of hours', role: 'meta' },
        { key: 'date', label: 'Date', role: 'date' },
      ],
    },
    skills: { label: 'Skills', kind: 'tags', placeholder: 'e.g. Project management, Data analysis, MS Excel' },
    languages: { label: 'Languages', kind: 'tags', placeholder: 'e.g. English, Filipino' },
    awards: {
      label: 'Awards and Recognition',
      kind: 'entries',
      fields: [
        { key: 'title', label: 'Award', role: 'title' },
        { key: 'issuer', label: 'Given by', role: 'subtitle' },
        { key: 'date', label: 'Date', role: 'date' },
        { key: 'details', label: 'Details', role: 'body', multiline: true },
      ],
    },
    volunteer: {
      label: 'Volunteer Work',
      kind: 'entries',
      fields: [
        { key: 'role', label: 'Role', role: 'title' },
        { key: 'organization', label: 'Organization', role: 'subtitle' },
        { key: 'start', label: 'Start', role: 'start' },
        { key: 'end', label: 'End', role: 'end' },
        { key: 'description', label: 'Description (one per line)', role: 'body', multiline: true },
      ],
    },
    references: {
      label: 'References',
      kind: 'entries',
      fields: [
        { key: 'name', label: 'Name', role: 'title' },
        { key: 'position', label: 'Position and organization', role: 'subtitle' },
        { key: 'contact', label: 'Contact', role: 'meta' },
      ],
    },
    custom: {
      label: 'Custom Section',
      kind: 'entries',
      fields: [
        { key: 'title', label: 'Title', role: 'title' },
        { key: 'subtitle', label: 'Subtitle', role: 'subtitle' },
        { key: 'date', label: 'Date', role: 'date' },
        { key: 'details', label: 'Details (one per line)', role: 'body', multiline: true },
      ],
    },
  },

  // A profile is a starting layout. Users can still add, remove, rename and reorder.
  profiles: [
    {
      id: 'fresh-graduate',
      label: 'Fresh graduate / entry level',
      description: 'Leads with education, trainings and volunteer work.',
      sections: [
        { type: 'summary', title: 'Career Objective' },
        { type: 'education' },
        { type: 'skills' },
        { type: 'training' },
        { type: 'volunteer' },
        { type: 'awards' },
        { type: 'references' },
      ],
    },
    {
      id: 'experienced',
      label: 'Experienced professional',
      description: 'Leads with work experience and accomplishments.',
      sections: [
        { type: 'summary' },
        { type: 'experience' },
        { type: 'education' },
        { type: 'skills' },
        { type: 'eligibility' },
        { type: 'training' },
      ],
    },
    {
      id: 'government',
      label: 'Government applicant',
      description: 'Highlights civil service eligibility and learning and development hours.',
      sections: [
        { type: 'summary' },
        { type: 'eligibility', title: 'Civil Service Eligibility' },
        { type: 'experience' },
        { type: 'education' },
        { type: 'training', title: 'Learning and Development Interventions' },
        { type: 'skills' },
        { type: 'references' },
      ],
    },
    {
      id: 'career-shifter',
      label: 'Career shifter',
      description: 'Leads with transferable skills and recent training.',
      sections: [
        { type: 'summary' },
        { type: 'skills', title: 'Transferable Skills' },
        { type: 'training' },
        { type: 'experience' },
        { type: 'education' },
      ],
    },
  ],
};
