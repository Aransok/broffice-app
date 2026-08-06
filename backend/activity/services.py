from django.db.models import F, Sum

from products.models import Product

from .models import ProductView


def track_product_view(user, product) -> ProductView:
    view, created = ProductView.objects.get_or_create(
        user=user, product=product, defaults={"category": product.category}
    )
    if not created:
        view.view_count = F("view_count") + 1
        view.category = product.category
        view.save(update_fields=["view_count", "category", "last_viewed_at"])
        view.refresh_from_db()
    return view


def _diversify_by_brand(products, limit, max_per_brand):
    """Caps how many consecutive picks can share a brand — without this,
    products synced from the supplier in one batch (e.g. five thickness
    variants of the same stretch-film roll, same brand, adjacent
    created_at) dominate a "similar"/"recommended" list with what's
    effectively one item repeated, not real variety.

    A preference, not a hard cutoff: some categories genuinely are a single
    brand end to end, and returning a near-empty list to preserve the cap
    would be worse than the repetition it's meant to fix — so leftovers that
    didn't make the first pass fill out any remaining slots."""
    picked = []
    brand_counts: dict = {}
    leftover = []
    for product in products:
        if len(picked) >= limit:
            break
        count = brand_counts.get(product.brand_id, 0)
        if count >= max_per_brand:
            leftover.append(product)
            continue
        picked.append(product)
        brand_counts[product.brand_id] = count + 1
    for product in leftover:
        if len(picked) >= limit:
            break
        picked.append(product)
    return picked


def get_recommended_products(user, *, exclude_product_id=None, limit=8):
    """Personalized "recommended for you" — the categories this user actually
    views the most, weighted by view_count, excluding whatever they've
    already looked at (the point is surfacing something new, not repeating
    their own history back at them). Empty for guests/no-activity users —
    callers should hide the section entirely rather than show it empty,
    same as the homepage's Best-Sellers/Promotions sections already do."""
    if not user or not user.is_authenticated:
        return Product.objects.none()

    top_category_ids = list(
        ProductView.objects.filter(user=user, category__isnull=False)
        .values("category_id")
        .annotate(total_views=Sum("view_count"))
        .order_by("-total_views")
        .values_list("category_id", flat=True)[:3]
    )
    if not top_category_ids:
        return Product.objects.none()

    already_viewed_ids = ProductView.objects.filter(user=user).values_list(
        "product_id", flat=True
    )

    # Random (not "-created_at") within each category — newest-first just
    # grabs whatever batch was synced most recently, which is often a
    # cluster of near-identical variants. Round-robin across the user's top
    # categories too, so one category's stock can't crowd out the others.
    per_category = []
    for category_id in top_category_ids:
        qs = (
            Product.objects.filter(
                status=Product.STATUS_PUBLISHED, category_id=category_id
            )
            .exclude(id__in=already_viewed_ids)
            .select_related("category", "brand")
            .prefetch_related("images")
            .order_by("?")
        )
        if exclude_product_id:
            qs = qs.exclude(id=exclude_product_id)
        per_category.append(list(qs[: limit * 2]))

    interleaved = []
    for row in range(limit * 2):
        for bucket in per_category:
            if row < len(bucket):
                interleaved.append(bucket[row])

    max_per_brand = max(2, limit // 4)
    return _diversify_by_brand(interleaved, limit, max_per_brand)


def get_similar_products(product, *, limit=8):
    """Content-based "similar products" for a product detail page — same
    category (required; nothing to compare against otherwise), capped per
    brand so the list is a real spread rather than five variants of the
    same synced product line. Not personalized — same result for every
    visitor."""
    if not product.category_id:
        return Product.objects.none()

    # Random (not "-created_at") for the same clustering reason as
    # get_recommended_products above.
    candidates = list(
        Product.objects.filter(
            status=Product.STATUS_PUBLISHED, category_id=product.category_id
        )
        .exclude(id=product.id)
        .select_related("category", "brand")
        .prefetch_related("images")
        .order_by("?")[: limit * 3]
    )
    max_per_brand = max(2, limit // 4)
    return _diversify_by_brand(candidates, limit, max_per_brand)
