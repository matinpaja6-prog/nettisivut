"""Evidence-backed local Maskines review. Run with the bundled Python runtime."""
from pathlib import Path
import json
import statistics
from xml.sax.saxutils import escape

from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph, Table, TableStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/pdf/Maskines_kokonaisarvio_2026-09-03.pdf'
IMAGES = ROOT / 'output/site-audit-2026-09-03'
HOME = json.loads((ROOT / 'output/performance/final-audit-home.json').read_text('utf-8'))
COLLECTION = json.loads((ROOT / 'output/performance/final-audit-collection.json').read_text('utf-8'))
OUT.parent.mkdir(parents=True, exist_ok=True)
for name, file in [('Segoe', 'segoeui.ttf'), ('Segoe-Bold', 'segoeuib.ttf'), ('Segoe-Italic', 'segoeuii.ttf')]:
    pdfmetrics.registerFont(TTFont(name, str(Path('C:/Windows/Fonts') / file)))
pdfmetrics.registerFontFamily('Segoe', normal='Segoe', bold='Segoe-Bold', italic='Segoe-Italic', boldItalic='Segoe-Bold')

W, H = A4
M, CW = 44, A4[0] - 88
INK, MUTED, ORANGE, LINE = [colors.HexColor(c) for c in ['#16232c', '#516673', '#ff7418', '#d0dce3']]
PALE, NAVY, GREEN = [colors.HexColor(c) for c in ['#f0f4f6', '#102332', '#17684d']]
STYLES = {
    'body': ParagraphStyle('body', fontName='Segoe', fontSize=10.4, leading=15.4, textColor=INK),
    'small': ParagraphStyle('small', fontName='Segoe', fontSize=8.5, leading=12.1, textColor=MUTED),
    'table': ParagraphStyle('table', fontName='Segoe', fontSize=9.3, leading=12.9, textColor=INK),
    'tablehead': ParagraphStyle('tablehead', fontName='Segoe-Bold', fontSize=9, leading=12, textColor=colors.white),
    'h3': ParagraphStyle('h3', fontName='Segoe-Bold', fontSize=13, leading=18, textColor=INK),
    'white': ParagraphStyle('white', fontName='Segoe', fontSize=10.5, leading=15.5, textColor=colors.white),
}
PAGES = 11
c = canvas.Canvas(str(OUT), pagesize=A4, pageCompression=1)
c.setTitle('Maskines - verkkosivuston kokonaisarvio 3.9.2026')
c.setAuthor('Maskines / paikallisen sivuston arvio')
c.setSubject('Ulkoasu, mobiili, haku, SEO, suorituskyky, saavutettavuus, analytiikka ja kehitysprioriteetit')
page_no = 0
authored = []

def p(text, x, top, width=CW, style='body', gap=8):
    authored.append(text)
    item = Paragraph(text, STYLES[style])
    _, height = item.wrap(width, 1000)
    assert top + height < H - 48, f'Page {page_no} overflow: {text[:70]} at {top + height}'
    item.drawOn(c, x, H - top - height)
    return top + height + gap

def line(text, x, top, size=10, color=INK, font='Segoe'):
    authored.append(text)
    c.setFont(font, size)
    c.setFillColor(color)
    c.drawString(x, H - top - size, text)

def box(x, top, width, height, fill=PALE, stroke=None):
    c.setFillColor(fill)
    c.setStrokeColor(stroke or fill)
    c.roundRect(x, H - top - height, width, height, 9, stroke=bool(stroke), fill=1)

def page(title, section, subtitle=None):
    global page_no
    if page_no:
        c.showPage()
    page_no += 1
    c.setFillColor(ORANGE)
    c.rect(0, H - 8, W, 8, fill=1, stroke=0)
    line('MASKINES  /  KOKONAISARVIO', M, 30, 8.5, MUTED, 'Segoe-Bold')
    c.setFont('Segoe', 8.5)
    c.drawRightString(W - M, H - 39, '03.09.2026  /  LOCALHOST')
    line(title, M, 64, 25, INK, 'Segoe-Bold')
    if subtitle:
        p(subtitle, M, 102, style='small')
    c.setStrokeColor(LINE)
    c.line(M, 43, W - M, 43)
    line(section, M, H - 32, 8, MUTED)
    c.setFillColor(MUTED)
    c.setFont('Segoe', 8)
    c.drawRightString(W - M, 22, f'{page_no:02d} / {PAGES:02d}')

def heading(text, y, x=M, width=CW):
    return p(text, x, y, width, 'h3', gap=7)

def item(label, text, y, x=M, width=CW):
    return p(f'<b>{label}</b> {text}', x, y, width, gap=11)

