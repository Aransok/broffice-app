from django.db import migrations


def mark_handled_notifications_read(apps, schema_editor):
    """Clears "new order" notifications stuck unread on orders that were
    already confirmed or rejected — marking them read used to be a separate
    browser request after confirm/reject that could be lost, and a handled
    order's card has no button to clear it. Pigeon Express warnings ("⚠ …")
    are left as they are: those are meant to be acted on."""
    OrderNotification = apps.get_model("orders", "OrderNotification")
    OrderNotification.objects.filter(is_read=False).exclude(
        order__status="pending"
    ).exclude(message__startswith="⚠").update(is_read=True)


class Migration(migrations.Migration):
    dependencies = [
        ("orders", "0016_pigeon_express_notified_stage"),
    ]

    operations = [
        migrations.RunPython(
            mark_handled_notifications_read, migrations.RunPython.noop
        ),
    ]
