truncate activity, notifications, messages, tasks, areas, people, wedding restart identity cascade;

insert into wedding (id, name, date, info) values (1, 'Maya & Jordan', '2027-06-12', '{
  "venue": "Cedar Hollow Farm, Woodinville WA",
  "colors": "dusty sage and cream",
  "bridesmaid_dress": "Lulu & Fern style 4412, color Dusty Sage, any length",
  "hotel_block": "Woodinville Inn, code MAYAJORDAN, book by May 1",
  "schedule": [
    "Rehearsal dinner: Friday 6pm at the farm",
    "Hair & makeup: Saturday 9am in the bridal suite",
    "Photos: Saturday 2:30pm",
    "Ceremony: Saturday 4pm"
  ],
  "faq": {
    "shoes": "nude or gold, any heel",
    "dress_deadline": "order by Nov 15 for alterations"
  }
}'::jsonb);

insert into people (id, name, role, title, venmo) values
  ('maya',   'Maya',   'couple',   'Bride',         null),
  ('jordan', 'Jordan', 'couple',   'Groom',         null),
  ('priya',  'Priya',  'delegate', 'Maid of Honor', 'priya-demo'),
  ('sarah',  'Sarah',  'member',   'Bridesmaid',    null),
  ('jess',   'Jess',   'member',   'Bridesmaid',    null),
  ('leah',   'Leah',   'member',   'Bridesmaid',    null);

insert into areas (id, name, owner_id, is_surprise) values
  ('attire',       'Dresses & Attire', 'priya', false),
  ('bachelorette', 'Bachelorette',     'priya', true),
  ('dayof',        'Day-of',           'maya',  false);

insert into tasks (area_id, assignee_id, created_by, title, amount, status, status_note) values
  ('attire',       'jess',  'priya', 'Send shoe size',           null, 'done',        null),
  ('dayof',        'leah',  'maya',  'Book room in hotel block', null, 'in_progress', 'booking this weekend'),
  ('bachelorette', 'sarah', 'priya', 'Pay bachelorette share',   85,   'todo',        null),
  ('bachelorette', 'priya', 'priya', 'Book bachelorette Airbnb', null, 'done',        null);