def table(headers, rows, widths, top, font='table', pad=8):
    contents = [[Paragraph(escape(str(v)), STYLES['tablehead']) for v in headers]]
    contents += [[Paragraph(str(v), STYLES[font]) for v in row] for row in rows]
    t = Table(contents, colWidths=widths, hAlign='LEFT')
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), NAVY),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, PALE]),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), pad),
        ('RIGHTPADDING', (0,0), (-1,-1), pad),
        ('TOPPADDING', (0,0), (-1,-1), pad),
        ('BOTTOMPADDING', (0,0), (-1,-1), pad),
        ('LINEBELOW', (0,0), (-1,0), .6, NAVY),
        ('LINEBELOW', (0,-1), (-1,-1), .5, LINE),
    ]))
    _, height = t.wrap(CW, 1000)
    assert top + height < H - 48, f'Table overflow page {page_no}: {top + height}'
    t.drawOn(c, M, H - top - height)
    return top + height + 16

def screenshot(name, x, top, width, caption=None):
    source = IMAGES / (name + '.png')
    img = ImageReader(str(source))
    iw, ih = img.getSize()
    height = width * ih / iw
    assert top + height < H - 48
    c.drawImage(img, x, H - top - height, width, height, mask='auto')
    c.setStrokeColor(LINE)
    c.rect(x, H - top - height, width, height, stroke=1, fill=0)
    y = top + height + 6
    if caption:
        y = p(caption, x, y, width, 'small', gap=9)
    return y

def ref(text, url, y):
    return p(f'<link href="{escape(url)}" color="#164c72">{escape(text)}</link>', M, y, CW, 'small', gap=7)

ratings = [
    ('Ulkoasu ja brändi', 7.5, 'Tunnistettava ilme; typografia ja korttien yhtenäisyys kaipaavat viimeistelyä.'),
    ('Mobiilikäyttö', 7, 'Toimiva kaksipalstainen selaus ja alapalkki; hakunäkymä on tarpeettoman korkea.'),
    ('Navigointi', 7.5, 'Pääryhmät ja haku löytyvät; rinnakkaisia suodatus- ja nollaustoimintoja on paljon.'),
    ('Haku ja suodatus', 8, 'Tietokantahaku ja yhdistelmäsuodattimet läpäisevät rajatut testit.'),
    ('Ilmoitussivu ja kuvat', 8, 'Hyvä tietohierarkia, kuvien suurennus ja ajoneuvon käyttötiedot.'),
    ('Sisällön laatu ja tarjonta', 6, 'Aitoa tarjontaa, mutta suppea valikoima. Kuvien ja tekstien laatu vaihtelee.'),
    ('Kieliversiot', 7, 'Omat kieliosoitteet toimivat; käyttäjäsisällössä on yhä kielten sekoittumista.'),
    ('Tekninen SEO', 8, 'Canonical, hreflang, sivukartta ja tärkeät HTTP-tapaukset testattu paikallisesti.'),
    ('Suorituskyky', 5.5, 'Tuotantokoonnin JS- ja CSS-määrät ovat suuret; kenttämittaus puuttuu.'),
    ('Saavutettavuus', 5.5, 'Selvä painiketekstin kontrastipuute; kattava saavutettavuusauditointi puuttuu.'),
    ('Luottamus', 7, 'Myyjätiedot ja yritysprofiili auttavat; arvostelu- ja toimitusnäyttöä on vähän.'),
    ('Ostopolun selkeys', 6, 'Vieraan kirjautumispolku toimii näkyvältä osalta; maksupolkua ei vahvistettu.'),
    ('Analytiikan valmius', 5, 'GA4 vastaanottaa web_vital-tapahtumia, mutta koko myyntiputki on vahvistamatta.'),
    ('Ylläpidettävyys', 5.5, 'Koonti ja regressiotestit toimivat; suurissa tiedostoissa on paljon yhteisiä tyylejä.'),
]
overall = sum(r[1] for r in ratings) / len(ratings)

# 1 - outcome first
page('Maskines', 'Yhteenveto', 'Verkkosivuston kokonaisarvio - nykyinen paikallinen versio')
y = p('Hyvä pohja erikoistuneelle kauppapaikalle.<br/><b>Seuraava kehitysaskel on luettavuus, keveys ja todennettu asiointi.</b>', M, 140, gap=0)
box(M, 201, CW, 104, NAVY)
line(f'{overall:.1f}'.replace('.', ','), M + 18, 210, 44, colors.white, 'Segoe-Bold')
line('/ 10', M + 99, 237, 17, colors.white)
p('Arvioijan kokonaisarvosana', M + 160, 217, CW - 180, 'white')
p('Käyttökelpoinen pilottiin. Ei vielä näyttöä siitä, että tuotannon nopeus, konversio ja koko maksupolku ovat kunnossa.', M + 160, 240, CW - 180, 'white')
screenshot('home-desktop', M, 326, CW, 'Nykyinen etusivu, 1440 px. Kuva otettu sisällön latauduttua localhostista.')
y = 694
y = item('Säilytä:', 'selkeä tuotekeskeinen etusivu, tunnistettava brändi ja haku.', y)
y = item('Korjaa ensin:', 'heikko painikekontrasti sekä raskas CSS/JavaScript-kuorma.', y)
p('Vahvista ennen laajempaa kasvua: asiointipolut testitilassa ja oikeiden käyttäjien tulokset.', M, y)

