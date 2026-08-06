# ER Diagram

See [DATABASE_DESIGN.md](../DATABASE_DESIGN.md) for the full mermaid ER diagram and field lists.

## Quick reference

```
Category (tree)
   └── Product ── Brand
          ├── ProductImage (path only)
          ├── ProductSpecification
          ├── AdminPriceOverride
          └── Promotion (optional)

User
   ├── Order ── OrderItem ── Product
   │      ├── OrderNotification
   │      └── EmailLog
   └── Promotion (user-scoped)
```
