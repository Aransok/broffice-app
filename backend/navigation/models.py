from django.db import models

from common.models import SoftStatusModel, TimeStampedModel


class Menu(TimeStampedModel, SoftStatusModel):
    name = models.CharField(max_length=128, unique=True)
    location = models.CharField(max_length=64, default="department")

    def __str__(self) -> str:
        return self.name


class MenuItem(TimeStampedModel, SoftStatusModel):
    menu = models.ForeignKey(Menu, related_name="items", on_delete=models.CASCADE)
    parent = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        related_name="children",
        on_delete=models.CASCADE,
    )
    label = models.CharField(max_length=255)
    url = models.CharField(max_length=1024, blank=True, default="")
    category = models.ForeignKey(
        "categories.Category",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="menu_items",
    )

    class Meta:
        ordering = ["sort_order", "label"]

    def __str__(self) -> str:
        return self.label