# 2 - numeric scope
page('Arvosanat osa-alueittain', 'Arviointiasteikko ja rajaus', '1 = erittäin keskeneräinen, 5 = käyttökelpoinen mutta puutteellinen, 8 = hyvä, 10 = poikkeuksellisen valmis.')
rows = [[name, str(score).replace('.', ',') + ' / 10', reason] for name, score, reason in ratings]
y = table(['Osa-alue', 'Arvio', 'Perustelu lyhyesti'], rows, [137, 59, CW - 196], 139, pad=6)
y = p('Kokonaisarvosana 6,7 on yllä olevien 14 arvosanan tasapainoinen keskiarvo. Numerot ovat perusteltuja laadullisia arvioita, eivät Lighthouse-pisteitä, hakukonesijoituksia tai mitattuja konversiolukuja.', M, y, style='small')
p('<b>Ei arvosanaa:</b> tietoturvan kokonaisuus, oikeudellinen vaatimustenmukaisuus, maksujen luotettavuus ja tuotannon käytettävyys. Niitä ei voi vahvistaa tällä rajatulla paikallistarkastuksella.', M, y, style='small')

# 3 - design and mobile
page('Ulkoasu ja mobiilikäyttö', 'Ulkoasu 7,5 / 10  |  Mobiili 7 / 10', 'Vahvuus on tuotteissa ja tunnistettavassa oranssi-tummansinisen yhdistelmässä.')
screenshot('home-mobile', M, 144, 148, 'Vaalea teema, 390 px.')
screenshot('home-mobile-dark', M + 161, 144, 148, 'Tumma teema, 390 px.')
x, width, y = M + 326, CW - 326, 145
y = heading('Toimii hyvin', y, x, width)
y = p('Kaksi ilmoitusta rinnakkain. Hinta, kuva ja otsikko erottuvat. Alapalkin järjestys on nyt Etusivu, Luo ilmoitus, Kirjaudu, Suodata.', x, y, width)
y = heading('Luettavuus', y + 9, x, width)
y = p('Tekstiä on monessa kohdassa hyvin lihavoitu. Pienet merkkitiedot, päivämäärät ja sijainnit jäävät erityisesti hakukorteissa vaikeiksi lukea.', x, y, width)
y = heading('Rajaus', y + 9, x, width)
p('Otoksen sivuissa ei todettu sivuttaisylivuotoa 1440, 390 tai 320 px leveydellä. Oikeita iPhone- ja Android-laitteita ei testattu.', x, y, width)
y = 534
y = heading('Kolme viimeistelyä, joilla ilme paranee', y)
y = item('1. Yhteinen korttityyli.', 'Yhdenmukaista etusivun, hakutulosten ja myyjän sivun kuvasuhteet, varjot ja tietorivit. Tuotteen keskeisen osan pitää näkyä rajauksessa.', y)
y = item('2. Rauhallisempi typografia.', 'Pidä otsikot ja hinnat vahvoina, mutta kevennä leipätekstiä. Kasvata pieniä lisätietoja ennen uusien tehosteiden lisäämistä.', y)
y = item('3. Laadukkaammat myyjäkuvat.', 'Ohjeista selkeä pääkuva, neutraali tausta, osanumero ja vauriot. Tämä parantaa koettua laatua enemmän kuin uusi koristeellinen etusivubanneri.', y)
p('Teemaongelmia voi syntyä vanhoista yhteisistä CSS-säännöistä. Uudet osat kannattaa tehdä rajatuilla komponenttityyleillä ja tarkistaa molemmissa teemoissa.', M, y, style='small')

