from rest_framework.pagination import PageNumberPagination


class LargePageNumberPagination(PageNumberPagination):
    """For small, bounded reference lists (categories, brands) that a select/
    dropdown needs in full — the default PAGE_SIZE=24 silently truncated
    these once the supplier sync grew them past a couple hundred rows, with
    no visible error, just a dropdown quietly missing most of its options.
    Same response shape as the default (count/next/previous/results), so no
    frontend change is needed — this just makes page 1 big enough to always
    be the only page in practice."""

    page_size = 500
