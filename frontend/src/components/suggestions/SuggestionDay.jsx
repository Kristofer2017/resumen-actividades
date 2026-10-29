import SuggestionItem from './SuggestionItem.jsx'

export default function SuggestionDay({
  day,
  items,
  copiedHash,
  onToggle,
  onTextChange,
  onCopy,
}) {
  return (
    <section className="suggestion-day">
      <h3>
        {day.label}
        <span>{items.length}</span>
      </h3>

      <div className="suggestion-list">
        {items.map((item) => (
          <SuggestionItem
            key={item.hash}
            item={item}
            copied={copiedHash === item.hash}
            onToggle={onToggle}
            onTextChange={onTextChange}
            onCopy={onCopy}
          />
        ))}
      </div>
    </section>
  )
}