# 4 - search
page('Haku ja navigointi', 'Haku 8 / 10  |  Navigointi 7,5 / 10', 'Hakutulokset löytyvät, mutta mobiilin hakutyökalut vievät turhan suuren osan ensimmäisestä näytöstä.')
screenshot('search-mobile', M, 143, 166, 'Haku "lynx": 18 tulosta. Hakukortit alkavat alempaa kuin etusivulla.')
x, width, y = M + 189, CW - 189, 145
y = heading('Vahvistetut vahvuudet', y, x, width)
y = p('Julkisen tietokantahaun testi läpäisi 21 tarkistusta. Otoksessa oli 45 julkista ilmoitusta. Yhdistelmähaku, sivutus, numeerinen hinta sekä sanasto- ja osanumerotapaukset toimivat testatuissa tilanteissa.', x, y, width)
y = p('Tyhjään tulokseen näytetään ohje poistaa suodattimia tai muuttaa hakua. Merkin valinta ohjaa mallin valintaa. Tärkeimmät tuoteryhmät ovat näkyvissä.', x, y, width)
y = heading('Selvä käytettävyysparannus', y + 8, x, width)
y = p('Hakutilassa näkyvät sekä "Tyhjennä hakuehdot" että "Nollaa suodattimet". Nollatoiminto toistuu myös tyhjässä hakutuloksessa. Yksi selkeä nollaus ja tiiviimpi tulosrivi vähentäisivät turhaa vieritystä.', x, y, width)
p('Pidä käytössä olevat suodattimet poistettavina tunnisteina. Erottele yleiset hakuehdot harvoin tarvittavista ajoneuvo- ja osakohtaisista lisäsuodattimista.', x, y, width)
y = 586
y = heading('Mitä SQL-muutoksista voidaan päätellä?', y)
y = p('Käyttäjän toimittamassa tarkistuskuvassa seitsemän hakua tukevaa indeksiä oli valid- ja ready-tilassa. Tässä arvioinnissa julkinen hakufunktio vastasi myös oikeisiin lukupyyntöihin. Tämä tukee sitä, että hakuratkaisu on käytössä.', M, y)
y = p('Indeksi auttaa tietokantaa löytämään rivejä ja järjestämään tuloksia. Se ei yksin pienennä kuvia, CSS:ää tai selaimen JavaScript-työtä. Otoksen pienuus ei myöskään todista suuren tietomäärän suorituskykyä.', M, y)
p('Seuraava testi: 20-30 oikeaa hakutehtävää, myös kirjoitusvirheet, OEM-numerot, tuotenimet kolmella muulla kielellä ja nollatuloksista palautuminen.', M, y, style='small')

# 5 - listing & trust
page('Ilmoitukset ja luottamus', 'Ilmoitussivu 8 / 10  |  Luottamus 7 / 10', 'Tieto on kohtuullisen selkeää. Kaupallinen luottamus syntyy lisäksi saatavuudesta, kuvista ja toteutuneista kaupoista.')
screenshot('image-preview', M, 139, 278, 'Vaalean teeman uusi suurennusnäkymä. Kuva säilyttää mittasuhteensa.')
x, width, y = M + 298, CW - 298, 140
y = heading('Nykyinen toiminta', y, x, width)
y = p('Suurennuksessa on näkyvä sulkupainike. Kuvan mittasuhteet säilyvät, eikä ylätunniste peitä kuvaa.', x, y, width)
y = p('Polaris 128:n otsikkorivillä lukee nyt <b>2300 km</b>. Vanhan kuvan "Moottorikelkka" ei vastaa tarkistettua nykytilaa.', x, y, width)
p('Käännösten huomautuslaatikko on käyttäjän pyynnöstä poistettu kokonaan. Ilmoituksen kuvaus ja sen käännös säilyvät.', x, y, width)
y = 400
y = heading('Myyjät ja tarjonnan uskottavuus', y)
y = item('Hyvää:', 'yrityksen oma profiili, yhteystietojen esittäminen ja myyjän muut ilmoitukset tukevat luottamusta. Tyhjä arvosteluhistoria kerrotaan avoimesti.', y)
y = item('Kehitettävää:', 'Arctic Partsin profiililla oli 32 tuotetta ja 0 arviota. Kokonaisotoksen 45 ilmoitusta on vielä vähän, joten valikoima ja myyjien monipuolisuus ovat merkittävämpiä kasvutekijöitä kuin uusien toimintojen määrä.', y)
y = heading('Ostajalle yksi selkeä seuraava askel', y + 4)
y = p('Myyjän sivun "Verkkokauppa" ja "Sovi maksu myyjän kanssa" voivat tarkoittaa eri asiointitapoja. Kerro tuotekohtaisesti, voiko tuotteen ostaa suoraan vai pitääkö sopia myyjän kanssa. Näytä saatavuus ja toimitustapa ennen päätöstä.', M, y)
y = p('Ilmoitusten laadussa kannattaa painottaa osanumeroa, sopivuutta, kuntoa, vikoja, toimitusta ja sitä, mitä kauppaan sisältyy. Näitä ei pidä keksiä puuttuvien tietojen tilalle.', M, y)
p('Koko tilaus-, maksu-, palautus- tai reklamaatiopolkua ei vahvistettu. Tämän sivun arvosanat koskevat näkyvää käyttöliittymää ja tietojen selkeyttä.', M, y, style='small')

