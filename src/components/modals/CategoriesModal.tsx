import { useState } from 'react'
import { cx } from '../../lib/cx'
import { CATEGORY_COLOR_CHOICES, CATEGORY_EMOJI_CHOICES } from '../../state/categories'
import { useStore } from '../../state/store'
import { useUi } from '../../state/ui'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

export function CategoriesModal({ onClose }: { onClose: () => void }) {
  const { trip, dispatch } = useStore()
  const { pushToast } = useUi()
  const [editing, setEditing] = useState<string | null>(null)
  const [newName, setNewName] = useState('')

  const counts = new Map<string, number>()
  for (const place of trip.places) {
    const id = place.category ?? 'other'
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }

  const addCategory = () => {
    const name = newName.trim()
    if (!name) return
    dispatch({
      type: 'categories/add',
      category: { name, emoji: '📍', color: CATEGORY_COLOR_CHOICES[trip.categories.length % CATEGORY_COLOR_CHOICES.length] },
    })
    setNewName('')
    pushToast(`Category “${name}” added`, 'success')
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title="Categories"
      description="Each category has an emoji and a colour, used for the map markers."
      footer={<Button variant="primary" onClick={onClose}>Done</Button>}
    >
      <div className="space-y-3">
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
          {trip.categories.map((category) => (
            <li key={category.id} className="px-3 py-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(editing === category.id ? null : category.id)}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[15px] transition-transform hover:scale-105"
                  style={{ background: `${category.color}22` }}
                  title="Change emoji and colour"
                >
                  {category.emoji}
                </button>
                <input
                  value={category.name}
                  onChange={(e) =>
                    dispatch({ type: 'categories/patch', categoryId: category.id, patch: { name: e.target.value } })
                  }
                  className="min-w-0 flex-1 rounded-md border border-transparent px-1.5 py-1 text-[13px] font-medium hover:border-slate-200 focus:border-brand-600 focus:outline-none"
                />
                <span className="shrink-0 text-[11px] tabular-nums text-slate-400">
                  {counts.get(category.id) ?? 0}
                </span>
                {category.builtIn ? (
                  <span className="shrink-0 text-[10px] font-semibold tracking-wide text-slate-300 uppercase">
                    built-in
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      dispatch({ type: 'categories/remove', categoryId: category.id })
                      pushToast('Category removed — its places moved to “Other”')
                    }}
                    className="shrink-0 rounded-md px-1.5 py-1 text-[11px] font-semibold text-rose-500 hover:bg-rose-50"
                  >
                    Delete
                  </button>
                )}
              </div>

              {editing === category.id && (
                <div className="mt-2 space-y-2 border-t border-slate-100 pt-2 animate-fade">
                  <div className="flex flex-wrap gap-1">
                    {CATEGORY_EMOJI_CHOICES.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() =>
                          dispatch({ type: 'categories/patch', categoryId: category.id, patch: { emoji } })
                        }
                        className={cx(
                          'grid h-7 w-7 place-items-center rounded-md text-[14px] transition-colors',
                          category.emoji === emoji ? 'bg-slate-900' : 'hover:bg-slate-100',
                        )}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {CATEGORY_COLOR_CHOICES.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() =>
                          dispatch({ type: 'categories/patch', categoryId: category.id, patch: { color } })
                        }
                        style={{ background: color }}
                        className={cx(
                          'h-6 w-6 rounded-md transition-transform hover:scale-110',
                          category.color === color && 'ring-2 ring-slate-900 ring-offset-2',
                        )}
                        aria-label={color}
                      />
                    ))}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>

        <div className="flex gap-1.5">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCategory()}
            placeholder="New category name…"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
          />
          <Button variant="primary" onClick={addCategory} disabled={!newName.trim()}>
            Add
          </Button>
        </div>
      </div>
    </Modal>
  )
}
