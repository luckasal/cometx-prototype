-- English seed for the seven events published on 2026-10-26.
-- Production was backfilled through guarded SQL Editor updates with equivalent
-- English copy; existing EN fields are preserved when this file is run.
-- Only fill empty EN fields on records whose source title/name is unchanged.
with translations(slug, source_title, title_en, short_description_en, description_en, venue_en, address_en) as (values
  ('jak-resit-konflikty-s-toxickymi-osobnostmi', 'Jak řešit konflikty s toxickými osobnostmi', 'How to Handle Conflict with Toxic Personalities',
   'A practical workshop for situations where someone shouts, attacks or tries to dominate. Learn to stay calm, keep your dignity and set a firm boundary without unnecessary harshness.',
   $copy$The biggest mistake when dealing with a difficult person is to start playing their game.

Some people do not come to negotiate. They come to overpower, blame, humiliate or seize control. Shouting, reproaches, dramatic behaviour, threats, a condescending tone or public challenges can make ordinary politeness break down. People then react impulsively: they become defensive, counterattack or apologize when they do not need to.

This workshop gives participants a clear framework for dealing with someone who is aggressive, confrontational or deliberately difficult. It relies on calm, structure and clear boundaries instead of force. The workshop is conducted in Czech/Slovak and tailored to Czechs and Slovaks in Switzerland who often navigate difficult conversations in another language and culture.

## What you will learn
- How to speak with someone who shouts, attacks or tries to dominate.
- How to avoid becoming defensive, counterattacking or apologizing unnecessarily.
- How to work with the other person's sense of status, respect and control.
- How to keep an attack from setting the tone of the whole conversation.
- How to set a boundary without unnecessary harshness.
- How to protect the dignity of a doctor, teacher, civil servant, ticket inspector, shop assistant, flight attendant or receptionist.

## What to expect
Participants receive an intensive introduction to difficult personalities in negotiations, including common behaviour patterns and a clear framework for what to do and avoid. The workshop combines recognizing behaviour and choosing precise words with practice in realistic situations involving shouting, reproaches, threats, challenges and public attacks.

## Who it is for
Anyone whose work or dealings with institutions bring them into contact with emotionally demanding or confrontational people, including healthcare, education, public administration and customer service.

The workshop is organized by CometX, a platform connecting Czechs and Slovaks living in Switzerland, and is intended for members and friends of this community.$copy$,
   'Zurich – exact location to be confirmed', null),
  ('co-ai-nevyresi', 'Co AI nevyřeší', 'What AI Cannot Solve',
   'If everyone has access to equally powerful AI, what will make one person succeed while another does not? A workshop on skills AI cannot replace and that are becoming more valuable than ever.',
   $copy$If everyone has access to equally powerful AI, what will make one person more successful than another? What will matter more in a world where information, knowledge and, to some extent, intelligence are readily available?

AI is extraordinarily powerful once we know the question. People need to be strong at what comes before that: understanding which question is the right one. Even an excellent answer will not help if we are solving the wrong problem.

## What you will learn
The workshop follows five steps that AI cannot take for us:

- Understand – find the real problem, separate symptoms from causes and question the original brief.
- Choose – decide what truly matters, say no when necessary and focus your attention.
- Decide – act without complete information, accept risk and take responsibility for the consequences.
- Lead – earn others' trust, have difficult conversations and work through conflict.
- Take responsibility – turn an intention into a result: start, persist and finish.

AI can propose a strategy, calculate probabilities, prepare arguments and generate twenty possible solutions. It cannot choose the right one for us, persuade the person across the table or take responsibility for the outcome.

## What to expect
The workshop includes a practical self-assessment. Participants will examine both the abilities AI now makes available to everyone and the human abilities that become more valuable because of it. Bring a real work problem you have been facing for months to discover what is actually holding you back.

## Who it is for
Managers, team leaders, entrepreneurs and specialists who want to understand where their personal advantage will lie when knowledge is no longer scarce.

The workshop is organized by CometX, a platform connecting Czechs and Slovaks living in Switzerland, and is intended for members and friends of this community.$copy$,
   'Zurich – exact location to be confirmed', null),
  ('new-demo-event', 'New Demo Event', 'New Demo Event', 'demo description', 'Long demo description', 'tbd', 'tbd'),
  ('networking-evening-geneva', 'Networking Evening Geneva', 'Networking Evening Geneva', 'Connect with professionals in French-speaking Switzerland.', 'Stakeholder demo event. A relaxed evening of introductions and conversation.', 'Geneva', null),
  ('emocni-regulace-v-kazdodenni-praxi', 'Emoční regulace v každodenní praxi', 'Emotional Regulation in Everyday Life',
   'Do you sometimes feel that you neglect yourself and put your own needs second, third or last? Join us to explore this and other aspects of emotional regulation.',
   $copy$Have you ever felt that you have been neglecting yourself, putting your own needs second, third or even last? Perhaps you have faced uncertainty for weeks, months or years and feel disconnected from yourself. Your emotions may swing back and forth. Online, there is plenty of advice about caring for ourselves and handling emotions. But how do we put it into practice? Why is it so difficult? Searching for more advice can itself become overwhelming.

Even when we want to change something, we may end up doing very little. Then come self-reproach, guilt and a loss of motivation. Does that sound familiar?

## What to expect
Together, we will explore practical ways to find balance in a world full of uncertainty, fear and other emotions. We will connect theory with practice and learn how to work with ourselves in a way that is effective and sustainable over time.

Let us make time to care for ourselves.

## Practical information
The workshop takes place at Altstadthaus Quartiertreff, Obmannamtsgasse 15, 8001 Zurich, Switzerland.

The speaker's book: Nekašli na sebe: Tvůj parťák na cestě s emocemi.$copy$,
   'Altstadthaus Quartiertreff', 'Obmannamtsgasse 15, 8001 Zürich, Switzerland'),
  ('beer-potlach-zurich', 'Beer POTLA.CH Zurich', 'Beer POTLA.CH Zurich', 'An informal evening with the community.', 'Stakeholder demo event. Meet fellow Czech and Slovak professionals in Switzerland.', 'Zurich', null),
  ('annual-symposium-2026', '6th Slovak and Czech Annual Symposium 2026', '6th Slovak and Czech Annual Symposium 2026', 'The largest networking event for Czech and Slovak professionals in Switzerland.', 'The completed 2026 edition brought talks, panel discussions, workshops and an evening apero to UZH Irchel Campus in Zurich.', 'UZH Zürich, Irchel Campus', 'Winterthurerstrasse 190, 8057 Zürich, Switzerland')
)
update public.events e set
  title_en = coalesce(nullif(e.title_en, ''), t.title_en),
  short_description_en = coalesce(nullif(e.short_description_en, ''), t.short_description_en),
  description_en = coalesce(nullif(e.description_en, ''), t.description_en),
  venue_en = coalesce(nullif(e.venue_en, ''), t.venue_en),
  address_en = coalesce(nullif(e.address_en, ''), t.address_en)
