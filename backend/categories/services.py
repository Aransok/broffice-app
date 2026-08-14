"""Category hierarchy helpers.

The single source of truth for "does category X cover product P" wherever
that question comes up (storefront category browsing, promotion matching) —
before this existed, every consumer matched a product's *own* category
exactly, never its descendants, so a mid-level category with only
grandchildren-level products looked empty, and a promotion scoped to a
parent category silently never matched anything filed under its children.
"""

from __future__ import annotations

import uuid

from .models import Category


def get_descendant_category_ids(category: Category) -> set[uuid.UUID]:
    """category's own id plus every descendant's id (children,
    grandchildren, ...), walking the self-referential `parent`/`children`
    relation. Category depth in this catalog is shallow (2-3 levels), so a
    plain recursive walk is enough - no need for MPTT/nested-set machinery."""
    ids = {category.id}
    for child in category.children.all():
        ids |= get_descendant_category_ids(child)
    return ids
