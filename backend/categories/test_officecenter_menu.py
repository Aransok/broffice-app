import importlib

import pytest
from django.apps import apps as django_apps

from categories.models import Category

menu_migration = importlib.import_module(
    "categories.migrations.0003_officecenter_menu_structure"
)


@pytest.mark.django_db
def test_officecenter_menu_creates_missing_and_keeps_existing():
    Category.objects.all().delete()
    office = Category.objects.create(
        external_id="1",
        slug="канцеларски-материали",
        name="Канц. (наше име)",
        sort_order=0,
    )
    other = Category.objects.create(
        external_id="645", slug="други", name="Други", sort_order=10
    )
    # One of ours that Office Center's menu does not have.
    extra = Category.objects.create(
        external_id="99999", slug="наша", name="Наша", parent=office
    )

    menu_migration.apply_menu(django_apps, None)

    office.refresh_from_db()
    assert office.name == "Канц. (наше име)"  # never renamed

    robots = Category.objects.get(external_id="711")
    assert robots.parent is None
    assert robots.status == Category.STATUS_PUBLISHED
    assert list(robots.children.values_list("name", flat=True)) == [
        "Образователни роботи",
        "Почистващи роботи",
        "Аксесоари и консумативи за роботи",
    ]

    # Роботи goes right before Други, which moves down one.
    other.refresh_from_db()
    assert robots.sort_order == 10
    assert other.sort_order == 11

    office_children = list(office.children.all())
    assert office_children[-1] == extra
    assert office_children[0].sort_order == 0

    # Slugs are unique and Cyrillic like the sync's.
    slugs = list(Category.objects.values_list("slug", flat=True))
    assert len(slugs) == len(set(slugs))
    assert Category.objects.filter(slug="роботи").exists()
