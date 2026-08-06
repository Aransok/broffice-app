import { Link } from 'react-router-dom'
import { useCategories } from '../../api/categories'
import { usePublicConfig } from '../../api/config'
import { useCookieConsent } from '../../context/CookieConsentContext'

export function Footer() {
  const { data: categories } = useCategories()
  const { data: config } = usePublicConfig()
  const { openPreferences } = useCookieConsent()
  const quickLinks = categories?.results.slice(0, 6) ?? []

  return (
    <footer className="mt-auto border-t border-slate-200 bg-slate-50 text-sm text-slate-600">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <h3 className="mb-3 font-semibold text-slate-900">Информация</h3>
          <ul className="space-y-1">
            <li>
              <Link to="/about" className="hover:text-primary">
                За нас
              </Link>
            </li>
            <li>
              <Link to="/contact" className="hover:text-primary">
                Контакти
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 font-semibold text-slate-900">Категории</h3>
          <ul className="space-y-1">
            {quickLinks.map((category) => (
              <li key={category.id}>
                <Link to={`/category/${category.slug}`} className="hover:text-primary">
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-3 font-semibold text-slate-900">Правна информация</h3>
          <ul className="space-y-1">
            <li>
              <Link to="/terms" className="hover:text-primary">
                Общи условия
              </Link>
            </li>
            <li>
              <Link to="/privacy-policy" className="hover:text-primary">
                Политика за поверителност
              </Link>
            </li>
            <li>
              <Link to="/cookie-policy" className="hover:text-primary">
                Политика за бисквитки
              </Link>
            </li>
            <li>
              <Link to="/returns" className="hover:text-primary">
                Връщане и право на отказ
              </Link>
            </li>
            <li>
              <button type="button" onClick={openPreferences} className="hover:text-primary">
                Настройки на бисквитките
              </button>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 font-semibold text-slate-900">Свържете се с нас</h3>
          <ul className="space-y-1">
            <li>{config?.company_name}</li>
            <li>{config?.company_address}</li>
            <li>ЕИК: {config?.company_eik}</li>
            {config?.company_vat_number && <li>ДДС номер: {config.company_vat_number}</li>}
            <li>
              <a href={`tel:${config?.company_phone.replace(/\s/g, '')}`} className="hover:text-primary">
                {config?.company_phone}
              </a>
            </li>
            <li>
              <a href={`mailto:${config?.company_email}`} className="hover:text-primary">
                {config?.company_email}
              </a>
            </li>
            <li>{config?.company_working_hours}</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-200 px-4 py-4 text-center text-xs">
        &copy; {new Date().getFullYear()} {config?.company_name}. Всички права запазени.
      </div>
    </footer>
  )
}
