from django.db import migrations


def backfill_item_numbers(apps, schema_editor):
    Product = apps.get_model("products", "Product")
    products = Product.objects.order_by("created_at", "id").only("id")
    for number, product in enumerate(products.iterator(), start=1):
        Product.objects.filter(pk=product.pk).update(item_number=number)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("products", "0004_product_item_number"),
    ]

    operations = [
        migrations.RunPython(backfill_item_numbers, noop_reverse),
    ]
