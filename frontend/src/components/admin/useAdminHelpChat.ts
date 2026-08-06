import { type ChangeEvent, useEffect, useRef, useState } from 'react'
import { searchAdminUsers } from '../../api/promotions'
import { fetchProducts } from '../../api/products'
import { type HelpFollowUp, type HelpLink, findHelpTopic } from '../../data/adminHelp'
import {
  type CandidateOption,
  type WizardState,
  WIZARD_START_PROMPT,
  advanceWizard,
  startWizard,
} from './adminCreateWizard'

/** Wizard steps where "@" should search clients instead of products — kept
 * as one list so both the search source and the mention prompt hint below
 * derive from the same place. */
const CLIENT_MENTION_STEPS = new Set(['promo_audience', 'coupon_user'])

export interface HelpMessage {
  role: 'user' | 'assistant'
  text: string
  link?: HelpLink
}

const INTRO: HelpMessage = {
  role: 'assistant',
  text:
    'Здравейте! Пишете команда като /помощ, /промоции или /продукти, за да ' +
    'разберете как се прави нещо в админ панела. Или напишете /създай, за да направя ' +
    'промоция или купон вместо вас, направо оттук. Напишете @ и част от име, за да ' +
    'потърсите и свържете продукт или (при избор на клиент) конкретен клиент.',
}

const FALLBACK = 'Не разпознах тази команда. Пробвайте /помощ за списък с наличните команди.'

/** Matches a trailing, still-being-typed "@query" at the end of the input —
 * e.g. "промоция за @кламер" -&gt; captures "кламер". Null (no match) means no
 * mention is currently active. */
const MENTION_PATTERN = /@([^\s@]*)$/

/** Shared behind both the floating widget (AdminHelpChat) and the full-page
 * version (AdminChatPage) — same conversation, same wizard, same @ mention
 * search, only the surrounding layout differs between the two. */
export function useAdminHelpChat() {
  const [messages, setMessages] = useState<HelpMessage[]>([INTRO])
  const [input, setInput] = useState('')
  // Set right after a topic with a follow-up question is answered — the
  // *next* message is matched against its branches (e.g. "категория" vs
  // "продукт") instead of being treated as a fresh top-level command.
  const [pendingFollowUp, setPendingFollowUp] = useState<HelpFollowUp | null>(null)
  // Set while /създай is walking through creating a real promotion/coupon —
  // takes priority over everything else below while active.
  const [wizard, setWizard] = useState<WizardState | null>(null)
  // "@query" autocomplete state — mentionQuery is the text after the "@";
  // pendingMention is the product actually picked, consumed by the next ask().
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionResults, setMentionResults] = useState<CandidateOption[]>([])
  const [pendingMention, setPendingMention] = useState<CandidateOption | null>(null)
  const logRef = useRef<HTMLDivElement>(null)

  const searchingClients = wizard ? CLIENT_MENTION_STEPS.has(wizard.step) : false

  useEffect(() => {
    // Nothing to clear here for the empty/no-mention case — every consumer
    // already gates rendering on `mentionQuery !== null`, so stale results
    // just sit unused in state until the next real query overwrites them.
    if (mentionQuery === null || mentionQuery.length === 0) return
    let cancelled = false
    const timer = setTimeout(() => {
      const search = searchingClients
        ? searchAdminUsers(mentionQuery).then((users) =>
            users.slice(0, 6).map((u) => ({ id: String(u.id), label: `${u.username} (${u.email})` })),
          )
        : fetchProducts({ search: mentionQuery }).then((page) =>
            page.results.slice(0, 6).map((p) => ({
              id: p.id,
              label: p.name,
              image: p.primary_image,
              number: p.supplier_id,
            })),
          )
      search
        .then((options) => {
          if (!cancelled) setMentionResults(options)
        })
        .catch(() => {
          if (!cancelled) setMentionResults([])
        })
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [mentionQuery, searchingClients])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [messages])

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value
    setInput(value)
    const match = MENTION_PATTERN.exec(value)
    setMentionQuery(match ? match[1] : null)
  }

  function pickMention(option: CandidateOption) {
    setInput((prev) => prev.replace(MENTION_PATTERN, option.label))
    setPendingMention(option)
    setMentionQuery(null)
    setMentionResults([])
  }

  async function ask(raw: string) {
    const text = raw.trim()
    if (!text) return
    const mentionForThisMessage = pendingMention
    setPendingMention(null)
    setMessages((prev) => [...prev, { role: 'user', text }])
    const normalized = text.toLowerCase().replace(/^\/+/, '')

    if (wizard) {
      const result = await advanceWizard(wizard, text, mentionForThisMessage)
      setWizard(result.state)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: result.message, link: result.link },
      ])
      return
    }

    if (normalized.includes('създай')) {
      setWizard(startWizard())
      setMessages((prev) => [...prev, { role: 'assistant', text: WIZARD_START_PROMPT }])
      return
    }

    const newMessages: HelpMessage[] = []

    if (pendingFollowUp) {
      const branch = pendingFollowUp.branches.find((b) =>
        b.keywords.some((keyword) => normalized.includes(keyword)),
      )
      setPendingFollowUp(null)
      if (branch) {
        newMessages.push({ role: 'assistant', text: branch.response, link: branch.link })
        setMessages((prev) => [...prev, ...newMessages])
        return
      }
      // Didn't match either branch — fall through and try it as a normal
      // top-level command instead of just giving up.
    }

    const topic = findHelpTopic(text)
    if (topic) {
      newMessages.push({
        role: 'assistant',
        text: `${topic.title}\n\n${topic.body}`,
        link: topic.link,
      })
      if (topic.followUp) {
        newMessages.push({ role: 'assistant', text: topic.followUp.question })
        setPendingFollowUp(topic.followUp)
      }
    } else {
      newMessages.push({ role: 'assistant', text: FALLBACK })
    }
    setMessages((prev) => [...prev, ...newMessages])
  }

  function askAbout(topic: string) {
    void ask(`/${topic}`)
  }

  function submit(raw: string) {
    void ask(raw)
    setInput('')
    setMentionQuery(null)
    setMentionResults([])
  }

  return {
    messages,
    logRef,
    input,
    handleInputChange,
    mentionQuery,
    mentionResults,
    pickMention,
    submit,
    askAbout,
  }
}
