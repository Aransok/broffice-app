# Client asked for the category menu to carry every subcategory Office
# Center's own menu has, in their order. The supplier sync only creates a
# category once it has a product in it, so 86 of their menu entries
# (including the whole "Роботи" root) never existed here.
#
# Snapshot of their menu: categories/data/officecenter_menu.json (ids are
# Office Center's own category ids = our external_id, shared with the sync).
#
# - Missing categories are created (published) under the right parent.
# - Existing categories are never renamed, re-parented or re-published.
# - Subcategory sort_order follows Office Center; our own extra
#   subcategories (not in their menu) keep their order after theirs.
# - Top level keeps the client's order from 0002; Роботи goes before Други.
import json
from pathlib import Path

from django.db import migrations
from django.db.models import F
from django.utils.text import slugify

SNAPSHOT = Path(__file__).resolve().parent.parent / "data" / "officecenter_menu.json"
ROBOTS_ID = "711"
OTHER_ID = "645"
EXTRA_OFFSET = 1000


def unique_slug(Category, name, external_id):
    base = slugify(name, allow_unicode=True) or external_id
    if not Category.objects.filter(slug=base).exists():
        return base
    return f"{base}-{external_id}"


def get_or_create(Category, node, parent):
    category = Category.objects.filter(external_id=node["id"]).first()
    if category is None:
        name = " ".join(node["name"].split())
        category = Category.objects.create(
            external_id=node["id"],
            name=name,
            slug=unique_slug(Category, name, node["id"]),
            parent=parent,
            status="published",
        )
    return category


def apply_children(Category, parent, nodes):
    ordered_ids = []
    for index, node in enumerate(nodes):
        category = get_or_create(Category, node, parent)
        if category.parent_id == parent.id:
            Category.objects.filter(pk=category.pk).update(sort_order=index)
            ordered_ids.append(category.pk)
        apply_children(Category, category, node.get("children", []))
    extras = (
        Category.objects.filter(parent=parent)
        .exclude(pk__in=ordered_ids)
        .order_by("sort_order", "name")
    )
    for index, extra in enumerate(extras):
        Category.objects.filter(pk=extra.pk).update(sort_order=EXTRA_OFFSET + index)


def apply_menu(apps, schema_editor):
    Category = apps.get_model("categories", "Category")
    # Fills out an existing catalog only; an empty database (fresh install,
    # test runs) gets its categories from the import/sync as before.
    if not Category.objects.exists():
        return
    roots =json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    for root in roots:
        category = get_or_create(Category, root, None)
        apply_children(Category, category, root["children"])

    # Top-level order from 0002 stays; slot Роботи in just before Други.
    other = Category.objects.filter(external_id=OTHER_ID, parent__isnull=True).first()
    robots = Category.objects.filter(external_id=ROBOTS_ID, parent__isnull=True).first()
    if other and robots:
        position = other.sort_order
        Category.objects.filter(parent__isnull=True, sort_order__gte=position).exclude(
            pk=robots.pk
        ).update(sort_order=F("sort_order") + 1)
        Category.objects.filter(pk=robots.pk).update(sort_order=position)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("categories", "0002_reorder_top_level_categories"),
    ]

    operations = [
        migrations.RunPython(apply_menu, noop),
    ]