from translations t
where e.slug = t.slug and e.title = t.source_title and e.publish_state = 'published';

with translations(id, source_name, name_en) as (values
  ('b5640252-30a9-448a-87fb-b6c4ae4e93a2'::uuid, 'Regular Vstupenka', 'Regular ticket'),
  ('04da4b42-407f-4b30-b5f3-7371a607f291'::uuid, 'Early Bird Vstupenka', 'Early bird ticket'),
  ('057fa726-67ec-4b2d-a702-5a37c4060afa'::uuid, 'Regular Vstupenka', 'Regular ticket'),
  ('26ddb0bc-fe2f-40a9-99c2-3fc8475b232e'::uuid, 'demo', 'demo'),
  ('f85f7655-3d87-4f2d-ad79-2a0c86e98ba5'::uuid, 'Standard ticket', 'Standard ticket'),
  ('6130f656-d5d1-4f8e-b815-00a6591953fb'::uuid, 'Vstupenka na workshop', 'Workshop ticket'),
  ('1c820e0b-a9cf-4a38-a781-95fa94c24487'::uuid, 'Standard ticket', 'Standard ticket'),
  ('1e614fe9-5034-446c-80b5-3f551e125d84'::uuid, 'Standard ticket', 'Standard ticket')
)
update public.ticket_types t set name_en = coalesce(nullif(t.name_en, ''), v.name_en)
from translations v where t.id = v.id and t.name = v.source_name;

with translations(id, source_name, job_title_en, bio_en) as (values
  ('1dcd2687-6ef2-4c4f-ac70-4f01432a4d3b'::uuid, 'Radim Pařík', 'Negotiator and founder',
   $bio$Radim Pařík is the founder of Fascinating Academy and one of the most experienced negotiators in the Czech Republic. He studied negotiation at Harvard Business School and has helped thousands of managers and leaders reach agreements, some worth billions of euros. More than 5,000 clients have attended his academy.

His work combines techniques used by FBI negotiators, Harvard negotiation frameworks, IMD approaches and Joe Navarro's methods of detecting deception. He believes that negotiation and conflict management begin long before people sit down at the table: with attention to detail, timing and the ability to stay composed when the other side applies pressure, shouts or tries to take control.

In this workshop, he teaches participants how to stay calm and hold their ground in everyday encounters with aggressive or toxic personalities.$bio$),
  ('79d0d81d-f168-4c97-aa8d-f43588e61ac5'::uuid, 'Dana Bérová', 'Investor, mentor, coach and adviser',
   $bio$Dana Bérová is a prominent figure in Czech business. She served as Minister of Informatics in Jiří Paroubek's government. After leaving politics, she became an investor in technology startups and now mentors, coaches and advises companies and their leaders, including through the ScaleUp methodology.

She works with startups such as Talentpilot, which helps improve team performance and alignment, and KardiAI, which uses AI to diagnose cardiac activity. She has long focused on diversity in business and the opportunities AI creates for women and companies. Forbes included her among the Most Influential Women in the Czech Republic in 2024 and 2025.

In the workshop, she draws on her experience as an investor who has spent years assessing not just ideas but the people behind them, and on her view of what determines success when technical knowledge is no longer a competitive advantage.$bio$),
  ('ed3e8940-bd51-46c9-bcda-1964e305a5ae'::uuid, 'Tereza Hrušková', 'Psychologist, lecturer and CBT psychotherapist',
   $bio$Tereza Hrušková is a psychologist, lecturer and cognitive behavioural psychotherapist. She lives in Zurich, where she has a psychology practice.

She founded KPsychologovi, a project that helps people find their way to a psychologist or psychotherapist. Through her daily #nekaslinasebe tips, she highlights the value of ongoing self-care. She teaches about emotions and emotional regulation and works to reduce the stigma around seeing a psychologist, including through research in her doctoral studies. Her aim is to explain clearly that mental health matters as much as physical health and that it is okay to experience emotions.

She is the author of the bestseller Nekašli na sebe: Tvůj parťák na cestě s emocemi. She also shares #nekaslinasebe tips through the Aepsy platform. Photos on the original page: Pavla Melenová and Lucie Bašniarová.$bio$)
)
update public.speakers s set
  job_title_en = coalesce(nullif(s.job_title_en, ''), v.job_title_en),
  bio_en = coalesce(nullif(s.bio_en, ''), v.bio_en)
from translations v where s.id = v.id and s.name = v.source_name;
