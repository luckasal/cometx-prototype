-- Optional contact profile fields requested in CNT-02.
ALTER TABLE public.contacts
  ADD COLUMN linkedin_url text,
  ADD COLUMN birth_year integer;

ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_linkedin_url_format_check
    CHECK (
      linkedin_url IS NULL
      OR linkedin_url ~* '^https://([a-z0-9-]+\.)*linkedin\.com(/|$)'
    ),
  ADD CONSTRAINT contacts_birth_year_range_check
    CHECK (birth_year IS NULL OR birth_year BETWEEN 1900 AND 2100);
