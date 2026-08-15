# Client-requested top-level category order: office supplies first, paper
# second, "Други" (the literal catch-all "Other" category) last, everything
# else keeping its current relative (alphabetical) order in between. Only
# touches sort_order on these 11 known top-level categories by slug - never
# guessed, matched against the real live category list first.
from django.db import migrations

ORDER = [
    "канцеларски-материали",
    "хартия-и-продукти-от-хартия",
    "компютри-и-периферия",
    "консумативи-за-принтери",
    "мебели",
    "опаковъчни-материали",
    "принтери-скенери-и-мфу",
    "техника",
    "ученически-и-детски-стоки",
    "хигиена-и-козметика",
    "други",
]


def set_order(apps, schema_editor):
    Category = apps.get_model("categories", "Category")
    for index, slug in enumerate(ORDER):
        Category.objects.filter(slug=slug, parent__isnull=True).update(sort_order=index)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("categories", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(set_order, noop),
    ]
