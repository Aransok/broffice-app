# Client Requirements

Source: Original client brief (`CLAUDE/requred.md`)

## 1. Admin-only pages (hidden from normal users)

When an admin logs in, these links appear in the navigation bar:

| Route | Purpose |
|-------|---------|
| `/products` | Spreadsheet-style list of all products (id, name, categories, prices) |
| `/notifications` | Order inbox — admin can confirm or reject orders (reject if product unavailable) |
| `/promotions` | Manage promotions per product / category / user / site-wide |

### Pricing

- Admin has different pricing than clients
- Pricing rules will be defined later by the client
- Admin can open any product page and change price for **themselves** and for **clients**
- Model must support dual pricing (`admin_price`, `client_price`) with future rule engine hooks

### Promotions

- Per product or category: type a user and give them a promotion
- Discount type: percentage (`%`) or flat amount
- Or a total `%` promotion for the whole catalog / page for a user
- Dedicated promotions management page

## 2. Email system

### On order placed

Admin receives email containing:

- Ordered products
- Prices
- Link to confirm/reject page (`/notifications` or direct order URL)

### On order confirmed

Customer receives email with:

- Ordered products
- Prices of the products
- Formatted as invoice (Като фактура)

## Implementation notes

- Auth: Django users with `is_staff` / custom `is_admin` role
- Frontend: React Router guards for admin routes
- Backend: DRF permission classes (`IsAdminUser`)
- Email: Celery tasks + Django email backend
- Pricing rules deferred — schema designed for extension
