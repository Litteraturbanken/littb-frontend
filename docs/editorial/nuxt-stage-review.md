# Litteraturbanken på ny grund

## Ett underlag för redaktionell granskning på Stage

Det här är i första hand samma Litteraturbanken, flyttad från en åldrande
teknisk grund till en som går att underhålla och utveckla vidare. Målet har
inte varit att formge om webbplatsen eller förändra dess redaktionella
identitet. Målet har varit att bevara innehåll, adresser och arbetssätt, men
minska risken när vi rättar fel, tillgänglighetsanpassar och bygger nya
funktioner.

Stage är därför inte bara en teknisk provmiljö. Den redaktionella granskningen
är den sista kontrollen av att porteringen faktiskt har bevarat rätt saker.

---

## 1. Varför den gamla webbplatsen behövde ersättas

Den gamla frontendapplikationen har tjänat Litteraturbanken länge och gjort ett
stort och varierat material tillgängligt: bibliotek, textsökning,
författarsidor, e-text, faksimil, presentationer och redaktörsläsare. Problemet
är inte det arbetet, utan den tekniska grund som det med tiden har blivit
beroende av.

Webbplatsen bygger på AngularJS 1.7.9. Det officiella stödet för AngularJS
[upphörde i januari 2022](https://docs.angularjs.org/misc/version-support-status).
I vår egen kartläggning hade den gamla frontendkoden 55 uttryckliga
ruttmönster, omkring 37 former av API-anrop, stora styrande kodfiler, mycket
globalt webbläsartillstånd och handskrivna beskrivningar av backenddata. Det
gör sambanden svåra att överblicka: en liten ändring på ett ställe kan påverka
historik, sökning eller läsning på ett annat.

Det finns ingen dokumenterad säkerhetsincident bakom beslutet. Skälet är mer
vardagligt och mer långsiktigt: ett centralt redaktionellt verktyg bör inte
vila på ett ramverk som inte längre underhålls, och varje år av väntan gör en
framtida förändring dyrare och mer riskfylld.

---

## 2. Vad bytet ska ge redaktionen och läsarna

Den nya grunden ska framför allt ge kontinuitet:

- redaktionellt innehåll, länkar och invanda arbetsflöden ska fortsätta
  fungera;
- fel ska kunna avgränsas och rättas utan att hela webbplatsen behöver förstås
  på en gång;
- tangentbordsnavigering, fokus, dialogrutor och formulär ska kunna förbättras
  systematiskt;
- innehåll ska finnas i den HTML som servern levererar, inte bara uppstå efter
  att webbläsaren har kört all JavaScript;
- frontend och backend ska upptäcka datamissförstånd före en release;
- vi ska se fel, laddningsproblem och hydreringsfel i övervakningen när ny kod
  tas i bruk.

Det betyder lägre risk vid löpande underhåll, men också kortare väg från ett
redaktionellt behov till en hållbar funktion. Den nya ordslagningen i läsaren,
med aktuella SO- och SAOB-resultat från svenska.se, är ett konkret exempel: den
kan använda den ordboksvisning och data som redan underhålls av rätt produkt,
i stället för att skapa ännu en kopia i Litteraturbanken.

---

## 3. Varför just Nuxt och Vue

Nuxt valdes inte för att göra en modernare yta, utan för att ge webbplatsen en
tydligare struktur och hybridrendering: samma applikation kan leverera
meningsfullt innehåll från servern och sedan ta över smidig navigering i
webbläsaren. Vue och Nuxt gav dessutom ett arbetssätt och konventioner som
organisationen redan hade erfarenhet av.

Porteringen har byggts som en fristående ersättare. AngularJS och Nuxt har inte
blandats i samma körande applikation. Den gamla webbplatsen har i stället varit
referens för ordalydelse, utseende, URL:er, responsivitet och beteende. Det gör
gränsen tydlig och ger oss en enkel återgångsväg fram till produktionsbytet.

---

## 4. Varför Tailwind UI och Headless UI

Namnen kan låta som ett nytt designsystem, men de används mer återhållsamt än
så.

**Tailwind UI** är här en källa till beprövade mönster för markup och
komponentstruktur. Det är inte ett uppdrag att ge Litteraturbanken ett nytt
utseende. Webbplatsens befintliga typografi, färger, bilder, avstånd och
redaktionella ton är fortsatt styrande.

**Headless UI** tar hand om svåra interaktionsdetaljer i bland annat
dialogrutor och listval: tangentbord, fokus, Escape och programmässiga namn.
Komponenterna har inget påtvingat utseende, så de kan bära Litteraturbankens
befintliga form. I den nya koden används de endast där en verklig interaktion
behöver dem; vanliga länkar och formulär förblir vanliga länkar och formulär.

Det redaktionella värdet är att vi kan bevara formen utan att samtidigt
bevara gamla, egenbyggda lösningar för tillgänglighet.

---

## 5. Tydligare backendtyper och genererade kontrakt

Den gamla frontendkoden behövde ofta själv känna till glesa och skiftande svar
från äldre sök- och innehållstjänster. I den nya arkitekturen översätter
backend dessa svar till tydliga modeller: exempelvis vad som är en författare,
en titel, en representation, en sida eller ett fel.

Backend publicerar därefter ett maskinläsbart OpenAPI-kontrakt. Frontendens
TypeScript-beskrivningar genereras från detta kontrakt i stället för att
skrivas en gång till för hand. Om backend byter namn på ett fält, gör ett
värde obligatoriskt eller lägger till ett nytt alternativ kan kontrollerna
upptäcka att frontend inte längre stämmer.

För redaktionen betyder det färre tysta fel av typen "sidan laddar men en lista
är tom" och en tydligare plats att rätta problem på. Det betyder inte att
systemet blir ofelbart; därför finns fortfarande tester, Stage-granskning och
övervakning som separata skydd.

---

## 6. Vad som är port — och vad som faktiskt har ändrats

### Medvetet bevarat

- webbplatsens redaktionella innehåll, huvudsakliga informationsarkitektur och
  etablerade URL:er;
- utseende, typografi, bakgrundsbilder och responsiv karaktär;
- bibliotekets vyer, filter och nedladdningar;
- sökning, författarsidor, e-text, faksimil, presentationer och
  redaktörsläsare;
- webbläsarhistorik och direktlänkar där det gamla beteendet är en del av
  användarnas arbetsflöde.

### Medvetet förändrat

- sidorna kan renderas på servern och fortsätta som Nuxt-navigering i
  webbläsaren;
- frontendens data kommer i större utsträckning genom tydliga backendmodeller
  och genererade kontrakt;
- semantik, synligt tangentbordsfokus och fokusbeteende har rättats där det
  gamla beteendet var otillgängligt eller tvetydigt;
- klientfel och hydreringsproblem kan rapporteras till vår övervakning;
- läsarens ordslagning mot aktuell SO och SAOB är ny funktionalitet och ska
  bedömas som en ny produktfunktion, inte mot en gammal visuell förlaga.

Buggrättningar som uppstått under porteringen — till exempel bakgrundsbyten vid
klientnavigering och typsnittsbeteende — är avsiktliga rättningar, inte en
allmän omformgivning. Om en skillnad inte ryms i någon av kategorierna ovan ska
den rapporteras, inte antas vara avsiktlig.

---

## 7. Vad redaktionen behöver granska på Stage

Använd [stage.litteraturbanken.se](https://stage.litteraturbanken.se/) som en
vanlig webbplats: följ länkar, använd Bakåt och Framåt och prova både bred och
smal skärm. Prioritera följande sammanhängande flöden.

1. **Startsida och global navigering**  
   Kontrollera rubriker, ingresser, bildval, externa projektlänkar,
   snabbsökning och språk-/Om-sidor.

2. **Bibliotek och EPUB**  
   Prova [/bibliotek](https://stage.litteraturbanken.se/bibliotek) och
   [/epub?visa=epub&sort=popularitet](https://stage.litteraturbanken.se/epub?visa=epub&sort=popularitet).
   Växla vyer och filter, öppna titlar, prova nedladdningar och kontrollera att
   sidorna har sina respektive bakgrundsbilder även när man klickar mellan dem
   utan omladdning.

3. **Textsökning**  
   Sök exempelvis på
   [/sök?fras=kyrka](https://stage.litteraturbanken.se/s%C3%B6k?fras=kyrka).
   Kontrollera träffar, filter, sidbyte, träffmarkering och återgång från en
   öppnad titel.

4. **Författare och verk**  
   Granska exempelvis
   [Strindbergs titlar](https://stage.litteraturbanken.se/f%C3%B6rfattare/StrindbergA/titlar).
   Kontrollera namn, porträtt, biografiskt material, titelgruppering,
   dokumentlänkar och att direktlänkar kan laddas om.

5. **Läsaren**  
   Öppna [Doktor Glas som
   e-text](https://stage.litteraturbanken.se/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/1/etext)
   och ett [faksimilprov](https://stage.litteraturbanken.se/f%C3%B6rfattare/BoyeK/titlar/EttVerkligtJordiskt/sida/3/faksimil).
   Prova sidbyte, innehållsförteckning, Om boken, zoomning, OCR/träffläge och
   tangentbord. Markera ett ord och prova den nya SO-/SAOB-uppslagningen;
   kontrollera både ett modernt och ett äldre ord samt stängning och
   återställd fokuspunkt.

6. **Redaktörsläsaren och specialmaterial**  
   Prova en känd redaktörslänk, till exempel
   [/editor/lb11625223/ix/2/f](https://stage.litteraturbanken.se/editor/lb11625223/ix/2/f),
   samt de presentationer, Dramawebben- och SLA-sidor som ni själva arbetar
   med. Specialistmaterial är särskilt viktigt eftersom automatiken inte kan
   avgöra om en redaktionell detalj är fel.

7. **Tillgänglighet och typografi**  
   Gå genom viktiga flöden med Tab, Shift+Tab, Enter och Escape. Kontrollera att
   fokus syns och återvänder rimligt efter dialoger. Jämför Requiem-typsnittets
   kerning i Safari, Chrome och Firefox och rapportera texter där radfall,
   tecken eller ersättningstypsnitt ser fel ut.

### Innan granskningsmötet

Den exakta kandidat som granskas ska alltid identifieras via
[`/_deployment`](https://stage.litteraturbanken.se/_deployment). Vid
evidensinsamlingen den 24 augusti 2026 svarade startsida, bibliotek och läsare
med HTTP 200, och endpointen angav Git-revision
`f3a23269967ff8cdab500f1a7b1209dd3abc8fca` samt bild-digest
`sha256:a48e63b8723e7511299302b91b20c94ccc3c4ffd1568bd9a5ab51c038f1260a4`.
En senare lokal ändring (`9248714c`) pekar Stage mot svenska.se:s staged
Reader-embed och ingick ännu inte i den fingerprinten. Ordboksflödet ska
därför inte godkännas förrän `/_deployment` visar den nya kandidaten och
uppslaget fungerar i den faktiskt inbäddade vyn.

---

## 8. Vilken återkoppling behövs före produktionssättning

Vi behöver framför allt redaktionella iakttagelser, inte tekniska diagnoser.
Rapportera:

- fel, saknad eller föråldrad text och metadata;
- fel ordning, gruppering eller antal i listor och sökresultat;
- länkar, Bakåt/Framåt, filter eller direktadresser som inte bevarar
  sammanhanget;
- oväntade visuella skillnader, vit bakgrund, fel bild, typsnitt, radfall eller
  mobil layout;
- något som inte går att nå eller förstå med tangentbord;
- laddningsfel, tomma ytor, flimrande innehåll eller fel som bara syns efter
  klicknavigering;
- om den nya SO-/SAOB-funktionen ger fel ordbok, fel uppslagsord eller ett
  otydligt tom-/felläge.

För varje rapport: ange exakt URL, webbläsare och enhet/fönsterstorlek, vad ni
gjorde, vad ni väntade er och vad som hände. Bifoga gärna en skärmbild. Märk
också om felet stoppar arbetet eller kan rättas efter lansering.

Produktionssättning bör ske först när redaktionen har granskat en och samma
identifierade Stage-kandidat, inga blockerande skillnader återstår och den
tekniska övervakningen visar att kandidaten är stabil. Samma byggartefakt som
granskats på Stage ska då flyttas vidare; den ska inte byggas om på vägen.

---

## Kort walkthrough, 12–15 minuter

1. **Utgångspunkten, 2 min**  
   Erkänn vad AngularJS-webbplatsen har åstadkommit. Förklara att stödet tog
   slut 2022 och att syftet är kontinuitet, inte ett designsprång.

2. **Vad som bytts under ytan, 3 min**  
   Visa startsidan och en författarsida. Förklara Nuxt/hybridrendering och det
   genererade frontend–backend-kontraktet med vardagliga ord.

3. **Vad som bevarats, 3 min**  
   Gå via Biblioteket till en titel och Läsaren. Peka ut samma adresser,
   innehåll, typografi och arbetsflöden. Visa Bakåt/Framåt.

4. **Vad som förbättrats eller tillkommit, 3 min**  
   Tabba genom en dialog och visa synligt fokus. Slå upp ett ord och växla
   mellan SO och SAOB. Nämn att detta är ny funktion, inte legacyparitet.

5. **Redaktionens beslut, 2–4 min**  
   Visa `/_deployment`, bekräfta kandidatens identitet och gå igenom
   granskningslistan. Kom överens om kanal, sista svarsdag och vilka fynd som
   blockerar produktionssättning.

---

## Evidens för underlaget

Detta underlag bygger på den beslutade grundarkitekturen och repositoryts
genomförda migration, särskilt:

- `docs/superpowers/specs/2026-07-15-nuxt-v2-statistics-foundation-design.md`
  (ursprungligt scope, 55 rutter, API-problem, Nuxt, Tailwind UI, Headless UI,
  FastAPI v2 och genererad TypeScript);
- `docs/superpowers/specs/2026-07-27-end-to-end-contract-quality-design.md`
  och `docs/quality.md` (kontraktsägarskap och releasekontroller);
- `docs/superpowers/specs/2026-07-29-nuxt-lighthouse-100-design.md` samt
  tangentbords-/fokusarbetet från augusti (hybridleverans, semantik,
  tillgänglighet och resursgränser);
- `docs/superpowers/specs/2026-08-08-nuxt-maintainability-analysis-design.md`
  (underhållbarhetskontroller och hantering av befintlig migrationsskuld);
- `docs/superpowers/2026-08-19-production-readiness-audit.md` och Stage-jobbet
  `jobs/lb-frontend-stage.nomad` (kvalitetslager, artefaktidentitet,
  återgångsskydd och redaktionellt godkännande);
- `docs/superpowers/specs/2026-08-23-reader-svenska-dictionary-embed-design.md`
  samt implementationerna `a1236631` och `c30dc64e` (aktuell SO/SAOB och
  integritetssnål användningsövervakning);
- migrationshistoriken från den första fristående Nuxt-grunden `fd30ec8a`, den
  genererade klienten `88c1bf3b`, den första SSR-sidan `07eaccce` och den
  första visuella paritetskontrollen `e38ab664`.

Mätvärden har avsiktligt inte lagts till där projektet saknar jämförbar
före-/efterdata. Testantal eller ett enstaka Lighthousevärde används inte som
ersättning för redaktionell bedömning.
