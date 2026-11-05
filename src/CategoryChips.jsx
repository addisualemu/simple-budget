/** One click turns a category on or off. Any number can be on. */
export default function CategoryChips({ categories, selected, label, onToggle }) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {categories.map((category) => {
        const on = selected.includes(category.id)
        return (
          <button
            key={category.id}
            type="button"
            className={on ? 'chip on' : 'chip'}
            aria-pressed={on}
            onClick={() => onToggle(category.id)}
          >
            {on && '✓ '}
            {category.name}
          </button>
        )
      })}
    </div>
  )
}
