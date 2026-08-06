"""Generates docs/admin-manual.pdf — a plain-language, step-by-step guide to
the admin panel, written for someone with no technical background at all.

One-off content document, not part of the running app (unlike orders/pdf.py,
which renders live order data) — regenerate by re-running this script after
editing the CONTENT list below:

    backend/.venv/Scripts/python.exe scripts/generate_admin_manual.py

Reuses the project's own Cyrillic-font-detection logic (common/fonts.py) so
this renders with the same font as the real invoice PDFs, not reportlab's
default Cyrillic-less Helvetica.
"""

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from reportlab.lib import colors  # noqa: E402
from reportlab.lib.enums import TA_LEFT  # noqa: E402
from reportlab.lib.pagesizes import A4  # noqa: E402
from reportlab.lib.styles import ParagraphStyle  # noqa: E402
from reportlab.lib.units import mm  # noqa: E402
from reportlab.pdfbase import pdfmetrics  # noqa: E402
from reportlab.pdfbase.ttfonts import TTFont  # noqa: E402
from reportlab.platypus import (  # noqa: E402
    Image,
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
)

from common.fonts import (  # noqa: E402
    FONT_PATH_CANDIDATES_BOLD,
    FONT_PATH_CANDIDATES_REGULAR,
    find_font_path,
)

BRAND_BLUE = colors.HexColor("#215F9A")
BRAND_ORANGE = colors.HexColor("#EF6E35")
MUTED = colors.HexColor("#64748b")

OUTPUT_PATH = PROJECT_ROOT / "docs" / "admin-manual.pdf"
SCREENSHOTS_DIR = PROJECT_ROOT / "docs" / "screenshots"


def _register_fonts() -> tuple[str, str]:
    regular_path = find_font_path(FONT_PATH_CANDIDATES_REGULAR)
    bold_path = find_font_path(FONT_PATH_CANDIDATES_BOLD)
    regular_name, bold_name = "Helvetica", "Helvetica-Bold"
    if regular_path:
        pdfmetrics.registerFont(TTFont("Manual", regular_path))
        regular_name = bold_name = "Manual"
    if bold_path:
        pdfmetrics.registerFont(TTFont("Manual-Bold", bold_path))
        bold_name = "Manual-Bold"
    return regular_name, bold_name


