// Portraits mapped to named cards on https://www.cometx.ch/about-us (2026-09-23).
const portraits: Record<string, [string, string]> = {
  "Adam Pruška": ["012f3c1d16cc462ea6028f73cc4a2142~mv2.jpg", "x_74,y_0,w_1132,h_1249"],
  "Júlia Šťastná": ["e6cd791a50c840b48d67ef3fff14a1f9~mv2.jpg", "x_0,y_0,w_769,h_880"],
  "Lucie Piecková": ["253decbb51d24711abe043fc150a2523~mv2.jpg", "x_692,y_1046,w_1431,h_1954"],
  "Gleb Kopylov": ["48f6eaab800c4ff798544d5d554cbfa8~mv2.jpeg", "x_110,y_0,w_581,h_800"],
  "Peter Molnár": ["22549b42cf644c04a5115808100c9c3e~mv2.png", "x_32,y_0,w_867,h_970"],
  "Jan Mastný": ["4a0c19447d9b49be8977209e512e0fd0~mv2.jpg", "x_0,y_182,w_577,h_661"],
  "Aleš Holfeld": ["03fb0174ee7e428c9d7c68a656cc9c24~mv2.jpg", "x_72,y_0,w_1135,h_1271"],
  "Helena Šmejkalová": ["d519f50706634a36bde5b25edd55c933~mv2.png", "x_380,y_177,w_677,h_925"],
  "Jana Valnohová": ["8e20ccd4da5c46f190e59c8114de1d88~mv2.jpg", "x_838,y_0,w_3047,h_4161"],
  "Michal Juríček": ["9b1778cc60ad41449629a36b313a3433~mv2.jpg", "x_54,y_0,w_293,h_400"],
  "Míša Dohnálková": ["0bf85dc43a5e413ba3ce68b84ebeecf7~mv2.jpg", "x_35,y_0,w_591,h_662"],
  "Dana Müller": ["ae986ddb6c7845d89a9447774195aff8~mv2.jpg", "x_193,y_0,w_1054,h_1440"],
  "Natálie Lokvencová": ["3159ef8e371c4565aa66269a2361a6e9~mv2.jpg", "x_87,y_0,w_2445,h_3366"],
  "Tomáš Polák": ["0faaf13e2bb2420cb086bca77ff58680~mv2.jpg", "x_349,y_909,w_696,h_951"],
  "Adam Majcher": ["1d47a41900364cafad489bd154e17dd1~mv2.jpg", "x_299,y_858,w_3100,h_3940"],
};
export function teamPhoto(name: string | undefined) {
  const photo = name ? portraits[name] : undefined;
  return photo ? `https://static.wixstatic.com/media/41f758_${photo[0]}/v1/crop/${photo[1]}/fill/w_400,h_550,al_c,q_85/portrait.webp` : undefined;
}
