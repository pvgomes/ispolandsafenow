-- Idempotent seed of the 16 Polish voivodeships. Safe to re-run: existing
-- rows are left untouched so real classifications are never overwritten.
INSERT OR IGNORE INTO regions (code, slug, name_pl, name_en) VALUES
  ('PL-02', 'dolnoslaskie',          'Dolnośląskie',           'Dolnoslaskie (Lower Silesia)'),
  ('PL-04', 'kujawsko-pomorskie',    'Kujawsko-Pomorskie',     'Kujawsko-Pomorskie'),
  ('PL-06', 'lubelskie',             'Lubelskie',              'Lubelskie'),
  ('PL-08', 'lubuskie',              'Lubuskie',               'Lubuskie'),
  ('PL-10', 'lodzkie',               'Łódzkie',                'Lodzkie'),
  ('PL-12', 'malopolskie',           'Małopolskie',            'Malopolskie (Lesser Poland)'),
  ('PL-14', 'mazowieckie',           'Mazowieckie',            'Mazowieckie (Masovia)'),
  ('PL-16', 'opolskie',              'Opolskie',               'Opolskie'),
  ('PL-18', 'podkarpackie',          'Podkarpackie',           'Podkarpackie'),
  ('PL-20', 'podlaskie',             'Podlaskie',              'Podlaskie'),
  ('PL-22', 'pomorskie',             'Pomorskie',              'Pomorskie (Pomerania)'),
  ('PL-24', 'slaskie',               'Śląskie',                'Slaskie (Silesia)'),
  ('PL-26', 'swietokrzyskie',        'Świętokrzyskie',         'Swietokrzyskie'),
  ('PL-28', 'warminsko-mazurskie',   'Warmińsko-Mazurskie',    'Warminsko-Mazurskie'),
  ('PL-30', 'wielkopolskie',         'Wielkopolskie',          'Wielkopolskie (Greater Poland)'),
  ('PL-32', 'zachodniopomorskie',    'Zachodniopomorskie',     'Zachodniopomorskie');
