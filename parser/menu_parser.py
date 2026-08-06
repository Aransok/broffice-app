"""Navigation / mega menu parser."""

from __future__ import annotations

import re
from pathlib import Path

from .base import read_soup, result


class MenuParser:
    def parse_file(self, path: Path) -> dict:
        try:
            soup = read_soup(path)
        except OSError as exc:
            return result(status="error", errors=[str(exc)])

        items = []
        for li in soup.select(".department-nav-menu .nav-menu-list > li"):
            link = li.select_one("a.nav-link")
            if not link:
                continue
            href = link.get("href", "")
            top = {
                "name": link.get_text(" ", strip=True),
                "href": href,
                "children": [],
            }
            for submenu in li.select(".department-submenu"):
                heading = submenu.select_one(".submenu-heading a, h3 a")
                group = {
                    "name": heading.get_text(" ", strip=True) if heading else "",
                    "href": heading.get("href") if heading else "",
                    "children": [],
                }
                for a in submenu.select("ul li a"):
                    group["children"].append(
                        {
                            "name": a.get_text(" ", strip=True),
                            "href": a.get("href", ""),
                            "category_id": _cat_id(a.get("href", "")),
                        }
                    )
                top["children"].append(group)
            items.append(top)

        footer_links = []
        for a in soup.select("footer a, .axil-footer-area a, .footer-widget a"):
            footer_links.append({"name": a.get_text(" ", strip=True), "href": a.get("href", "")})

        content = {
            "menus": [{"name": "department", "items": items}],
            "footer_links": footer_links[:100],
            "source_file": str(path),
        }
        return result(content=content)


def _cat_id(href: str) -> str | None:
    m = re.search(r"category/(\d+)/", (href or "").replace("\\", "/"))
    return m.group(1) if m else None