# Each section: (heading, [blocks]) — a block is either a plain paragraph
# (str), a numbered step list (("steps", [str, ...])), or a bullet list
# (("bullets", [str, ...])).
CONTENT: list[tuple[str, list]] = [
    (
        "Как да влезете в администраторския панел",
        [
            "Администраторският панел е отделна, скрита част от сайта — обикновените "
            "клиенти не я виждат и не могат да стигнат до нея.",
            (
                "steps",
                [
                    'Отворете сайта и отидете на адрес, който завършва с "/login".',
                    "Въведете потребителското си име и паролата, с които администраторът "
                    "(собственикът на сайта) ви е дал достъп.",
                    'Натиснете бутона "Вход".',
                    'Ако профилът ви има администраторски права, горе вляво (или в '
                    'менюто) ще видите връзка "Админ панел" — натиснете я, за да '
                    "влезете.",
                ],
            ),
            "Ако не виждате тази връзка, значи профилът ви още няма администраторски "
            "права — помолете собственика на сайта да ви ги даде от Django-панела.",
        ],
    ),
    (
        "Общ преглед на менюто",
        [
            "Вляво (на телефон — през бутона с трите линии горе) виждате менюто с "
            "основните раздели:",
            (
                "bullets",
                [
                    '"Начало" — кратък преглед: колко чакащи поръчки, непрочетени '
                    "известия, клиенти и продукти има.",
                    '"Клиенти" — списък с всички регистрирани клиенти.',
                    '"Поръчки" — новите поръчки, които трябва да потвърдите или '
                    "откажете.",
                    '"Продукти" — целият каталог продукти, с цени и снимки.',
                    '"Промоции" — намаления, които създавате сами.',
                    '"Купони" — кодове за отстъпка, които клиент въвежда на каса.',
                    '"Чат" — вграден помощник, на който можете да пишете въпроси или '
                    "да го помолите да създаде промоция/купон вместо вас.",
                ],
            ),
            'До всеки от тези редове в менюто има малък кръгъл бутон със знак "?" — '
            "натиснете го по всяко време и чатът ще ви обясни точно този раздел.",
            'Горе вдясно винаги виждате линк "Към магазина" (за да видите сайта като '
            'клиент) и бутон "Изход" (за излизане от администраторския профил).',
            ("image", "01-dashboard.png", "Началната страница на админ панела"),
        ],
    ),
    (
        "Продукти — преглед и търсене",
        [
            'В раздел "Продукти" виждате целия каталог — снимка, номер, име, категория '
            "и две цени за всеки продукт.",
            "Двете цени, които виждате, означават следното:",
            (
                "bullets",
                [
                    '"Клиентска цена" — това плаща клиентът, когато купува от сайта.',
                    '"Цена за реселър" — това е вашата собствена цена/себестойност '
                    "(колко ви струва продуктът от доставчика). Клиентите никога не "
                    "виждат тази цена.",
                    '"Печалба" — разликата между двете, показва се автоматично в '
                    "зелено (печалба) или червено (загуба), за да видите веднага дали "
                    "продуктът е изгоден.",
                ],
            ),
            "За да намерите конкретен продукт бързо, пишете в полето за търсене горе — "
            "работи по име или по SKU (уникален код на продукта). Докато пишете, отдолу "
            "веднага се показват съвпадения, на които можете да натиснете направо.",
            ("image", "02-products.png", "Списък с продукти, с двете цени и печалбата"),
        ],
    ),
    (
        "Продукти — добавяне и редактиране",
        [
            (
                "steps",
                [
                    'Натиснете бутона за нов продукт (или "Редактирай" до вече '
                    "съществуващ продукт).",
                    "Попълнете името, кратко описание и пълно описание на продукта.",
                    "Изберете категория и марка (бранд) от списъците.",
                    "Въведете двете цени — клиентска цена (каквото плаща клиентът) и "
                    "цена за реселър (вашата себестойност).",
                    "Качете снимки на продукта — можете да качите повече от една, "
                    "първата се показва като основна снимка в каталога.",
                    "Ако продуктът има технически характеристики (размер, цвят, тегло "
                    "и т.н.), добавете ги в раздела за характеристики.",
                    'Натиснете бутона за запазване.',
                ],
            ),
            'Важно: продуктите, синхронизирани автоматично от доставчика (виж следващия '
            "раздел), винаги пазят клиентската цена, която сте задали сами — "
            "синхронизацията никога не я презаписва.",
            ("image", "02b-product-form.png", "Формата за редактиране на продукт"),
        ],
    ),
    (
        'Бутонът "Синхронизация" — какво прави',
        [
            'Горе в администраторския панел има бутон "Синхронизация". Той автоматично '
            "изтегля най-новия каталог продукти от доставчика (officecenter-bg.com) и "
            "го добавя/обновява в нашия сайт.",
            (
                "bullets",
                [
                    "Нови продукти от доставчика се добавят автоматично.",
                    "Съществуващи продукти се обновяват (цена от доставчика, снимки, "
                    "наличност), но клиентската цена, която вие сте задали ръчно, "
                    "никога не се презаписва.",
                    "Не е нужно да натискате този бутон често — веднъж на ден е "
                    "напълно достатъчно.",
                ],
            ),
            'След като приключи, ще видите съобщение колко нови продукта са добавени '
            "и колко съществуващи са обновени.",
        ],
    ),
    (
        "Поръчки — какво да правите с нова поръчка",
        [
            "Когато клиент направи поръчка от сайта, тя се появява веднага в раздел "
            '"Поръчки" и получавате имейл известие. Броят непрочетени поръчки се '
            "вижда като червено число до самото меню.",
            (
                "steps",
                [
                    "Отворете раздел \"Поръчки\".",
                    "Прегледайте продуктите в поръчката, количествата и общата сума.",
                    "Ако всичко е налично и вярно, натиснете \"Потвърди\" — клиентът "
                    "автоматично получава имейл с фактура, а вие (администраторът) "
                    "получавате копие с показана печалбата от поръчката.",
                    "Ако нещо липсва или не е наред, натиснете \"Откажи\" и по избор "
                    "напишете причина — клиентът ще бъде уведомен.",
                ],
            ),
            'До всеки продукт в поръчката (ако е синхронизиран от доставчика) има '
            "линк към същия продукт в сайта на доставчика — полезно е, ако трябва да "
            "го поръчате отделно, за да изпълните поръчката на клиента.",
            'Печалбата от цялата поръчка (разликата между платеното от клиента и вашата '
            "себестойност) се показва точно над бутоните за потвърждаване/отказ — "
            "виждате я само вие, клиентът никога не я вижда.",
            ("image", "03-orders.png", "Списък с поръчки, чакащи потвърждение"),
        ],
    ),
    (
        "Промоции — как да намалите цена",
        [
            'Промоцията е временно намаление на цена. Раздел "Промоции" показва '
            "съществуващите промоции и форма за създаване на нова.",
            "При създаване на промоция избирате две отделни неща:",
            (
                "bullets",
                [
                    '"За какво важи" (целта) — цялата страница (всички продукти), '
                    "само една категория, или само един конкретен продукт.",
                    '"За кого важи" (по избор) — оставете празно, за да важи за '
                    "всички клиенти, или изберете конкретен клиент от списъка, ако "
                    "искате намалението да е само за него.",
                ],
            ),
            "Видът на отстъпката може да е:",
            (
                "bullets",
                [
                    '"Процент" — например 20%, което се изважда от текущата цена.',
                    '"Крайна цена" — вие директно казвате колco да струва продуктът, '
                    "докато промоцията е активна.",
                ],
            ),
            'По желание можете да зададете и "Максимален брой в поръчка" — ако клиент '
            "поръча повече бройки, само първите N получават намалението, останалите "
            "се плащат на нормална цена.",
            "Автоматичен банер: ако промоцията е за конкретна категория или продукт "
            "(не за конкретен клиент), сайтът автоматично създава рекламен банер за "
            "нея на началната страница — не е нужно да правите нищо допълнително.",
            ("image", "04-promotions.png", "Формата за създаване на промоция"),
        ],
    ),
    (
        "Купони — кодове за отстъпка",
        [
            "За разлика от промоцията (която важи автоматично), купонът е код, който "
            'клиентът трябва сам да въведе на касата. Раздел "Купони" работи по подобен '
            "начин на промоциите.",
            (
                "steps",
                [
                    "Въведете конкретен код (например LqTO2026) или оставете полето "
                    "празно, за да се генерира автоматично.",
                    "Изберете вид отстъпка — процент или фиксирана сума в евро.",
                    "По желание задайте минимална сума на поръчката, за да важи "
                    "купонът.",
                    "По желание изберете конкретен клиент — ако оставите празно, "
                    "купонът е отворен за всеки, който въведе кода.",
                ],
            ),
            "Всеки купон може да се използва само веднъж — след като бъде използван "
            "в успешна поръчка, автоматично спира да важи.",
            ("image", "05-coupons.png", "Формата за създаване на купон"),
        ],
    ),
    (
        "Клиенти — преглед и индивидуални настройки",
        [
            'В раздел "Клиенти" виждате списък с всички регистрирани потребители на '
            "сайта. Търсенето работи по потребителско име или имейл.",
            "Като отворите конкретен клиент, виждате:",
            (
                "bullets",
                [
                    "Неговата активност — кои продукти и категории е разглеждал "
                    "най-много (полезно, ако искате да му предложите индивидуална "
                    "промоция точно за нещо, което го интересува).",
                    "Инструмент за неговата количка — можете да добавяте или "
                    "премахвате продукти в количката му от ваше име, ако той ви е "
                    "помолил по телефона например.",
                    'Бърз бутон за създаване на индивидуална промоция точно за него '
                    "на конкретен продукт.",
                ],
            ),
            ("image", "06-customers.png", "Списък с клиенти"),
        ],
    ),
    (
        "Чат помощник — задавайте въпроси или създавайте промоции с думи",
        [
            'Малкият чат прозорец долу вдясно (или пълната страница "Чат" в менюто) е '
            "вграден помощник, който отговаря на въпроси за всеки раздел на панела.",
            (
                "bullets",
                [
                    'Напишете "/помощ", за да видите списък с теми, или направо '
                    'въпрос като "как да добавя промоция".',
                    'Напишете "/създай", за да започнете разговор, в който чатът ви '
                    "пита стъпка по стъпка (име, цена, за какво важи, за кого важи) "
                    "и накрая реално създава промоция или купон вместо вас — не е "
                    "нужно да отваряте отделните форми.",
                    'Докато пишете, можете да използвате знака "@", последван от '
                    "името на продукт или клиент, за да го изберете точно от списък "
                    "със снимки — това избягва грешка, ако има два подобни продукта.",
                ],
            ),
            ("image", "07-chat.png", "Чат помощникът"),
        ],
    ),
    (
        "Тъмна тема и оформление",
        [
            "Горе в сайта (не само в админ панела) има бутон за превключване между "
            "светла и тъмна тема, както и падащо меню с няколко готови дизайна — това "
            "е само визуално предпочитание и не променя нищо друго в сайта.",
        ],
    ),
    (
        "Чести въпроси",
        [
            (
                "bullets",
                [
                    '"Не виждам печалба/цена за реселър до продукт." — Печалбата и '
                    "цената за реселър се виждат само когато сте влезли като "
                    "администратор. Обикновен клиент никога не ги вижда.",
                    '"Направих промяна, но не я виждам веднага в сайта." — Понякога '
                    "отнема няколко секунди. Презаредете страницата (F5), ако не се "
                    "появи веднага.",
                    '"Създадох промоция, но банер не се появи на началната страница." '
                    "— Банерите се обновяват автоматично до около минута след "
                    "промяна. Ако промоцията е насочена само към конкретен клиент, "
                    "тя умишлено НЕ показва публичен банер — това е нормално, не е "
                    "грешка.",
                    '"Изтрих/отказах поръчка по грешка." — Свържете се с '
                    "разработчика на сайта — това не може да се отмени сами от "
                    "панела.",
                ],
            ),
        ],
    ),
]