# 6 - SEO
page('SEO ja kieliversiot', 'Tekninen SEO 8 / 10  |  Kieliversiot 7 / 10', 'Tekninen rakenne on hyvässä vaiheessa. Hakukonenäkyvyydestä ei ole vielä tässä arvioinnissa mitattua näyttöä.')
y = table(['Tarkistettu osa', 'Tulos', 'Merkitys'], [
    ['Kielietusivut /, /en, /sv, /no', 'Läpäisi', 'Oikea HTML-kieli, oma canonical ja neljä kielivaihtoehtoa.'],
    ['Lynx-kokoelmat neljällä kielellä', 'Läpäisi', '18 korttia; palvelimen sisältö ja rakenteinen lista vastaavat toisiaan.'],
    ['Ohuet kokoelmat / puuttuvat sivut', 'Läpäisi', 'Otos: noindex ohuille sivuille ja aito 404 puuttuville sivuille.'],
    ['Vaihtoehtoiset osoitteet', 'Läpäisi', 'Duplikaattien canonical sekä lokalisoitu myynti-/kirjautumisohjaus.'],
    ['Sivukartta', '438 eri URL:ää', 'Paikallinen rakenne tarkistettu; tämä ei tarkoita 438 indeksoitua sivua.'],
    ['Kirjautumissivu', 'Ei indeksoitava', 'HTTP:n X-Robots-Tag: noindex, nofollow. Pelkkä HTML-meta ei kerro koko tilaa.'],
], [161, 77, CW - 238], 138, pad=7)
y = heading('Mitä kannattaa parantaa seuraavaksi?', y)
y = item('Sisältö, ei osoitteiden määrä.', 'Kirjoita tärkeimmille merkki- ja osaryhmille hyödylliset, yksilölliset kuvaukset sekä selkeät sisäiset linkit. Älä lisää ohuita sivuja vain hakusanoja varten.', y)
y = item('Käännösten laatu.', 'Englanninkielisessä otoksessa osa käyttäjän otsikoista jäi suomeksi, esimerkiksi "800 h.o vakio kansi". Tekninen kieliosoite ei takaa, että jokainen ilmoitus on kielellisesti valmis.', y)
y = item('Julkaisun jälkeinen vahvistus.', 'Tarkista todellisen verkkotunnuksen canonical- ja sivukarttaosoitteet, Search Consolen indeksointi sekä hakukyselyt. Paikallinen metatunnus puuttui; DNS-vahvistuksen tilaa ei tarkistettu.', y)
p('<b>Korjattu tulkinta:</b> alkuvaiheen tuotantotestissä oli localhost/127.0.0.1-osoiteristiriita. Yhtenäisellä localhost-asetuksella kielitestit läpäisivät. Tätä ei kirjata sivuston 404- tai kieli-SEO-viaksi. [1, 2]', M, y, style='small')

# 7 - performance
page('Nopeus ja latauskuorma', 'Suorituskyky 5,5 / 10', 'Tuore paikallinen tuotantokoonti. Pakkaamattomat ja gzip-luvut ovat tiedostokokoja, eivät käyttäjän kokemaa latausaikaa.')
def kb(n): return f'{n / 1000:,.0f}'.replace(',', ' ') + ' kB'
def mb(n): return f'{n / 1000000:.2f}'.replace('.', ',') + ' MB'
y = table(['Resurssi', 'Etusivu: raaka / gzip', 'Lynx-sivu: raaka / gzip'], [
    ['HTML', f'{kb(HOME["htmlBytes"])} / {kb(HOME["htmlGzipBytes"])}', f'{kb(COLLECTION["htmlBytes"])} / {kb(COLLECTION["htmlGzipBytes"])}'],
    ['JavaScript', f'{mb(HOME["initialJavaScript"]["bytes"])} / {kb(HOME["initialJavaScript"]["gzipBytes"])}', f'{mb(COLLECTION["initialJavaScript"]["bytes"])} / {kb(COLLECTION["initialJavaScript"]["gzipBytes"])}'],
    ['CSS', f'{mb(HOME["css"]["bytes"])} / {kb(HOME["css"]["gzipBytes"])}', f'{mb(COLLECTION["css"]["bytes"])} / {kb(COLLECTION["css"]["gzipBytes"])}'],
    ['JS- / CSS-tiedostoja', f'{HOME["initialJavaScript"]["files"]} / {HOME["css"]["files"]}', f'{COLLECTION["initialJavaScript"]["files"]} / {COLLECTION["css"]["files"]}'],
], [133, 187, CW - 320], 141)
y = p(f'Kolmen paikallisen HTML-pyynnön kestot: etusivu {", ".join(map(str, HOME["htmlResponseMs"]))} ms (mediaani {statistics.median(HOME["htmlResponseMs"]):.0f} ms); Lynx-sivu {", ".join(map(str, COLLECTION["htmlResponseMs"]))} ms (mediaani {statistics.median(COLLECTION["htmlResponseMs"]):.0f} ms). Nämä sisältävät vastauksen lukemisen, eivät selaimen koko sivulatausta.', M, y, style='small')
y = heading('Tulkinta', y + 8)
y = p('Etusivun JavaScript ja CSS ovat yhteensä noin 3,50 MB pakkaamattomina ja 797 kB gzip-pakattuina - ennen tuotekuvia ja muita myöhemmin ladattavia resursseja. Kuorma on huomattava etenkin puhelimella.', M, y)
y = item('Ensimmäinen työ:', 'karsi yhteistä CSS:ää hallitusti, siirrä sivukohtaiset säännöt omistaviin komponentteihin ja tarkista molemmat teemat jokaisen vaiheen jälkeen.', y)
y = item('Toinen työ:', 'rajaa etusivun alkuvaiheen JavaScript riippuvuuksineen. Lataa harvoin tarvittavat toiminnot vasta tarpeeseen. Mittaa muutos samassa ympäristössä ennen ja jälkeen.', y)
y = item('Kolmas työ:', 'mittaa oikeiden kuvien siirtomäärät, käytä sopivia kuvakokoja ja vältä näkymän ulkopuolisten kuvien lataamista liian aikaisin.', y)
y = heading('Oikean nopeustuloksen hyväksymisrajat', y + 4)
y = p('Core Web Vitalsin hyvät rajat: <b>LCP enintään 2,5 s, INP enintään 200 ms ja CLS enintään 0,1</b>, tarkasteltuna oikeiden käyttäjien 75. persentiilissä. Puhelin ja tietokone arvioidaan erikseen. [3]', M, y)
p('Ei CPU-/verkkohidastusta. Gzip laskettiin tiedostosisällöistä; siirtopakkaus voi tuotannossa erota. Ei Lighthouse-pisteitä, kenttä-CWV-tuloksia tai tuotannon nopeutusprosenttia.', M, y, style='small')

