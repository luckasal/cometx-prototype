-- Fill only missing English text for the three active membership plans.
update public.membership_plans set name_en = coalesce(nullif(name_en, ''), 'Supporter'), description_en = coalesce(nullif(description_en, ''), 'Enjoy online content and the largest networking event for Czechs and Slovaks in Switzerland.')
where slug = 'fanousek' and name = 'Fanoušek';

update public.membership_plans set name_en = coalesce(nullif(name_en, ''), 'CometXXL'), description_en = coalesce(nullif(description_en, ''), 'A complete taste of everything we create. With CometXXL, you will be part of the most important moments.')
where slug = 'cometxxl' and name = 'CometXXL';

update public.membership_plans set name_en = coalesce(nullif(name_en, ''), 'Ambassador'), description_en = coalesce(nullif(description_en, ''), 'As an ambassador, you can spread the idea that networking helps and take part in everything CometX does.')
where slug = 'ambasador' and name = 'Ambasador';
