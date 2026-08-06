from .models import Favorite


def get_favorited_product_ids(user) -> set:
    """Fetched once per request (mirrors pricing.services.get_user_overrides),
    not once per product row, so rendering a page of products never issues
    one favorites query per card."""
    if user is None or not getattr(user, "is_authenticated", False):
        return set()
    return set(Favorite.objects.filter(user=user).values_list("product_id", flat=True))