# 8 - a11y and technical
page('Saavutettavuus ja tekniikka', 'Saavutettavuus 5,5 / 10  |  Ylläpidettävyys 5,5 / 10', 'Toimiva sivu ei automaattisesti tarkoita saavutettavaa tai kokonaan tietoturva-auditoitua sivua.')
box(M, 139, CW, 113)
line('VAHVISTETTU KONTRASTIPUUTE', M + 16, 153, 9.2, MUTED, 'Segoe-Bold')
p('<b>"Luo ilmoitus"</b>: 14 px valkoinen teksti oranssilla liukuvärillä. Liukuvärin päätepisteiden kontrastit ovat noin <b>2,45:1 ja 2,90:1</b>. Tämän kokoisen tekstin WCAG AA -vertailuraja on 4,5:1. [4]', M + 16, 176, CW - 32)
y = 275
y = item('Korjaus:', 'käytä tummaa tekstiä oranssilla tai riittävän tummaa painiketaustaa. Tarkista normaali, hover-, fokus- ja aktiivinen tila sekä molemmat teemat. Oranssia brändiväriä ei tarvitse poistaa.', y)
y = item('Hyvää:', 'kuvien suurennus käyttää suljettavaa dialogia. Otoksen näkyvistä kuvista ei löytynyt puuttuvaa alt-attribuuttia tai rikkoutunutta kuvaa. Tämä ei vielä arvioi vaihtoehtoisten tekstien laatua.', y)
y = item('Vielä testattava:', 'näppäimistö koko ostopolulla, ruudunlukija, 200 % suurennus, virheviestien ymmärrettävyys ja pienten linkkien osuma-alueet. WCAG:n 24 px minimirajassa on myös välistykseen ja tekstilinkkeihin liittyviä poikkeuksia. [5]', y)
y = heading('Tekninen ylläpidettävyys', y + 5)
y = p('Uusi tuotantokoonti läpäisi käännöksen, tyyppitarkistuksen ja lint-tarkistuksen. Hakua, kielireittejä ja aiempia korjauksia varten on regressiotestejä. Ne auttavat pitämään muutokset hallittuina.', M, y)
y = p('HomeClient- ja ListingPageClient-tiedostot ovat kumpikin yli 9 000 rivin kokoisia. Suuri osa ilmoitussivun tiedostosta liittyy tyyleihin. Ristiin vaikuttava CSS selittää myös helposti uusiutuvat teemaongelmat. Pienet, vastuultaan rajatut komponentit ovat perusteltu jatkotyö.', M, y)
y = heading('Tietoturva: rajattu havainto, ei hyväksyntä', y + 4)
p('Ei tunkeutumistestausta, kattavaa RLS-/käyttöoikeustarkastusta, palautusharjoitusta tai tuotannon loki- ja valvonta-auditointia. Paikallisessa asetustarkistuksessa Stripe oli live-tilassa ja paikalliset webhook-salaisuudet puuttuivat. Tämä ei todista mitään Railwayn webhook-asetuksista.', M, y)

