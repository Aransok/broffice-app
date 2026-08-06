"""Seed a small set of mock Speedy offices for local development.

Real Speedy office data was never available (see docs/issues/speedy-api-shape.md) —
this is placeholder data for the office-pickup UI, not a real courier feed.
"""

from django.core.management.base import BaseCommand

from shipping.models import SpeedyOffice

MOCK_OFFICES = [
    {
        "external_id": "SPD-SOF-1",
        "name": "Speedy office Sofia Center",
        "city": "София",
        "address": "бул. Витоша 1",
        "phone": "0700 17 001",
    },
    {
        "external_id": "SPD-SOF-2",
        "name": "Speedy office Mladost",
        "city": "София",
        "address": "бул. Александър Малинов 51",
        "phone": "0700 17 002",
    },
    {
        "external_id": "SPD-PLV-1",
        "name": "Speedy office Plovdiv Center",
        "city": "Пловдив",
        "address": "ул. Райко Даскалов 12",
        "phone": "0700 17 003",
    },
    {
        "external_id": "SPD-VAR-1",
        "name": "Speedy office Varna Center",
        "city": "Варна",
        "address": "бул. Осми Приморски полк 5",
        "phone": "0700 17 004",
    },
]


class Command(BaseCommand):
    help = "Seed mock SpeedyOffice rows for local development (idempotent)"

    def handle(self, *args, **options):
        count = 0
        for data in MOCK_OFFICES:
            _, created = SpeedyOffice.objects.update_or_create(
                external_id=data["external_id"], defaults=data
            )
            count += 1 if created else 0
        self.stdout.write(
            self.style.SUCCESS(f"Seeded {len(MOCK_OFFICES)} offices ({count} new)")
        )