def _wrap_paragraph_style(font_regular: str) -> ParagraphStyle:
    return ParagraphStyle(
        "Body",
        fontName=font_regular,
        fontSize=11,
        leading=16,
        alignment=TA_LEFT,
        spaceAfter=8,
    )


def build_pdf() -> None:
    font_regular, font_bold = _register_fonts()

    doc = SimpleDocTemplate(
        str(OUTPUT_PATH),
        pagesize=A4,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        title="Ръководство за администраторския панел",
    )

    title_style = ParagraphStyle(
        "Title", fontName=font_bold, fontSize=26, leading=32, textColor=BRAND_BLUE
    )
    subtitle_style = ParagraphStyle(
        "Subtitle", fontName=font_regular, fontSize=13, leading=18, textColor=MUTED
    )
    heading_style = ParagraphStyle(
        "Heading",
        fontName=font_bold,
        fontSize=16,
        leading=20,
        textColor=BRAND_BLUE,
        spaceBefore=4,
        spaceAfter=10,
    )
    body_style = _wrap_paragraph_style(font_regular)
    bullet_style = ParagraphStyle(
        "Bullet", parent=body_style, leftIndent=0, spaceAfter=4
    )
    caption_style = ParagraphStyle(
        "Caption",
        fontName=font_regular,
        fontSize=9,
        leading=12,
        textColor=MUTED,
        spaceBefore=3,
        spaceAfter=10,
    )
    # Real screenshots of the actual running admin panel (captured via
    # frontend/scripts/capture_admin_screenshots.mjs against a live dev
    # server + a throwaway admin account) — not mockups. All 1440x900,
    # scaled to the page's content width, aspect ratio preserved.
    content_width = A4[0] - 40 * mm
    image_height = content_width * (900 / 1440)

    elements = []

    # Title page.
    elements.append(Spacer(1, 60 * mm))
    elements.append(Paragraph("Ръководство за администраторския панел", title_style))
    elements.append(Spacer(1, 6 * mm))
    elements.append(
        Paragraph(
            "Стъпка по стъпка обяснение на всичко в администраторската част на "
            "сайта — написано максимално просто, без технически термини.",
            subtitle_style,
        )
    )
    elements.append(PageBreak())

    for heading, blocks in CONTENT:
        elements.append(Paragraph(heading, heading_style))
        for block in blocks:
            if isinstance(block, str):
                elements.append(Paragraph(block, body_style))
            elif isinstance(block, tuple) and block[0] == "steps":
                items = [
                    ListItem(Paragraph(step, bullet_style), value=i + 1)
                    for i, step in enumerate(block[1])
                ]
                elements.append(
                    ListFlowable(
                        items,
                        bulletType="1",
                        bulletFontName=font_bold,
                        bulletColor=BRAND_ORANGE,
                        leftIndent=14,
                        spaceAfter=8,
                    )
                )
            elif isinstance(block, tuple) and block[0] == "bullets":
                items = [ListItem(Paragraph(b, bullet_style)) for b in block[1]]
                elements.append(
                    ListFlowable(
                        items,
                        bulletType="bullet",
                        bulletColor=BRAND_ORANGE,
                        leftIndent=14,
                        spaceAfter=8,
                    )
                )
            elif isinstance(block, tuple) and block[0] == "image":
                _, filename, caption = block
                image_path = SCREENSHOTS_DIR / filename
                if not image_path.exists():
                    raise FileNotFoundError(
                        f"Missing screenshot {image_path} — run "
                        "frontend/scripts/capture_admin_screenshots.mjs first."
                    )
                elements.append(
                    KeepTogether(
                        [
                            Image(
                                str(image_path),
                                width=content_width,
                                height=image_height,
                            ),
                            Paragraph(caption, caption_style),
                        ]
                    )
                )
        elements.append(Spacer(1, 10 * mm))

    doc.build(elements)


if __name__ == "__main__":
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    build_pdf()
    print(f"Wrote {OUTPUT_PATH}")