# 9 - analytics and pilot
page('Analytiikka ja asiointipolut', 'Analytiikka 5 / 10  |  Ostopolun selkeys 6 / 10', 'Asennettu mittaus on alku. Seuraava vaihe on varmistaa, että oikeat tapahtumat kertovat oikeista käyttäjäteoista.')
y = table(['Kohde', 'Vahvistettu näyttö', 'Mitä puuttuu'], [
    ['GA4-tunnus', 'G-BN07FPKVXJ on määritelty.', 'Julkaistun version toiminta omana tarkistuksenaan.'],
    ['DebugView', 'Käyttäjän kuvassa 3 web_vital-tapahtumaa.', 'Koko selaus-, yhteydenotto- ja ostoputken vahvistus.'],
    ['Suostumus', 'Tarkistusselaus tehtiin ilman analytiikkasuostumusta.', 'Hyväksy/hylkää/peruuta -tilanteiden lopullinen julkaisutesti.'],
    ['Kirjautuminen ennen myyntiä', 'Vierasta ohjataan kirjautumaan ja luontitarkoitus kerrotaan.', 'Todellinen kirjautuminen ja ilmoituksen loppuun saattaminen.'],
    ['Ostoskori', 'Tyhjän korin näkymä ja paluu ostoksille nähty.', 'Koko kori-, varasto-, maksu-, peruutus- ja palautuspolku testitilassa.'],
], [110, 196, CW - 306], 139, pad=7)
y = heading('Vahvista tapahtumat käytännössä', y)
y = p('Testaa sivun avaus, haku, ilmoituksen katselu, yhteydenoton aloitus ja ilmoituksen luonti. Suoraan ostettaville tuotteille lisäksi kori, kassalle siirtyminen ja vahvistettu ostos. Tarkista tapahtuman sisältö sekä ettei sama ostos kirjaudu kahdesti. [6, 7]', M, y)
y = p('Erottele localhostin debug-liikenne oikeista käyttäjistä. Älä lähetä hakutekstissä, URL:ssa tai tapahtumissa henkilötietoja, viestisisältöjä tai maksusalaisuuksia. Kolme web_vital-tapahtumaa ei riitä kenttä-CWV-tulokseksi.', M, y)
y = heading('Käyttäjätesti ja markkinapaikan pilotti', y + 5)
y = p('Aloita viidellä ostajalla ja viidellä myyjällä: pyydä löytämään sopiva osa, arvioimaan sopivuus ja toimitus sekä aloittamaan yhteydenotto tai ilmoitus. Kirjaa onnistuiko tehtävä ilman apua, kauanko se kesti ja mihin käyttäjä pysähtyi.', M, y)
p('Laajenna tämän jälkeen esimerkiksi 10 myyjän / 20 ostajan pilottiin. Seuraa hakujen nollatuloksia, laadukkaiden ilmoitusten määrää, myyjän vastausaikaa ja toteutuneita yhteydenottoja. Käyttäjiä ei haastateltu tässä arvioinnissa.', M, y)

# 10 - action plan
page('Mitä tehdään seuraavaksi?', 'Priorisoitu jatkotyö', 'P1 = seuraava korjauserä tai ennen maksujen käyttöönottoa. P2 = hallittu kehitys mittaustiedon perusteella.')
y = table(['Taso', 'Toimenpide', 'Valmista, kun...'], [
    ['P1', '<b>Oranssien painikkeiden kontrasti</b><br/>Tarkista kaikki keskeiset toimintopainikkeet.', 'Normaalikokoinen teksti täyttää 4,5:1, myös teemoissa ja eri tiloissa.'],
    ['P1', '<b>Kevyempi julkinen sivu</b><br/>CSS:n omistajuus ja etusivun JS riippuvuuksineen.', 'Samoilla sivuilla mitattu kuorma pienenee eikä visuaalisia tai toiminnallisia regressioita ilmene.'],
    ['P1', '<b>Koko asiointipolku testitilassa</b><br/>Kirjautuminen, julkaisu, viestit, ostaminen, loppuunmyyty tuote ja palautus.', 'Skenaariot on ajettu eristetyillä testitileillä ja Stripe-testitilassa; tulokset dokumentoitu.'],
    ['P1', '<b>Mittauksen vastaanotto ja laatu</b><br/>Selaus-, yhteydenotto- ja maksutapahtumat.', 'DebugView ja verkon tapahtumat vastaavat käyttäjän tekoja, suostumusta ja ostosten todellista tilaa.'],
    ['P2', '<b>Mobiilin hakutilan tiivistys</b><br/>Yksi nollaus ja yhtenäiset hakukortit.', 'Hakutulos näkyy aiemmin, ehdot voi poistaa ja kaikki toiminnot ovat saavutettavia.'],
    ['P2', '<b>Kuvat, ilmoitustiedot ja kielet</b><br/>Osanumero, kunto, sopivuus ja toimitus.', 'Tärkeimpien ilmoitusten tiedot ovat täsmällisiä, kuvat selkeitä ja käännökset tarkistettuja.'],
    ['P2', '<b>Search Console ja käyttäjäpilotti</b><br/>Julkaisun jälkeen erillisen hyväksynnän perusteella.', 'Indeksointi, hakukyselyt, todelliset käyttäjätehtävät ja palautteet on kirjattu.'],
], [45, 210, CW - 255], 140, pad=8)
y = heading('Tässä työssä jo tehty', y)
y = p('Käyttäjän viimeisimmän pyynnön mukainen käännöshuomautuslaatikko poistettiin kokonaan. Poisto tarkistettiin varaosa- ja ajoneuvoilmoituksissa neljällä kielellä, kahdella teemalla sekä tietokone- ja puhelinleveydellä. Itse kuvaukset säilyvät.', M, y)
p('<b>Ei tehty:</b> Railway-julkaisua, oikeaa maksua, tietokantamuutosta tai ulkopuolisten käyttäjien kontaktointia. Raportin muut kehityskohdat ovat ehdotuksia, eivät väitettyjä valmiita korjauksia.', M, y, style='small')

