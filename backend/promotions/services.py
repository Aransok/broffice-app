"""Promotion matching rules.

The CRUD API for Promotion already existed; nothing anywhere ever actually
*applied* a promotion to a price until this. Picking the winning discount and
combining it with individual customer pricing now lives in
`pricing/services.py::get_effective_price` (the single centralized pricing
entry point) — this module only owns the "which promotions match this
product/user" question.
"""

from django.db.models import Q
from django.utils import timezone

from categories.services import get_descendant_category_ids

from .models import Promotion


def get_active_promotions():
    now = timezone.now()
    return list(
        Promotion.objects.filter(active=True, status=Promotion.STATUS_PUBLISHED)
        .filter(Q(starts_at__isnull=True) | Q(starts_at__lte=now))
        .filter(Q(ends_at__isnull=True) | Q(ends_at__gte=now))
        .select_related("category", "product")
    )


def promoted_products_q(promotions, user=None):
    """Q object matching products covered by an active product/category/
    global promotion — the single place this "which products count as on
    promotion" question is answered, reused by both the homepage's
    Promotions section and the public /promotions listing so they can
    never drift apart. Promotions targeted at one specific client (`user`
    set — independent of scope now, see promotions/models.py) are excluded
    from what an anonymous or *different* visitor sees — a private
    per-client discount must never show up as a public "on sale" badge for
    everyone else.

    When `user` is the currently authenticated visitor, their own
    client-targeted promotions ARE included too — a logged-in client with a
    personal discount must be able to find it on the Promotions page/section
    like anyone else's sale items, not just see it silently applied at
    checkout (real client report: "I can't see the promotion made for me").

    Returns None when no qualifying promotion is active at all — callers
    decide what that means (homepage: fall back to something else; listing:
    show nothing).
    """
    is_authenticated = user is not None and getattr(user, "is_authenticated", False)
    visible_promotions = [
        p
        for p in promotions
        if p.user_id is None or (is_authenticated and p.user_id == user.id)
    ]
    product_ids = {
        p.product_id for p in visible_promotions if p.scope == Promotion.SCOPE_PRODUCT
    }
    category_ids: set = set()
    for p in visible_promotions:
        if p.scope == Promotion.SCOPE_CATEGORY and p.category_id:
            category_ids |= get_descendant_category_ids(p.category)
    has_global_promo = any(
        p.scope == Promotion.SCOPE_GLOBAL for p in visible_promotions
    )
    if product_ids or category_ids:
        return Q(id__in=product_ids) | Q(category_id__in=category_ids)
    if has_global_promo:
        return Q()
    return None


def find_matching_promotions(product, user, promotions):
    """A promotion applies when its target matches AND (it has no audience
    restriction OR the audience is this exact customer) — a real AND, not a
    branch on a single scope value. Replaces the old model where "for this
    product" and "for this client" were mutually exclusive scope options."""
    is_authenticated = user is not None and getattr(user, "is_authenticated", False)
    matches = []
    for promo in promotions:
        target_matches = (
            promo.scope == Promotion.SCOPE_GLOBAL
            or (
                promo.scope == Promotion.SCOPE_CATEGORY
                and product.category_id
                and promo.category_id
                and product.category_id in get_descendant_category_ids(promo.category)
            )
            or (
                promo.scope == Promotion.SCOPE_PRODUCT
                and promo.product_id == product.id
            )
        )
        if not target_matches:
            continue
        if promo.user_id is not None and not (
            is_authenticated and promo.user_id == user.id
        ):
            continue
        matches.append(promo)
    return matches
