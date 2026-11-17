/** Sort dropdown options shared by the category and search pages;
 * `ordering` is what the API's `ordering` param takes. */
export const SORT_OPTIONS: { value: string; label: string; ordering: string }[] = [
  { value: 'default', label: 'По подразбиране', ordering: '' },
  { value: 'name', label: 'Име (А-Я)', ordering: 'name' },
  { value: 'price_asc', label: 'Цена: ниска към висока', ordering: 'price_bgn' },
  { value: 'price_desc', label: 'Цена: висока към ниска', ordering: '-price_bgn' },
  { value: 'brand', label: 'Марка (А-Я)', ordering: 'brand__name,name' },
  { value: 'brand_desc', label: 'Марка (Я-А)', ordering: '-brand__name,name' },
]

export function orderingFor(sort: string) {
  return SORT_OPTIONS.find((option) => option.value === sort)?.ordering || undefined
}