# 11 - method and references
page('Menetelmä ja lähteet', 'Todisteet, rajoitukset ja tulkinta', 'Arvio koskee 3.9.2026 paikallista versiota. Se ei ole tuotannon sertifiointi tai riippumaton käyttäjätutkimus.')
y = heading('Tarkistettu aineisto', 140)
y = p('Selainotos: etusivu suomeksi ja englanniksi, vaalea ja tumma teema, mobiilikoot 390 ja 320 px, Lynx-haku, tyhjä hakutulos, suodatinpaneeli, Lynx-kokoelma, varaosa 165, ajoneuvo 128, kuvan suurennus, Arctic Parts -profiili, vieraan ilmoituspolku, kirjautuminen ja tyhjä ostoskori.', M, y)
y = p('Tekninen otos: uusi Next.js-tuotantokoonti, kielisivujen ja SEO-kokoelmien testit, julkisen tietokantahaun 21 lukutarkistusta, aiempien korjausten regressiotesti sekä käännöslaatikon poistotesti. Lopulliset nopeusluvut mitattiin erillisestä localhost:3100-tuotantopalvelimesta; käyttöliittymää tarkistettiin myös localhost:3000-kehityspalvelimelta.', M, y)
y = p('Todisteina säilyvät paikalliset kuvakaappaukset, audit.json, final-audit-home.json, final-audit-collection.json sekä translation-note-removal-tests.json. Aiempi epäilty kielivirhe kumottiin toistotestillä osoiteasetuksen korjauksen jälkeen. Käyttäjän vanhoja kuvakaappauksia ei tulkittu automaattisesti nykyisiksi vioiksi.', M, y)
y = heading('Mitä ei voi päätellä tästä raportista?', y + 3)
y = p('Ei tuotannon nopeutusprosenttia, hakukonesijoitusta, todellista konversioastetta tai maksujen turvallisuustakuuta. Ei täydellistä saavutettavuus-, tietosuoja- tai tietoturva-auditointia. Paikallinen asetuspuute ei osoita tuotannon asetuspuutetta. Odottavaa latausnäkymää ei luokiteltu virheeksi ilman lisänäyttöä.', M, y)
y = heading('Arviointiperusteiden ensisijaiset lähteet', y + 5)
for title, url in [
    ('[1] Google Search Central: kieli- ja alueversioiden ilmoittaminen', 'https://developers.google.com/search/docs/specialty/international/localized-versions'),
    ('[2] Google Search Central: canonical ja päällekkäiset URL-osoitteet', 'https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls'),
    ('[3] web.dev: Core Web Vitals ja hyvien tulosten rajat', 'https://web.dev/articles/vitals'),
    ('[4] W3C: WCAG 2.2, Contrast (Minimum)', 'https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html'),
    ('[5] W3C: WCAG 2.2, Target Size (Minimum)', 'https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html'),
    ('[6] Google Analytics: DebugView-raportti', 'https://support.google.com/analytics/answer/7201382?hl=fi'),
    ('[7] Google Analytics: tapahtumien keräämisen vianmääritys', 'https://developers.google.com/analytics/devguides/collection/ga4/troubleshoot'),
]:
    y = ref(title, url, y)
p('Lähteet määrittävät arviointikriteerejä. Maskines-kohtaiset havainnot perustuvat yllä kuvattuihin paikallisiin tarkistuksiin ja erikseen nimettyihin käyttäjän toimittamiin todisteisiin.', M, y + 4, style='small')

assert page_no == PAGES
for text in authored:
    assert not any(ch in text for ch in '\u2010\u2011\u2012\u2013\u2014'), 'Use ASCII hyphens in authored report text'
c.save()
print(json.dumps({'pdf': str(OUT), 'pages': page_no, 'overall': round(overall, 1)}, ensure_ascii=False))
