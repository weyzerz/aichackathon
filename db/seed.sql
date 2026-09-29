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

insert into areas (id, name, owner_id, is_surprise, date_label, location, description, details) values
  ('bachelorette', 'Bachelorette Weekend', 'priya', false, 'May 14–16, 2027', 'Scottsdale, AZ',
   'Maya''s Last Rodeo: a desert weekend with the girls.',
   '{"Theme": "Last Rodeo — cowboy hats required", "Arrive": "Friday by 4pm (PHX)", "Stay": "Airbnb in Old Town Scottsdale (Priya booking)", "Cost": "$85 per person share, Venmo Priya", "Saturday": "Pool day, then line dancing at Handlebar J"}'::jsonb),
  ('attire', 'Dress Fittings', 'priya', false, 'By Nov 15, 2026', 'Lulu & Fern, online',
   'Everyone orders the same dress so there''s time for alterations.',
   '{"Dress": "Lulu & Fern style 4412", "Color": "Dusty Sage, any length", "Shoes": "Nude or gold, any heel"}'::jsonb),
  ('dayof', 'Wedding Day', 'maya', false, 'June 12, 2027', 'Cedar Hollow Farm, Woodinville WA',
   'The big day.',
   '{"Hair & makeup": "Saturday 9am, bridal suite", "Photos": "2:30pm", "Ceremony": "4pm", "Hotel": "Woodinville Inn, code MAYAJORDAN, book by May 1"}'::jsonb);

-- Deadlines are relative to today so the demo always looks current. Kept small for a 2-minute demo.
insert into tasks (area_id, assignee_id, created_by, title, details, amount, status, status_note, response, is_secret, due_date) values
  ('dayof',        'leah',  'maya',  'Book room in hotel block', null, null, 'in_progress', 'booking this weekend', null, false, current_date + 16),
  ('bachelorette', 'priya', 'priya', 'Book the Airbnb',       'Old Town Scottsdale, sleeps 5, Fri–Sun', null, 'in_progress', 'shortlisted 2 places', null, false, current_date + 7),
  ('bachelorette', 'sarah', 'priya', 'Grocery run',           'Snacks, breakfast stuff and drinks for Fri night; save receipts', null, 'todo', null, null, false, current_date + 30),
  ('bachelorette', 'jess',  'priya', 'Book the rental cars',  'Two cars from PHX, Fri 3pm to Sun noon, room for 5 + luggage', null, 'done', 'booked 2 SUVs, Enterprise', null, false, current_date + 10),
  ('bachelorette', 'sarah', 'priya', 'Pay bachelorette share', null, 85, 'todo', null, null, false, current_date + 20),
  ('bachelorette', 'priya', 'priya', 'Send flight info', 'Airline, flight number, arrival time into PHX', null, 'done', null, 'Alaska 612 — lands PHX Fri 1:40pm', false, current_date + 5),
  ('bachelorette', 'jess',  'priya', 'Send flight info', 'Airline, flight number, arrival time into PHX', null, 'done', null, 'Delta 1188 — lands PHX Fri 3:05pm', false, current_date + 5),
  ('bachelorette', 'sarah', 'priya', 'Send flight info', 'Airline, flight number, arrival time into PHX', null, 'todo', null, null, false, current_date + 5),
  ('bachelorette', 'leah',  'priya', 'Send flight info', 'Airline, flight number, arrival time into PHX', null, 'todo', null, null, false, current_date + 5),
  ('bachelorette', 'sarah', 'priya', '🤫 Bring a cowboy hat & prep a hobby horse routine', 'Secret from Maya! Bring a cowboy hat and prepare a 30-second hobby horse routine to perform for the bride Saturday night.', null, 'todo', null, null, true, current_date + 30),
  ('bachelorette', 'jess',  'priya', '🤫 Bring a cowboy hat & prep a hobby horse routine', 'Secret from Maya! Bring a cowboy hat and prepare a 30-second hobby horse routine to perform for the bride Saturday night.', null, 'todo', null, null, true, current_date + 30),
  ('bachelorette', 'leah',  'priya', '🤫 Bring a cowboy hat & prep a hobby horse routine', 'Secret from Maya! Bring a cowboy hat and prepare a 30-second hobby horse routine to perform for the bride Saturday night.', null, 'todo', null, null, true, current_date + 30);

-- The coordinator already asked Sarah and Leah for their flights.
insert into messages (thread_person_id, sender, task_id, body)
select assignee_id, 'agent', id,
       'Hi ' || initcap(assignee_id) || '! Priya is planning pickups for the bachelorette weekend. Could you send your flight info (airline, flight number, arrival time into PHX)?'
from tasks where title = 'Send flight info' and status = 'todo';
