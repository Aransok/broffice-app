# Database Design

## ER Diagram (logical)

```mermaid
erDiagram
    Category ||--o{ Category : parent
    Category ||--o{ Product : contains
    Brand ||--o{ Product : brands
    Product ||--o{ ProductImage : has
    Product ||--o{ ProductDocument : has
    Product ||--o{ ProductSpecification : has
    Product ||--o{ AdminPriceOverride : priced
    User ||--o{ AdminPriceOverride : owns
    User ||--o{ Promotion : targeted
    Product ||--o{ Promotion : applies
    Category ||--o{ Promotion : applies
    User ||--o{ Order : places
    Order ||--o{ OrderItem : contains
    Order ||--o{ OrderNotification : notifies
    Order ||--o{ EmailLog : emails
    Page ||--|| SEO : has
    Product ||--|| SEO : has
    Category ||--|| SEO : has
    Menu ||--o{ MenuItem : contains
    Redirect ||--|| SEO : optional

    Category {
        uuid id
        string external_id UK
        string slug UK
        string name
        uuid parent_id FK
        int sort_order
        string status
        datetime created_at
        datetime updated_at
    }

    Product {
        uuid id
        string external_id UK
        string slug UK
        string sku
        string name
        text description
        decimal price_bgn
        decimal price_eur
        decimal old_price_bgn
        decimal client_price
        decimal admin_price
        string currency
        string availability
        uuid brand_id FK
        uuid category_id FK
        datetime created_at
        datetime updated_at
    }

    Brand {
        uuid id
        string external_id UK
        string slug UK
        string name
        string logo_path
    }

    ProductImage {
        uuid id
        uuid product_id FK
        string path
        string hash
        int width
        int height
        int sort_order
    }

    AdminPriceOverride {
        uuid id
        uuid product_id FK
        uuid user_id FK
        decimal admin_price
        decimal client_price
        datetime updated_at
    }

    Promotion {
        uuid id
        string name
        string discount_type
        decimal value
        string scope
        uuid user_id FK
        uuid product_id FK
        uuid category_id FK
        bool active
        datetime starts_at
        datetime ends_at
    }

    Order {
        uuid id
        string number UK
        uuid user_id FK
        string status
        decimal total_bgn
        text notes
        datetime created_at
    }

    OrderItem {
        uuid id
        uuid order_id FK
        uuid product_id FK
        int quantity
        decimal unit_price
        decimal line_total
    }

    OrderNotification {
        uuid id
        uuid order_id FK
        bool is_read
        datetime created_at
    }

    EmailLog {
        uuid id
        uuid order_id FK
        string email_type
        string to_address
        string status
        datetime sent_at
    }

    SEO {
        uuid id
        string title
        text description
        string canonical
        string robots
        json open_graph
        json json_ld
    }

    Redirect {
        uuid id
        string from_path UK
        string to_path
        int status_code
    }
```

## Django apps & models

| App | Models |
|-----|--------|
| `core` | TimeStampedModel, SoftStatusModel mixins; SiteSettings |
| `categories` | Category |
| `brands` | Brand |
| `products` | Product, ProductImage, ProductDocument, ProductSpecification |
| `seo` | SEO, Redirect |
| `pages` | Page |
| `navigation` | Menu, MenuItem |
| `accounts` | User (custom), Profile |
| `pricing` | AdminPriceOverride |
| `promotions` | Promotion |
| `orders` | Order, OrderItem, OrderNotification, EmailLog |
| `media_app` | MediaAsset (optional shared metadata) |

## Base fields (every entity)

- `id` UUID PK
- `created_at`, `updated_at`
- `slug` (unique where applicable)
- `status` (draft/published/archived)
- `sort_order`
- `external_id` for HTTrack/live sync (unique, indexed)

## Indexes & constraints

- Unique: `(external_id)` on Product, Category, Brand
- Unique: `slug` per entity type
- Index: Product(name), Product(category_id), Order(status), Promotion(scope, active)
- FK ON DELETE: ProductImage CASCADE with Product; OrderItem CASCADE with Order

## Pricing notes (client TBD)

- `Product.client_price` / `Product.admin_price` store defaults
- `AdminPriceOverride` allows per-admin customization later
- Promotion engine: `discount_type` in {`percent`, `flat`}, `scope` in {`user`, `product`, `category`, `global`}

## Image storage

PostgreSQL stores only paths + hash + dimensions. Binaries in `media/`.
